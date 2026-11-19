import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALL_CATEGORIES } from '@/lib/task-constants'
import { validateTeamId } from '@/lib/team-assignment'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { taskAssigned, taskCompleted, taskUpdated, taskWaitingOnApproval, taskNeedsChanges, taskCommentAdded } from '@/lib/notifications/registry'
import { TASK_STATUS_LABELS } from '@/lib/task-workflow'
import { stripReadOnly } from '@/lib/api/sanitize'
import { badRequest, serverError, created } from '@/lib/api/respond'
import { stripHtml } from '@/lib/news-utils'
import type { CrmTaskStatus } from '@/types'

// Shared task write logic. The REST routes and the MCP tools both call these,
// so history rows, delegation, and notifications live in one place.
export interface TaskActor {
  id: string
  is_admin: boolean
}

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


function normalizeCreateTaskAssignment(task: Record<string, unknown>) {
  const normalized = { ...task }

  if (
    typeof normalized.category === 'string' &&
    normalized.category &&
    !(ALL_CATEGORIES as string[]).includes(normalized.category)
  ) {
    normalized.category = null
  }

  return { task: normalized }
}

export async function updateTask(appUser: TaskActor, id: string, body: Record<string, unknown>) {
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

    // assigned_to only ever changes via the manual assignee dropdown — status
    // changes never move the task.
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

    // Status changes never move the task — notify both the requestor and the
    // assignee (minus whoever made the change) so neither loses track of it.
    if (statusChanged) {
      const recipientIds = [...new Set([current.created_by, data.assigned_to])]
        .filter((uid): uid is string => !!uid && uid !== appUser.id)
      if (recipientIds.length > 0) {
        const actor = await fetchActor(appUser.id)
        const payload = {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
        }
        const recipientSpec = { userIds: recipientIds }
        const suppressUserIds = [appUser.id]
        if (data.status === 'waiting_on_approval') {
          await dispatchNotification({ definition: taskWaitingOnApproval, payload, recipientSpec, suppressUserIds })
        } else if (data.status === 'in_progress' && current.status === 'waiting_on_approval') {
          await dispatchNotification({ definition: taskNeedsChanges, payload, recipientSpec, suppressUserIds })
        } else if (data.status === 'completed') {
          await dispatchNotification({ definition: taskCompleted, payload, recipientSpec, suppressUserIds })
        } else {
          const statusLabel = TASK_STATUS_LABELS[data.status as CrmTaskStatus] ?? data.status
          await dispatchNotification({
            definition: taskUpdated,
            payload: { ...payload, changed_fields: [`status → ${statusLabel}`] },
            recipientSpec,
            suppressUserIds,
          })
        }
      }
    }
  } catch (err) {
    console.error('[notifications] task PATCH dispatch failed:', err)
    Sentry.captureException(err)
  }

  return NextResponse.json(data)
}


export async function createTask(appUser: TaskActor, body: Record<string, any>) {
  const { title, ...rest } = body
  if (!title?.trim()) return badRequest('Title is required')

  const safeRest = stripReadOnly(rest, ['assigned_user_name', 'linked_to_name', 'linked_to_type'])

  const normalized = normalizeCreateTaskAssignment(safeRest)

  const adminClient = createAdminClient()

  if (normalized.task.team_id && !(await validateTeamId(adminClient, normalized.task.team_id as string))) {
    return badRequest('Invalid team')
  }

  const { data, error } = await adminClient
    .from('crm_tasks')
    .insert({
      title: title.trim(),
      ...normalized.task,
      created_by: appUser.id,
      task_owner: normalized.task.task_owner ?? appUser.id,
      // Only default to the creator when the field is omitted entirely —
      // an explicit `null` (e.g. assigning to a team with no individual
      // picked yet) must stay unassigned, not silently become "me".
      assigned_to: 'assigned_to' in normalized.task ? normalized.task.assigned_to : appUser.id,
      status: normalized.task.status ?? 'not_started',
      priority: normalized.task.priority ?? 'medium',
      progress: normalized.task.progress ?? 0,
    })
    .select()
    .single()

  if (error) return serverError(error.message)

  // Fire task_assigned notification. Wrapped in try/catch so a notification
  // failure (or missing migration) never blocks the task creation response.
  try {
    const isUserAssigned = !!data.assigned_to && data.assigned_to !== appUser.id
    const isTeamOnly = !data.assigned_to && !!data.team_id
    if (isUserAssigned || isTeamOnly) {
      const actor = await fetchActor(appUser.id)
      let teamName: string | null = null
      if (isTeamOnly) {
        const { data: team } = await adminClient.from('groups').select('name').eq('id', data.team_id).single()
        teamName = team?.name ?? null
      }
      await dispatchNotification({
        definition: taskAssigned,
        payload: {
          task_id: data.id,
          task_title: data.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          department: data.department ?? null,
          team_id: data.team_id ?? null,
          team_name: teamName,
          due_date: data.due_date ?? null,
          priority: data.priority ?? null,
          status: data.status ?? null,
          description: data.description ?? null,
          fanout_kind: isTeamOnly ? 'team' : 'user',
        },
        recipientSpec: isTeamOnly
          ? { teamId: data.team_id }
          : { userId: data.assigned_to },
        suppressUserIds: [appUser.id],
      })
    }
  } catch (err) {
    console.error('[notifications] task POST dispatch failed:', err)
  }

  return created(data)
}


