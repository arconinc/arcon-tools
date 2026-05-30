import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { DEPARTMENTS, getDepartmentForTaskCategory } from '@/lib/task-constants'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { taskAssigned, taskCompleted } from '@/lib/notifications/registry'

const TRACKED_FIELDS = ['status', 'assigned_to', 'department', 'priority', 'category', 'due_date', 'progress'] as const
const TASK_UPDATE_FIELDS = [
  'title',
  'assigned_to',
  'task_owner',
  'department',
  'category',
  'priority',
  'due_date',
  'status',
  'progress',
  'description',
  'opportunity_id',
  'customer_id',
  'vendor_id',
  'contact_id',
  'store_id',
  'sort_order',
] as const

const TASK_UPDATE_FIELD_SET = new Set<string>(TASK_UPDATE_FIELDS)

function pickTaskUpdates(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    if (TASK_UPDATE_FIELD_SET.has(key)) updates[key] = value
  }
  return updates
}

function normalizeTaskAssignment(updates: Record<string, unknown>, current: Record<string, unknown>) {
  const normalized = { ...updates }

  if (
    'department' in normalized &&
    typeof normalized.department === 'string' &&
    !(DEPARTMENTS as string[]).includes(normalized.department)
  ) {
    return { error: 'Invalid department' }
  }

  if ('category' in normalized && typeof normalized.category === 'string' && normalized.category) {
    const categoryDepartment = getDepartmentForTaskCategory(normalized.category)
    if (!categoryDepartment) return { error: 'Invalid category' }
    if (normalized.department && normalized.department !== categoryDepartment) {
      return { error: 'Category does not belong to selected department' }
    }
    normalized.department = categoryDepartment
  }

  if (
    'department' in normalized &&
    !('category' in normalized) &&
    typeof current.category === 'string'
  ) {
    const currentCategoryDepartment = getDepartmentForTaskCategory(current.category)
    if (normalized.department !== currentCategoryDepartment) normalized.category = null
  }

  return { updates: normalized }
}

// GET /api/marketing/tasks/[id]
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
  const [commentsRes, historyRes, attachmentsRes, oppRes, custRes, vendRes, contRes, assignedUserRes] = await Promise.all([
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
    adminClient
      .from('crm_task_attachments')
      .select('*')
      .eq('task_id', id)
      .order('created_at', { ascending: true }),
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

  // Resolve created_by and delegators to display names
  const peopleIds = [...new Set([
    task.created_by,
    ...(task.delegators ?? []),
  ].filter(Boolean))]
  let peopleMap: Record<string, { id: string; display_name: string }> = {}
  if (peopleIds.length > 0) {
    const { data: people } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', peopleIds)
    for (const u of people ?? []) peopleMap[u.id] = u
  }

  const createdUser = task.created_by ? (peopleMap[task.created_by] ?? null) : null
  const delegatorUsers = (task.delegators ?? [])
    .map((uid: string) => peopleMap[uid])
    .filter(Boolean)

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

  // Also collect user IDs from assigned_to field changes
  const assignedToUserIds = [...new Set(
    historyRows
      .filter((h: any) => h.field_changed === 'assigned_to')
      .flatMap((h: any) => [h.old_value, h.new_value])
      .filter(Boolean)
  )]
  let assignedUsersMap: Record<string, string> = {}
  if (assignedToUserIds.length > 0) {
    const { data: aUsers } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', assignedToUserIds)
    for (const u of aUsers ?? []) assignedUsersMap[u.id] = u.display_name
  }

  const enrichedHistory = historyRows.map((h: any) => ({
    ...h,
    user: { id: h.user_id, display_name: histUsersMap[h.user_id] ?? 'Unknown' },
    old_value: h.field_changed === 'assigned_to' && h.old_value ? (assignedUsersMap[h.old_value] ?? h.old_value) : h.old_value,
    new_value: h.field_changed === 'assigned_to' && h.new_value ? (assignedUsersMap[h.new_value] ?? h.new_value) : h.new_value,
  }))

  const contact = contRes.data
  return NextResponse.json({
    ...task,
    comments: enrichedComments,
    history: enrichedHistory,
    attachments: attachmentsRes.data ?? [],
    opportunity: oppRes.data ?? null,
    customer: custRes.data ?? null,
    vendor: vendRes.data ?? null,
    contact: contact ? { id: contact.id, first_name: contact.first_name, last_name: contact.last_name } : null,
    assigned_user: assignedUserRes.data ?? null,
    created_user: createdUser,
    delegator_users: delegatorUsers,
  })
}

// PATCH /api/marketing/tasks/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const updates = pickTaskUpdates(body)

  const adminClient = createAdminClient()

  // Fetch current record to compare
  const { data: current, error: fetchErr } = await adminClient
    .from('crm_tasks')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const normalized = normalizeTaskAssignment(updates, current)
  if ('error' in normalized) return NextResponse.json({ error: normalized.error }, { status: 400 })
  const safeUpdates = normalized.updates

  // Insert history rows for each tracked field that changed
  const historyInserts = TRACKED_FIELDS
    .filter((field) => field in safeUpdates && String(safeUpdates[field]) !== String(current[field]))
    .map((field) => ({
      task_id: id,
      user_id: appUser.id,
      field_changed: field,
      old_value: current[field] != null ? String(current[field]) : null,
      new_value: safeUpdates[field] != null ? String(safeUpdates[field]) : null,
      changed_at: new Date().toISOString(),
    }))

  if (historyInserts.length > 0) {
    await adminClient.from('crm_task_history').insert(historyInserts)
  }

  // Delegation tracking: when assigned_to changes, add the previous holder to delegators
  const finalUpdates: Record<string, unknown> = { ...safeUpdates, updated_at: new Date().toISOString() }
  if (
    'assigned_to' in safeUpdates &&
    safeUpdates.assigned_to !== current.assigned_to &&
    current.assigned_to
  ) {
    const existingDelegators: string[] = current.delegators ?? []
    if (!existingDelegators.includes(current.assigned_to)) {
      finalUpdates.delegators = [...existingDelegators, current.assigned_to]
    }
  }

  const { data, error } = await adminClient
    .from('crm_tasks')
    .update(finalUpdates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fire task_assigned notification on assignment changes. Wrapped in try/catch
  // so a notification failure never blocks the response.
  try {
    const newAssigneeChanged =
      'assigned_to' in safeUpdates && data.assigned_to !== current.assigned_to
    const deptChanged =
      'department' in safeUpdates && data.department !== current.department

    if (newAssigneeChanged && data.assigned_to && data.assigned_to !== appUser.id) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          status: data.status ?? null,
          description: data.description ?? null,
          fanout_kind: 'user',
        },
        recipientSpec: { userId: data.assigned_to },
        suppressUserIds: [appUser.id],
      })
    } else if (deptChanged && !data.assigned_to && data.department) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          status: data.status ?? null,
          description: data.description ?? null,
          fanout_kind: 'department',
        },
        recipientSpec: { department: data.department },
        suppressUserIds: [appUser.id],
      })
    }

    // Notify the task creator when someone else marks the task complete
    const statusChangedToCompleted =
      'status' in safeUpdates &&
      data.status === 'completed' &&
      current.status !== 'completed'
    if (statusChangedToCompleted && current.created_by && current.created_by !== appUser.id) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskCompleted,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
        },
        recipientSpec: { userId: current.created_by },
        suppressUserIds: [appUser.id],
      })
    }
  } catch (err) {
    console.error('[notifications] task PATCH dispatch failed:', err)
  }

  return NextResponse.json(data)
}

// DELETE /api/marketing/tasks/[id]
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
