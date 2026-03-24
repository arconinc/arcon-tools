import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/opportunities?assigned_to=&status=&stage=&customer_id=&tag_id=&page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignedTo = searchParams.get('assigned_to')
  const status = searchParams.get('status')
  const stage = searchParams.get('stage')
  const customerId = searchParams.get('customer_id')
  const tagId = searchParams.get('tag_id')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const adminClient = createAdminClient()

  // If filtering by tag, get matching entity IDs first
  let tagFilterIds: string[] | null = null
  if (tagId) {
    const { data: tagRows } = await adminClient
      .from('crm_entity_tags')
      .select('entity_id')
      .eq('tag_id', tagId)
      .eq('entity_type', 'opportunity')
    tagFilterIds = (tagRows ?? []).map((r: any) => r.entity_id)
    if (tagFilterIds.length === 0) {
      return NextResponse.json({ items: [], total: 0, page, limit, pipeline_total: 0 })
    }
  }

  const applyFilters = (q: any) => {
    if (assignedTo) q = q.eq('assigned_to', assignedTo)
    if (status) q = q.eq('status', status)
    if (stage) q = q.eq('pipeline_stage', stage)
    if (customerId) q = q.eq('customer_id', customerId)
    if (tagFilterIds) q = q.in('id', tagFilterIds)
    if (search) q = q.ilike('name', `%${search}%`)
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('crm_opportunities').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('crm_opportunities')
        .select('id, name, customer_id, assigned_to, pipeline_stage, value, probability, status, category, forecast_close_date, closed_at, created_at, updated_at')
        .order('created_at', { ascending: false })
    ).range(from, to),
  ])

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 })

  const total = countRes.count ?? 0
  const rows = (dataRes.data as any[]) ?? []

  // Collect unique user IDs and customer IDs for enrichment
  const userIds = [...new Set(rows.map((o: any) => o.assigned_to).filter(Boolean))]
  const custIds = [...new Set(rows.map((o: any) => o.customer_id).filter(Boolean))]
  const oppIds = rows.map((o: any) => o.id)

  const [usersRes, custsRes, entityTagsRes] = await Promise.all([
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    custIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', custIds)
      : Promise.resolve({ data: [] }),
    oppIds.length > 0
      ? adminClient
          .from('crm_entity_tags')
          .select('entity_id, crm_tags(id, name, color)')
          .eq('entity_type', 'opportunity')
          .in('entity_id', oppIds)
      : Promise.resolve({ data: [] }),
  ])

  const usersMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) usersMap[u.id] = u.display_name

  const custsMap: Record<string, string> = {}
  for (const c of custsRes.data ?? []) custsMap[c.id] = c.name

  // Build tags map: entity_id -> CrmTag[]
  const tagsMap: Record<string, any[]> = {}
  for (const row of entityTagsRes.data ?? []) {
    const eid = (row as any).entity_id
    const tag = (row as any).crm_tags
    if (!tagsMap[eid]) tagsMap[eid] = []
    if (tag) tagsMap[eid].push(tag)
  }

  const enriched = rows.map((o: any) => ({
    ...o,
    assigned_user_name: o.assigned_to ? (usersMap[o.assigned_to] ?? null) : null,
    customer_name: o.customer_id ? (custsMap[o.customer_id] ?? null) : null,
    tags: tagsMap[o.id] ?? [],
  }))

  const pipelineTotal = enriched
    .filter((o: any) => o.status === 'open' && o.value != null)
    .reduce((sum: number, o: any) => sum + (o.value ?? 0), 0)

  return NextResponse.json({ items: enriched, total, page, limit, pipeline_total: pipelineTotal })
}

// POST /api/crm/opportunities
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, customer_id, tag_ids, tags: _tags, ...rest } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!customer_id) return NextResponse.json({ error: 'customer_id is required' }, { status: 400 })

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, closed_at: _cl, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_opportunities')
    .insert({
      name: name.trim(),
      customer_id,
      ...safeRest,
      created_by: appUser.id,
      status: safeRest.status ?? 'open',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Insert tags if provided
  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      tag_ids.map((tid: string) => ({ tag_id: tid, entity_type: 'opportunity', entity_id: data.id }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
