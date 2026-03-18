import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

const TRACKED_FIELDS = ['status', 'assigned_to', 'priority', 'category', 'due_date', 'progress'] as const

// GET /api/crm/tasks/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: task, error } = await adminClient
    .from('crm_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch all related data in parallel
  const [commentsRes, historyRes, oppRes, custRes, vendRes, contRes, assignedUserRes] = await Promise.all([
    adminClient
      .from('crm_task_comments')
      .select('*, crm_comment_attachments(*)')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
    adminClient
      .from('crm_task_history')
      .select('*')
      .eq('task_id', id)
      .order('changed_at', { ascending: true }),
    task.opportunity_id
      ? adminClient.from('crm_opportunities').select('id, name').eq('id', task.opportunity_id).single()
      : Promise.resolve({ data: null }),
    task.customer_id
      ? adminClient.from('crm_customers').select('id, name').eq('id', task.customer_id).single()
      : Promise.resolve({ data: null }),
    task.vendor_id
      ? adminClient.from('crm_vendors').select('id, name').eq('id', task.vendor_id).single()
      : Promise.resolve({ data: null }),
    task.contact_id
      ? adminClient.from('crm_contacts').select('id, first_name, last_name').eq('id', task.contact_id).single()
      : Promise.resolve({ data: null }),
    task.assigned_to
      ? adminClient.from('users').select('id, display_name, email').eq('id', task.assigned_to).single()
      : Promise.resolve({ data: null }),
  ])

  // Enrich comments with user info
  const commentRows = commentsRes.data ?? []
  const commentUserIds = [...new Set(commentRows.map((c: any) => c.user_id).filter(Boolean))]
  let commentUsersMap: Record<string, { display_name: string }> = {}
  if (commentUserIds.length > 0) {
    const { data: cUsers } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', commentUserIds)
    for (const u of cUsers ?? []) commentUsersMap[u.id] = { display_name: u.display_name }
  }

  const enrichedComments = commentRows.map((c: any) => ({
    ...c,
    attachments: c.crm_comment_attachments ?? [],
    user: commentUsersMap[c.user_id] ?? { display_name: 'Unknown' },
  }))

  // Enrich history with user names
  const historyRows = historyRes.data ?? []
  const histUserIds = [...new Set(historyRows.map((h: any) => h.user_id).filter(Boolean))]
  let histUsersMap: Record<string, string> = {}
  if (histUserIds.length > 0) {
    const { data: hUsers } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', histUserIds)
    for (const u of hUsers ?? []) histUsersMap[u.id] = u.display_name
  }

  const enrichedHistory = historyRows.map((h: any) => ({
    ...h,
    user: { id: h.user_id, display_name: histUsersMap[h.user_id] ?? 'Unknown' },
  }))

  const contact = contRes.data
  return NextResponse.json({
    ...task,
    comments: enrichedComments,
    history: enrichedHistory,
    opportunity: oppRes.data ?? null,
    customer: custRes.data ?? null,
    vendor: vendRes.data ?? null,
    contact: contact ? { id: contact.id, first_name: contact.first_name, last_name: contact.last_name } : null,
    assigned_user: assignedUserRes.data ?? null,
  })
}

// PATCH /api/crm/tasks/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  const { id: _id, created_at: _ca, created_by: _cb, ...updates } = body

  const adminClient = createAdminClient()

  // Fetch current record to compare
  const { data: current, error: fetchErr } = await adminClient
    .from('crm_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Insert history rows for each tracked field that changed
  const historyInserts = TRACKED_FIELDS
    .filter((field) => field in updates && String(updates[field]) !== String(current[field]))
    .map((field) => ({
      task_id: id,
      user_id: appUser.id,
      field_changed: field,
      old_value: current[field] != null ? String(current[field]) : null,
      new_value: updates[field] != null ? String(updates[field]) : null,
      changed_at: new Date().toISOString(),
    }))

  if (historyInserts.length > 0) {
    await adminClient.from('crm_task_history').insert(historyInserts)
  }

  const { data, error } = await adminClient
    .from('crm_tasks')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/crm/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  // Owners or admins can delete
  const { data: task } = await adminClient
    .from('crm_tasks')
    .select('created_by, task_owner')
    .eq('id', id)
    .single()

  if (task && !appUser.is_admin && task.created_by !== appUser.id && task.task_owner !== appUser.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.from('crm_tasks').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
