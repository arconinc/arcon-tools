import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { taskCommentAdded } from '@/lib/notifications/registry'

// GET /api/marketing/tasks/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const adminClient = createAdminClient()

  const { data: comments, error } = await adminClient
    .from('crm_task_comments')
    .select('*, crm_comment_attachments(*)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = comments ?? []
  const userIds = [...new Set(rows.map((c: any) => c.user_id).filter(Boolean))]
  let usersMap: Record<string, { display_name: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', userIds)
    for (const u of users ?? []) usersMap[u.id] = { display_name: u.display_name }
  }

  const enriched = rows.map((c: any) => ({
    ...c,
    attachments: c.crm_comment_attachments ?? [],
    user: usersMap[c.user_id] ?? { display_name: 'Unknown' },
  }))

  return NextResponse.json(enriched)
}

// POST /api/marketing/tasks/[id]/comments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const body = await req.json()
  const { comment, reassignToCreator } = body

  if (!comment?.trim()) return NextResponse.json({ error: 'Comment text is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: task, error: taskError } = await adminClient
    .from('crm_tasks')
    .select('id, title, assigned_to, created_by, department, delegators')
    .eq('id', taskId)
    .single()

  if (taskError || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const shouldReassignToCreator = reassignToCreator === true
  if (shouldReassignToCreator && (!task.created_by || task.assigned_to !== appUser.id || task.created_by === appUser.id)) {
    return NextResponse.json({ error: 'This task cannot be reassigned back to its assigner.' }, { status: 400 })
  }

  const { data, error } = await adminClient
    .from('crm_task_comments')
    .insert({
      task_id: taskId,
      user_id: appUser.id,
      comment: comment.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (shouldReassignToCreator && task.created_by && task.assigned_to !== task.created_by) {
    const changedAt = new Date().toISOString()
    const { error: reassignError } = await adminClient
      .from('crm_tasks')
      .update({
        assigned_to: task.created_by,
        delegators: task.assigned_to
          ? [...new Set([...(task.delegators ?? []), task.assigned_to])]
          : task.delegators,
        updated_at: changedAt,
      })
      .eq('id', taskId)

    if (reassignError) {
      return NextResponse.json({ error: reassignError.message }, { status: 500 })
    }

    await adminClient.from('crm_task_history').insert({
      task_id: taskId,
      user_id: appUser.id,
      field_changed: 'assigned_to',
      old_value: task.assigned_to,
      new_value: task.created_by,
      changed_at: changedAt,
    })
  }

  // Notify the person who assigned the task when someone else adds a comment.
  try {
    if (task.created_by && task.created_by !== appUser.id) {
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
          comment_preview: comment.trim().slice(0, 120),
          comments: (commentRows ?? []).map((c: any) => ({
            author_name: commentUsersMap[c.user_id] ?? 'Unknown',
            comment: c.comment,
            created_at: c.created_at,
          })),
          department: task.department ?? null,
        },
        recipientSpec: { userId: task.created_by },
        suppressUserIds: [appUser.id],
      })
    }
  } catch (err) {
    console.error('[notifications] task comment dispatch failed:', err)
  }

  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/marketing/tasks/[id]/comments/[cid]  ← handled in sub-route
