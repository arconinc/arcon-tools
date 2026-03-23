import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/contacts?search=&customer_id=&vendor_id=&type=&tag_id=&page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const customerId = searchParams.get('customer_id')
  const vendorId = searchParams.get('vendor_id')
  const type = searchParams.get('type')
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
      .eq('entity_type', 'contact')
    tagFilterIds = (tagRows ?? []).map((r: any) => r.entity_id)
    if (tagFilterIds.length === 0) return NextResponse.json({ contacts: [], total: 0, page, limit })
  }

  const applyFilters = (q: any) => {
    if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
    if (customerId) q = q.eq('customer_id', customerId)
    if (vendorId) q = q.eq('vendor_id', vendorId)
    if (type) q = q.eq('type_of_contact', type)
    if (tagFilterIds) q = q.in('id', tagFilterIds)
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('crm_contacts').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('crm_contacts')
        .select('id, first_name, last_name, title, email, phone, type_of_contact, customer_id, vendor_id, created_at, updated_at')
        .order('last_name')
        .order('first_name')
    ).range(from, to),
  ])

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 })

  const total = countRes.count ?? 0
  const contacts = (dataRes.data as any[]) ?? []
  const customerIds = [...new Set(contacts.map((c: any) => c.customer_id).filter(Boolean))]
  const vendorIds2 = [...new Set(contacts.map((c: any) => c.vendor_id).filter(Boolean))]
  const contactIds = contacts.map((c: any) => c.id)

  const [customersRes, vendorsRes, entityTagsRes] = await Promise.all([
    customerIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
    vendorIds2.length > 0
      ? adminClient.from('crm_vendors').select('id, name').in('id', vendorIds2)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? adminClient
          .from('crm_entity_tags')
          .select('entity_id, crm_tags(id, name, color)')
          .eq('entity_type', 'contact')
          .in('entity_id', contactIds)
      : Promise.resolve({ data: [] }),
  ])

  const customerMap: Record<string, string> = {}
  for (const c of customersRes.data ?? []) customerMap[c.id] = c.name
  const vendorMap: Record<string, string> = {}
  for (const v of vendorsRes.data ?? []) vendorMap[v.id] = v.name

  const tagsMap: Record<string, any[]> = {}
  for (const row of entityTagsRes.data ?? []) {
    const eid = (row as any).entity_id
    const tag = (row as any).crm_tags
    if (!tagsMap[eid]) tagsMap[eid] = []
    if (tag) tagsMap[eid].push(tag)
  }

  const enriched = contacts.map((c: any) => ({
    ...c,
    customer_name: c.customer_id ? (customerMap[c.customer_id] ?? null) : null,
    vendor_name: c.vendor_id ? (vendorMap[c.vendor_id] ?? null) : null,
    tags: tagsMap[c.id] ?? [],
  }))

  return NextResponse.json({ contacts: enriched, total, page, limit })
}

// POST /api/crm/contacts
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { first_name, last_name, tag_ids, tags: _tags, ...rest } = body
  if (!first_name?.trim() || !last_name?.trim()) {
    return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
  }

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_contacts')
    .insert({ first_name: first_name.trim(), last_name: last_name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      tag_ids.map((tid: string) => ({ tag_id: tid, entity_type: 'contact', entity_id: data.id }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
