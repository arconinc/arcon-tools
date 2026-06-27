import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { supplierAddedToAturian } from '@/lib/notifications/registry'
import { resolveAturianAssignee } from '@/lib/crm/aturian-assignees'

// GET /api/marketing/vendors?search=&tag_id=&page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const tagIds = (searchParams.get('tag_id') ?? '').split(',').filter(Boolean)
  const specialty = searchParams.get('specialty')?.trim()
  const productLine = searchParams.get('product_line')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const adminClient = createAdminClient()

  let tagFilterIds: string[] | null = null
  if (tagIds.length > 0) {
    const { data: tagRows } = await adminClient
      .from('crm_entity_tags')
      .select('entity_id')
      .in('tag_id', tagIds)
      .eq('entity_type', 'vendor')
    tagFilterIds = [...new Set((tagRows ?? []).map((r: any) => r.entity_id))]
    if (tagFilterIds.length === 0) return NextResponse.json({ vendors: [], total: 0, page, limit })
  }

  const applyFilters = (q: any) => {
    if (search) q = q.ilike('name', `%${search}%`)
    if (specialty) q = q.eq('specialty', specialty)
    if (productLine) q = q.eq('product_line', productLine)
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

// POST /api/marketing/vendors
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, tag_ids, tags: _tags, add_to_aturian, ...rest } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_vendors')
    .insert({ name: name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allTagIds = Array.isArray(tag_ids) ? [...tag_ids] : []

  if (add_to_aturian) {
    const { data: actorUser } = await adminClient
      .from('users')
      .select('display_name, email')
      .eq('id', appUser.id)
      .single()
    const requestorName = actorUser?.display_name ?? actorUser?.email ?? 'Unknown'

    // Find or create "Add to Aturian" tag
    let { data: aturianTag } = await adminClient
      .from('crm_tags')
      .select('id')
      .ilike('name', 'add to aturian')
      .single()
    if (!aturianTag) {
      const { data: newTag } = await adminClient
        .from('crm_tags')
        .insert({ name: 'Add to Aturian', color: '#7c3aed' })
        .select('id')
        .single()
      aturianTag = newTag
    }
    if (aturianTag && !allTagIds.includes(aturianTag.id)) {
      allTagIds.push(aturianTag.id)
    }

    // Create Accounting task
    const descLines = [
      `Company: ${name.trim()}`,
      data.phone ? `Phone: ${data.phone}` : null,
      data.ap_email ? `AP Email: ${data.ap_email}` : null,
      data.orders_email ? `Orders Email: ${data.orders_email}` : null,
      data.billing_address1 ? `Billing Address: ${[data.billing_address1, data.billing_city, data.billing_state, data.billing_zip].filter(Boolean).join(', ')}` : null,
      data.sales_rep_name ? `Sales Rep: ${data.sales_rep_name}${data.sales_rep_email ? ` (${data.sales_rep_email})` : ''}` : null,
    ].filter(Boolean).join('\n')
    const assignee = await resolveAturianAssignee(adminClient, 'supplier')

    const { data: task } = await adminClient
      .from('crm_tasks')
      .insert({
        title: `Add ${name.trim()} to Aturian`,
        department: 'Accounting',
        assigned_to: assignee?.id ?? null,
        description: descLines || null,
        status: 'not_started',
        priority: 'medium',
        progress: 0,
        created_by: appUser.id,
        task_owner: appUser.id,
      })
      .select()
      .single()

    if (task) {
      try {
        await dispatchNotification({
          definition: supplierAddedToAturian,
          payload: {
            vendor_id: data.id,
            vendor_name: name.trim(),
            requestor_name: requestorName,
            ap_email: data.ap_email ?? null,
            phone: data.phone ?? null,
            orders_email: data.orders_email ?? null,
          },
          recipientSpec: assignee ? { userId: assignee.id } : { department: 'Accounting' },
          suppressUserIds: [appUser.id],
        })
      } catch (err) {
        console.error('[vendors/POST] aturian notification failed:', err)
      }
    }
  }

  if (allTagIds.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      allTagIds.map((tid: string) => ({ tag_id: tid, entity_type: 'vendor', entity_id: data.id }))
    )
  }

  return NextResponse.json(data, { status: 201 })
}
