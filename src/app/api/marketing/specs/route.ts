import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { taskAssigned } from '@/lib/notifications/registry'

// GET /api/marketing/specs?customer_id=&csr_id=&status=&vendor=&month=YYYY-MM&page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customer_id')
  const csrId = searchParams.get('csr_id')
  const status = searchParams.get('status')
  const vendor = searchParams.get('vendor')
  const month = searchParams.get('month') // YYYY-MM
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const adminClient = createAdminClient()

  const applyFilters = (q: any) => {
    if (customerId) q = q.eq('customer_id', customerId)
    if (csrId) q = q.eq('assigned_csr_id', csrId)
    if (status) q = q.eq('status', status)
    if (vendor) q = q.ilike('vendor', `%${vendor}%`)
    if (month) {
      // Filter by date_sent within the given month, falling back to created_at
      const start = `${month}-01`
      const end = `${month}-31`
      q = q.gte('date_sent', start).lte('date_sent', end)
    }
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('spec_samples').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('spec_samples')
        .select('*')
        .order('date_sent', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    ).range(from, to),
  ])

  if (dataRes.error) return NextResponse.json({ error: dataRes.error.message }, { status: 500 })

  const rows: any[] = dataRes.data ?? []
  const total = countRes.count ?? 0

  // Enrich with customer/contact/user names
  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean))]
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))]
  const userIds = [...new Set([
    ...rows.map((r) => r.assigned_csr_id),
    ...rows.map((r) => r.sales_rep_id),
  ].filter(Boolean))]

  const [custRes, contactRes, usersRes] = await Promise.all([
    customerIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? adminClient.from('crm_contacts').select('id, first_name, last_name').in('id', contactIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
  ])

  const custMap: Record<string, string> = {}
  for (const c of custRes.data ?? []) custMap[c.id] = c.name

  const contactMap: Record<string, string> = {}
  for (const c of contactRes.data ?? []) contactMap[c.id] = `${c.first_name} ${c.last_name}`.trim()

  const userMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) userMap[u.id] = u.display_name

  const enriched = rows.map((r) => ({
    ...r,
    customer_name: r.customer_id ? (custMap[r.customer_id] ?? null) : null,
    contact_name: r.contact_id ? (contactMap[r.contact_id] ?? null) : null,
    csr_name: r.assigned_csr_id ? (userMap[r.assigned_csr_id] ?? null) : null,
    sales_rep_name: r.sales_rep_id ? (userMap[r.sales_rep_id] ?? null) : null,
  }))

  return NextResponse.json({ specs: enriched, total, page, limit })
}

// POST /api/marketing/specs
// Creates one or more spec_samples rows (multi-item wizard support).
// Body: { specs: SpecSamplePayload[], create_task?: boolean }
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { specs: specsPayload, create_task } = body

  if (!Array.isArray(specsPayload) || specsPayload.length === 0) {
    return NextResponse.json({ error: 'specs array is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Validate required fields
  for (const spec of specsPayload) {
    if (!spec.item_name?.trim()) {
      return NextResponse.json({ error: 'item_name is required for each spec' }, { status: 400 })
    }
  }

  const created: any[] = []

  for (const spec of specsPayload) {
    const {
      id: _id, created_at: _ca, updated_at: _ua,
      customer_name: _cn, contact_name: _con, csr_name: _csrn, sales_rep_name: _srn,
      follow_up_date, follow_up_notes, assigned_csr_id,
      ...rest
    } = spec

    // Create the spec record
    const { data: newSpec, error: specErr } = await adminClient
      .from('spec_samples')
      .insert({
        ...rest,
        item_name: spec.item_name.trim(),
        assigned_csr_id: assigned_csr_id ?? appUser.id,
        follow_up_date: follow_up_date || null,
        follow_up_notes: follow_up_notes ?? null,
        order_date: rest.order_date || null,
        date_sent: rest.date_sent || null,
      })
      .select()
      .single()

    if (specErr || !newSpec) {
      return NextResponse.json({ error: specErr?.message ?? 'Insert failed' }, { status: 500 })
    }

    // Optionally create a linked CRM task
    if (create_task && follow_up_date) {
      const csrId = assigned_csr_id ?? appUser.id
      const custRes = spec.customer_id
        ? await adminClient.from('crm_customers').select('name').eq('id', spec.customer_id).single()
        : null
      const customerName = custRes?.data?.name ?? 'Customer'

      const { data: task, error: taskErr } = await adminClient
        .from('crm_tasks')
        .insert({
          title: `Follow up: ${customerName} — ${spec.item_name}`,
          assigned_to: csrId,
          task_owner: appUser.id,
          department: 'CRM',
          category: 'CSR To Do',
          priority: 'medium',
          due_date: follow_up_date,
          status: 'not_started',
          progress: 0,
          description: follow_up_notes ?? null,
          customer_id: spec.customer_id ?? null,
          delegators: [],
          sort_order: 0,
          created_by: appUser.id,
        })
        .select()
        .single()

      if (!taskErr && task) {
        // Link task back to spec
        await adminClient
          .from('spec_samples')
          .update({ linked_task_id: task.id })
          .eq('id', newSpec.id)

        newSpec.linked_task_id = task.id

        // Notify assigned CSR if different from actor
        if (csrId !== appUser.id) {
          const actorRes = await adminClient.from('users').select('display_name').eq('id', appUser.id).single()
          await dispatchNotification({
            definition: taskAssigned,
            payload: {
              task_id: task.id,
              task_title: task.title,
              actor_id: appUser.id,
              actor_name: actorRes.data?.display_name ?? 'Someone',
              department: 'CRM',
              due_date: follow_up_date,
              priority: 'medium',
              status: 'not_started',
              description: follow_up_notes ?? null,
              fanout_kind: 'user',
            },
            recipientSpec: { userId: csrId },
            suppressUserIds: [appUser.id],
          })
        }
      }
    }

    created.push(newSpec)
  }

  return NextResponse.json(created, { status: 201 })
}
