import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { expenseReportCommentAdded } from '@/lib/notifications/registry'

// POST /api/expense-reports/[id]/comments/[commentId] — reply to a thread
// Body: { body }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }, { data: parent }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, period_month').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
    adminClient
      .from('expense_report_comments')
      .select('id, line_item_id, parent_id')
      .eq('id', commentId)
      .eq('report_id', id)
      .single(),
  ])

  if (!report || !parent) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (parent.parent_id) return NextResponse.json({ error: 'Cannot reply to a reply.' }, { status: 400 })

  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isOwner && !isReviewer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Reply body required.' }, { status: 400 })

  const { data: reply, error } = await adminClient
    .from('expense_report_comments')
    .insert({
      report_id: id,
      line_item_id: parent.line_item_id,
      parent_id: commentId,
      author_id: appUser.id,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: author } = await adminClient
    .from('users')
    .select('id, display_name, email, avatar_url')
    .eq('id', appUser.id)
    .single()

  // Notify the other party
  const recipientId = isOwner ? config?.reviewer_user_id : report.created_by
  if (recipientId && recipientId !== appUser.id) {
    try {
      await dispatchNotification({
        definition: expenseReportCommentAdded,
        payload: {
          report_id: id,
          period_month: report.period_month,
          author_name: author?.display_name ?? 'Someone',
          is_line_item_comment: !!parent.line_item_id,
          body_excerpt: body.body.trim().slice(0, 120),
          recipient_is_admin: isOwner,
        },
        recipientSpec: { userId: recipientId },
        suppressUserIds: [appUser.id],
      })
    } catch {}
  }

  return NextResponse.json({ reply: { ...reply, author } }, { status: 201 })
}

// DELETE /api/expense-reports/[id]/comments/[commentId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: comment } = await adminClient
    .from('expense_report_comments')
    .select('id, author_id, report_id')
    .eq('id', commentId)
    .eq('report_id', id)
    .single()

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (comment.author_id !== appUser.id && !appUser.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await adminClient.from('expense_report_comments').delete().eq('id', commentId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
