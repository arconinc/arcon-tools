import { NextRequest, NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { ALL_CATEGORIES } from '@/lib/task-constants'
import { validateTeamId } from '@/lib/team-assignment'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { taskAssigned, taskCompleted, taskUpdated, taskWaitingOnApproval, taskNeedsChanges } from '@/lib/notifications/registry'
import { isTransitionAllowed, computeTransitionPatch } from '@/lib/task-workflow'
import type { CrmTaskStatus } from '@/types'

const TRACKED_FIELDS = ['status', 'assigned_to', 'last_worked_by', 'team_id', 'department', 'priority', 'category', 'due_date', 'progress'] as const
const TASK_UPDATE_FIELDS = [
  'title',
  'assigned_to',
  'task_owner',
  'last_worked_by',
  'team_id',
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

function normalizeTaskAssignment(updates: Record<string, unknown>) {
  const normalized = { ...updates }

  if (
    'category' in normalized &&
    typeof normalized.category === 'string' &&
    normalized.category &&
    !(ALL_CATEGORIES as string[]).includes(normalized.category)
  ) {
    normalized.category = null
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
  const [commentsRes, historyRes, attachmentsRes, oppRes, custRes, vendRes, contRes, assignedUserRes, specRes, teamRes] = await Promise.all([
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
      ? adminClient.from('users').select('id, display_name, email, avatar_url, profile_image_url').eq('id', task.assigned_to).single()
      : Promise.resolve({ data: null }),
    adminClient
      .from('spec_samples')
      .select('id, item_name, status')
      .or(`linked_task_id.eq.${id},artwork_task_id.eq.${id}`)
      .limit(1)
      .maybeSingle(),
    task.team_id
      ? adminClient.from('groups').select('id, name, color').eq('id', task.team_id).single()
      : Promise.resolve({ data: null }),
  ])

  // Resolve created_by, last_worked_by, and delegators to display names
  const peopleIds = [...new Set([
    task.created_by,
    task.last_worked_by,
    ...(task.delegators ?? []),
  ].filter(Boolean))]
  let peopleMap: Record<string, { id: string; display_name: string; email?: string; avatar_url?: string | null; profile_image_url?: string | null }> = {}
  if (peopleIds.length > 0) {
    const { data: people } = await adminClient
      .from('users')
      .select('id, display_name, email, avatar_url, profile_image_url')
      .in('id', peopleIds)
    for (const u of people ?? []) peopleMap[u.id] = u
  }

  const createdUser = task.created_by ? (peopleMap[task.created_by] ?? null) : null
  const lastWorkedUser = task.last_worked_by ? (peopleMap[task.last_worked_by] ?? null) : null
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
    last_worked_user: lastWorkedUser,
    delegator_users: delegatorUsers,
    linked_spec: specRes.data ?? null,
    team: teamRes.data ?? null,
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

  const normalized = normalizeTaskAssignment(updates)
  const safeUpdates = normalized.updates

  if (safeUpdates.team_id && !(await validateTeamId(adminClient, safeUpdates.team_id as string))) {
    return NextResponse.json({ error: 'Invalid team' }, { status: 400 })
  }

  // Guided status workflow: validate the transition and compute the reassignment
  // it triggers (see src/lib/task-workflow.ts for the rules). This is the single
  // enforcement point — clients only ever send the target status, never assigned_to
  // alongside it; the server decides who the task goes to next.
  if ('status' in safeUpdates && safeUpdates.status !== current.status) {
    const fromStatus = current.status as CrmTaskStatus
    const toStatus = safeUpdates.status as CrmTaskStatus
    if (!isTransitionAllowed(fromStatus, toStatus)) {
      return NextResponse.json(
        { error: `Cannot move a task from "${fromStatus}" to "${toStatus}"` },
        { status: 400 }
      )
    }
    const reassignment = computeTransitionPatch(
      { assigned_to: current.assigned_to, created_by: current.created_by, last_worked_by: current.last_worked_by },
      fromStatus,
      toStatus,
      appUser.id
    )
    Object.assign(safeUpdates, reassignment)
  }

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
    const teamChanged =
      'team_id' in safeUpdates && data.team_id !== current.team_id
    const statusChanged = 'status' in safeUpdates && data.status !== current.status

    // When a status transition (waiting_on_approval / need_changes / completed) is what
    // moved assigned_to, that transition has its own dedicated notification below — don't
    // also fire the generic "assigned you a task" one for the same action, or the recipient
    // gets two emails for one click. Direct reassignment (no status change) is unaffected.
    if (newAssigneeChanged && !statusChanged && data.assigned_to && data.assigned_to !== appUser.id) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
          team_id: data.team_id ?? null,
          team_name: null,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          status: data.status ?? null,
          description: data.description ?? null,
          fanout_kind: 'user',
        },
        recipientSpec: { userId: data.assigned_to },
        suppressUserIds: [appUser.id],
      })
    } else if (teamChanged && !data.assigned_to && data.team_id) {
      const actor = await fetchActor(appUser.id)
      const { data: team } = await adminClient.from('groups').select('name').eq('id', data.team_id).single()
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
          team_id: data.team_id,
          team_name: team?.name ?? null,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          status: data.status ?? null,
          description: data.description ?? null,
          fanout_kind: 'team',
        },
        recipientSpec: { teamId: data.team_id },
        suppressUserIds: [appUser.id],
      })
    }

    // Notify the assignee when someone else updates the task (and it wasn't just a
    // reassignment or status transition — those have their own dedicated notifications below).
    const hasFieldChanges = historyInserts.length > 0
    const assigneeIsNotEditor = data.assigned_to && data.assigned_to !== appUser.id
    const wasReassignedAway = newAssigneeChanged && data.assigned_to !== current.assigned_to
    if (hasFieldChanges && assigneeIsNotEditor && !wasReassignedAway && !statusChanged) {
      const actor = await fetchActor(appUser.id)
      const changedFields = historyInserts.map((h) => h.field_changed)
      await dispatchNotification({
        definition: taskUpdated,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
          changed_fields: changedFields,
        },
        recipientSpec: { userId: data.assigned_to },
        suppressUserIds: [appUser.id],
      })
    }

    // Notify the requestor when a task is sent to them for review
    const statusChangedToWaitingOnApproval = statusChanged && data.status === 'waiting_on_approval'
    if (statusChangedToWaitingOnApproval && current.created_by && current.created_by !== appUser.id) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskWaitingOnApproval,
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

    // Notify the reassigned worker when a task is sent back for changes
    const statusChangedToNeedChanges = statusChanged && data.status === 'need_changes'
    if (statusChangedToNeedChanges && data.assigned_to && data.assigned_to !== appUser.id) {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: taskNeedsChanges,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
        },
        recipientSpec: { userId: data.assigned_to },
        suppressUserIds: [appUser.id],
      })
    }

    // Notify the task creator when someone else marks the task complete directly
    const statusChangedToCompleted = statusChanged && data.status === 'completed'
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

    // Waiting on Approval -> Complete: the requestor completed it themselves, so
    // notify the person who actually did the work instead of the requestor.
    const completedFromApproval = statusChangedToCompleted && current.status === 'waiting_on_approval'
    if (completedFromApproval && current.last_worked_by && current.last_worked_by !== appUser.id) {
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
        recipientSpec: { userId: current.last_worked_by },
        suppressUserIds: [appUser.id],
      })
    }
  } catch (err) {
    console.error('[notifications] task PATCH dispatch failed:', err)
    Sentry.captureException(err)
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