export async function addTaskComment(appUser: TaskActor, taskId: string, body: Record<string, any>) {
  const { comment, parent_comment_id } = body

  // Text is optional here — the conversation thread also posts "attach only"
  // replies (files with no message), which upload to this comment row right
  // after creation. Empty string is a valid comment body.
  if (typeof comment !== 'string') return NextResponse.json({ error: 'Comment text is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: task, error: taskError } = await adminClient
    .from('crm_tasks')
    .select('id, title, assigned_to, created_by, department')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  // A reply can target any existing message, but the thread only renders one
  // level of nesting — so a reply-to-a-reply is folded onto its top-level
  // ancestor here, keeping the stored tree shallow and the UI simple.
  let resolvedParentId: string | null = null
  if (typeof parent_comment_id === 'string' && parent_comment_id) {
    const { data: parent } = await adminClient
      .from('crm_task_comments')
      .select('id, task_id, parent_comment_id')
      .eq('id', parent_comment_id)
      .single()
    if (!parent || parent.task_id !== taskId) {
      return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 })
    }
    resolvedParentId = parent.parent_comment_id ?? parent.id
  }

  const { data, error } = await adminClient
    .from('crm_task_comments')
    .insert({
      task_id: taskId,
      user_id: appUser.id,
      comment: comment.trim(),
      parent_comment_id: resolvedParentId,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Comments never reassign the task — notify both the requestor and the
  // assignee (minus the commenter) on every message.
  try {
    const recipientIds = [...new Set([task.created_by, task.assigned_to])]
      .filter((uid): uid is string => !!uid && uid !== appUser.id)
    if (recipientIds.length > 0) {
      const actor = await fetchActor(appUser.id)
      const { data: commentRows } = await adminClient
        .from('crm_task_comments')
        .select('comment, created_at, user_id')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      const commentUserIds = [...new Set((commentRows ?? []).map((c: any) => c.user_id).filter(Boolean))]
      const commentUsersMap: Record<string, string> = {}
      if (commentUserIds.length > 0) {
        const { data: commentUsers } = await adminClient
          .from('users')
          .select('id, display_name')
          .in('id', commentUserIds)
        for (const u of commentUsers ?? []) commentUsersMap[u.id] = u.display_name
      }

      await dispatchNotification({
        definition: taskCommentAdded,
        payload: {
          task_id: taskId,
          task_title: task.title,
          actor_id: appUser.id,
          actor_name: actor.display_name,
          comment_preview: stripHtml(comment).trim() ? stripHtml(comment).trim().slice(0, 120) : 'Added an attachment',
          comments: (commentRows ?? []).map((c: any) => ({
            author_name: commentUsersMap[c.user_id] ?? 'Unknown',
            comment: c.comment,
            created_at: c.created_at,
          })),
          department: task.department ?? null,
        },
        recipientSpec: { userIds: recipientIds },
        suppressUserIds: [appUser.id],
      })
    }
  } catch (err) {
    console.error('[notifications] task comment dispatch failed:', err)
    Sentry.captureException(err)
  }

  return NextResponse.json(data, { status: 201 })
}
