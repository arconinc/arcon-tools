import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/customers?search=&status=&assigned_to=&tag_id=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assigned_to')
  const tagId = searchParams.get('tag_id')

  const adminClient = createAdminClient()

  // If filtering by tag, get matching entity IDs first
  let tagFilterIds: string[] | null = null
  if (tagId) {
    const { data: tagRows } = await adminClient
      .from('crm_entity_tags')
      .select('entity_id')
      .eq('tag_id', tagId)
      .eq('entity_type', 'customer')
    tagFilterIds = (tagRows ?? []).map((r: any) => r.entity_id)
    if (tagFilterIds.length === 0) return NextResponse.json([])
  }

  let query = adminClient
    .from('crm_customers')
    .select('id, name, client_status, phone, website, assigned_to, created_at, updated_at')
    .order('name')

  if (search) query = query.ilike('name', `%${search}%`)
  if (status) query = query.eq('client_status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (tagFilterIds) query = query.in('id', tagFilterIds)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = data ?? []
  const userIds = [...new Set(rows.map((c: any) => c.assigned_to).filter(Boolean))]
  const custIds = rows.map((c: any) => c.id)

  const [usersRes, entityTagsRes] = await Promise.all([
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    custIds.length > 0
      ? adminClient
          .from('crm_entity_tags')
          .select('entity_id, crm_tags(id, name, color)')
          .eq('entity_type', 'customer')
          .in('entity_id', custIds)
      : Promise.resolve({ data: [] }),
  ])

  const usersMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) usersMap[u.id] = u.display_name

  const tagsMap: Record<string, any[]> = {}
  for (const row of entityTagsRes.data ?? []) {
    const eid = (row as any).entity_id
    const tag = (row as any).crm_tags
    if (!tagsMap[eid]) tagsMap[eid] = []
    if (tag) tagsMap[eid].push(tag)
  }

  const enriched = rows.map((c: any) => ({
    ...c,
    assigned_user_name: c.assigned_to ? (usersMap[c.assigned_to] ?? null) : null,
    tags: tagsMap[c.id] ?? [],
  }))

  return NextResponse.json(enriched)
}

// POST /api/crm/customers
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, tag_ids, tags: _tags, ...rest } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_customers')
    .insert({ name: name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      tag_ids.map((tid: string) => ({ tag_id: tid, entity_type: 'customer', entity_id: data.id }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
