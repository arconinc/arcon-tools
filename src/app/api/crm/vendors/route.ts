import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/vendors?search=&tag_id=&page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const tagId = searchParams.get('tag_id')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const adminClient = createAdminClient()

  let tagFilterIds: string[] | null = null
  if (tagId) {
    const { data: tagRows } = await adminClient
      .from('crm_entity_tags')
      .select('entity_id')
      .eq('tag_id', tagId)
      .eq('entity_type', 'vendor')
    tagFilterIds = (tagRows ?? []).map((r: any) => r.entity_id)
    if (tagFilterIds.length === 0) return NextResponse.json({ vendors: [], total: 0, page, limit })
  }

  const applyFilters = (q: any) => {
    if (search) q = q.ilike('name', `%${search}%`)
    if (tagFilterIds) q = q.in('id', tagFilterIds)
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('crm_vendors').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('crm_vendors')
        .select('id, name, phone, website, product_line, specialty, premier_group_member, logo_url, created_at, updated_at')
        .order('name')
    ).range(from, to),
  ])

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 })

  const total = countRes.count ?? 0
  const rows = (dataRes.data as any[]) ?? []
  const vendorIds = rows.map((v: any) => v.id)

  const entityTagsRes = vendorIds.length > 0
    ? await adminClient
        .from('crm_entity_tags')
        .select('entity_id, crm_tags(id, name, color)')
        .eq('entity_type', 'vendor')
        .in('entity_id', vendorIds)
    : { data: [] }

  const tagsMap: Record<string, any[]> = {}
  for (const row of entityTagsRes.data ?? []) {
    const eid = (row as any).entity_id
    const tag = (row as any).crm_tags
    if (!tagsMap[eid]) tagsMap[eid] = []
    if (tag) tagsMap[eid].push(tag)
  }

  return NextResponse.json({ vendors: rows.map((v: any) => ({ ...v, tags: tagsMap[v.id] ?? [] })), total, page, limit })
}

// POST /api/crm/vendors
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, tag_ids, tags: _tags, ...rest } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_vendors')
    .insert({ name: name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      tag_ids.map((tid: string) => ({ tag_id: tid, entity_type: 'vendor', entity_id: data.id }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
