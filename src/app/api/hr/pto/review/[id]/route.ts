import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { ptoReviewed } from '@/lib/notifications/registry'
import { userHasAccessGroup } from '@/lib/auth/group-access'
import { resolveAturianAssignee } from '@/lib/crm/aturian-assignees'

type Params = { params: Promise<{ id: string }> }

// PUT /api/hr/pto/review/[id] — HR: approve or deny a PTO request
export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, is_admin, display_name')
    .eq('google_id', user.id)
    .single()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!dbUser.is_admin) {
    const isHr = await userHasAccessGroup(adminClient, dbUser.id, ['access:hr_access'])
    if (!isHr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { action, reviewer_comment } = body

  if (!['approve', 'deny'].includes(action)) {
    return NextResponse.json({ error: 'action must be "approve" or "deny"' }, { status: 400 })
  }
  if (action === 'deny' && !reviewer_comment?.trim()) {
    return NextResponse.json({ error: 'A comment is required when denying a request' }, { status: 400 })
  }

  const { data: existing } = await adminClient
    .from('pto_requests')
    .select(`
      id, user_id, task_id, start_date, end_date, status,
      users(id, display_name)
    `)
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.status === 'approved') {
    return NextResponse.json({ error: 'Request already approved' }, { status: 400 })
  }

  const newStatus = action === 'approve' ? 'approved' : 'denied'
  const { data: updated, error: updateError } = await adminClient
    .from('pto_requests')
    .update({
      status: newStatus,
      reviewer_comment: reviewer_comment?.trim() ?? null,
      reviewed_by: dbUser.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 })
  }

  // Update linked task + add note
  if (existing.task_id) {
    await adminClient
      .from('crm_tasks')
      .update({
        status: action === 'approve' ? 'completed' : 'need_changes',
        assigned_to: existing.user_id,
      })
      .eq('id', existing.task_id)

    const noteLines = [
      action === 'approve'
        ? `✅ Approved by ${dbUser.display_name}`
        : `❌ Denied by ${dbUser.display_name}`,
      ...(reviewer_comment?.trim() ? [`Reason: ${reviewer_comment.trim()}`] : []),
    ]
    await adminClient
      .from('crm_task_comments')
      .insert({
        task_id: existing.task_id,
        user_id: dbUser.id,
        comment: noteLines.join('\n'),
      })
  }

  // Notify requester, plus Amy & Jill (always cc'd on PTO decisions)
  const [amy, jill] = await Promise.all([
    resolveAturianAssignee(adminClient, 'customer'),
    resolveAturianAssignee(adminClient, 'supplier'),
  ])
  const recipientIds = Array.from(new Set([
    existing.user_id,
    ...(amy ? [amy.id] : []),
    ...(jill ? [jill.id] : []),
  ]))

  // Amy & Jill always get notified, even when one of them is the reviewer.
  const actorIsAmyOrJill = dbUser.id === amy?.id || dbUser.id === jill?.id

  await dispatchNotification({
    definition: ptoReviewed,
    payload: {
      request_id: id,
      requester_name: existing.users.display_name,
      status: newStatus,
      reviewer_name: dbUser.display_name,
      reviewer_comment: reviewer_comment?.trim() ?? null,
      start_date: existing.start_date,
      end_date: existing.end_date,
    },
    recipientSpec: { userIds: recipientIds },
    suppressUserIds: actorIsAmyOrJill ? [] : [dbUser.id],
  })

  return NextResponse.json({ request: updated })
}
