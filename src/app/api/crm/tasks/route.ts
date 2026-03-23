import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/tasks
// ?assigned_to=me|<uuid>  ?status=  ?category=  ?due_before=  ?opportunity_id=  ?customer_id=  ?vendor_id=  ?page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignedTo = searchParams.get('assigned_to')
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const dueBefore = searchParams.get('due_before')
  const opportunityId = searchParams.get('opportunity_id')
  const customerId = searchParams.get('customer_id')
  const vendorId = searchParams.get('vendor_id')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  // Resolve "me" to current user id
  const isMine = assignedTo === 'me'
  const resolvedAssignedTo = isMine ? appUser.id : assignedTo

  const adminClient = createAdminClient()

  const applyFilters = (q: any) => {
    if (resolvedAssignedTo) {
      if (isMine) {
        q = q.or(`assigned_to.eq.${resolvedAssignedTo},task_owner.eq.${resolvedAssignedTo}`)
      } else {
        q = q.eq('assigned_to', resolvedAssignedTo)
      }
    }
    if (status) {
      const statuses = status.split(',').map((s) => s.trim()).filter(Boolean)
      if (statuses.length === 1) {
        q = q.eq('status', statuses[0])
      } else if (statuses.length > 1) {
        q = q.in('status', statuses)
      }
    }
    if (category) q = q.eq('category', category)
    if (dueBefore) q = q.lte('due_date', dueBefore)
    if (opportunityId) q = q.eq('opportunity_id', opportunityId)
    if (customerId) q = q.eq('customer_id', customerId)
    if (vendorId) q = q.eq('vendor_id', vendorId)
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('crm_tasks').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('crm_tasks')
        .select('id, title, assigned_to, task_owner, category, priority, due_date, status, progress, opportunity_id, customer_id, vendor_id, contact_id, created_at, updated_at')
        .order('due_date', { ascending: true, nullsFirst: false })
    ).range(from, to),
  ])

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 })

  const total = countRes.count ?? 0
  const rows = (dataRes.data as any[]) ?? []

  // Batch-enrich: user names for assigned_to
  const userIds = [...new Set(rows.map((t: any) => t.assigned_to).filter(Boolean))]
  const oppIds = [...new Set(rows.map((t: any) => t.opportunity_id).filter(Boolean))]
  const custIds = [...new Set(rows.map((t: any) => t.customer_id).filter(Boolean))]
  const vendIds = [...new Set(rows.map((t: any) => t.vendor_id).filter(Boolean))]
  const contIds = [...new Set(rows.map((t: any) => t.contact_id).filter(Boolean))]

  const [usersRes, oppsRes, custsRes, vendsRes, contsRes] = await Promise.all([
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    oppIds.length > 0
      ? adminClient.from('crm_opportunities').select('id, name').in('id', oppIds)
      : Promise.resolve({ data: [] }),
    custIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', custIds)
      : Promise.resolve({ data: [] }),
    vendIds.length > 0
      ? adminClient.from('crm_vendors').select('id, name').in('id', vendIds)
      : Promise.resolve({ data: [] }),
    contIds.length > 0
      ? adminClient.from('crm_contacts').select('id, first_name, last_name').in('id', contIds)
      : Promise.resolve({ data: [] }),
  ])

  const usersMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) usersMap[u.id] = u.display_name
  const oppsMap: Record<string, string> = {}
  for (const o of oppsRes.data ?? []) oppsMap[o.id] = o.name
  const custsMap: Record<string, string> = {}
  for (const c of custsRes.data ?? []) custsMap[c.id] = c.name
  const vendsMap: Record<string, string> = {}
  for (const v of vendsRes.data ?? []) vendsMap[v.id] = v.name
  const contsMap: Record<string, string> = {}
  for (const c of contsRes.data ?? []) contsMap[c.id] = `${c.first_name} ${c.last_name}`

  const enriched = rows.map((t: any) => ({
    ...t,
    assigned_user_name: t.assigned_to ? (usersMap[t.assigned_to] ?? null) : null,
    linked_to_name: t.opportunity_id
      ? oppsMap[t.opportunity_id] ?? null
      : t.customer_id
      ? custsMap[t.customer_id] ?? null
      : t.vendor_id
      ? vendsMap[t.vendor_id] ?? null
      : t.contact_id
      ? contsMap[t.contact_id] ?? null
      : null,
    linked_to_type: t.opportunity_id
      ? 'opportunity'
      : t.customer_id
      ? 'customer'
      : t.vendor_id
      ? 'vendor'
      : t.contact_id
      ? 'contact'
      : null,
  }))

  return NextResponse.json({ tasks: enriched, total, page, limit })
}

// POST /api/crm/tasks
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, ...rest } = body
  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert({
      title: title.trim(),
      ...safeRest,
      created_by: appUser.id,
      task_owner: safeRest.task_owner ?? appUser.id,
      assigned_to: safeRest.assigned_to ?? appUser.id,
      status: safeRest.status ?? 'not_started',
      priority: safeRest.priority ?? 'medium',
      progress: safeRest.progress ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
