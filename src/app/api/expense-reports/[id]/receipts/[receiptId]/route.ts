import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// DELETE /api/expense-reports/[id]/receipts/[receiptId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  const { id, receiptId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }, { data: receipt }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, status').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
    adminClient
      .from('expense_report_receipts')
      .select('id, storage_path, uploaded_by')
      .eq('id', receiptId)
      .eq('report_id', id)
      .single(),
  ])

  if (!report || !receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isOwner && !isReviewer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canDelete =
    (isOwner && (report.status === 'draft' || report.status === 'needs_changes')) || isReviewer
  if (!canDelete) {
    return NextResponse.json({ error: 'Cannot delete receipt in the current report status.' }, { status: 409 })
  }

  await adminClient.storage.from('expense-receipts').remove([receipt.storage_path])
  const { error } = await adminClient.from('expense_report_receipts').delete().eq('id', receiptId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
