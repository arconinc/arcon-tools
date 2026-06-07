import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// POST /api/expense-reports/[id]/comments/[commentId]/resolve
// Toggles resolved state — admin/reviewer only
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: config }, { data: comment }] = await Promise.all([
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
    adminClient
      .from('expense_report_comments')
      .select('id, resolved_at')
      .eq('id', commentId)
      .eq('report_id', id)
      .single(),
  ])

  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isReviewer) return NextResponse.json({ error: 'Only the reviewer can resolve comments.' }, { status: 403 })

  const now = new Date().toISOString()
  const { data: updated, error } = await adminClient
    .from('expense_report_comments')
    .update({
      resolved_at: comment.resolved_at ? null : now,
      resolved_by: comment.resolved_at ? null : appUser.id,
      updated_at: now,
    })
    .eq('id', commentId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: updated })
}
