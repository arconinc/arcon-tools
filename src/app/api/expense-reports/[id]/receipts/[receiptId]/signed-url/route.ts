import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/expense-reports/[id]/receipts/[receiptId]/signed-url
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; receiptId: string }> }
) {
  const { id, receiptId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }, { data: receipt }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
    adminClient
      .from('expense_report_receipts')
      .select('id, storage_path, filename, mime_type')
      .eq('id', receiptId)
      .eq('report_id', id)
      .single(),
  ])

  if (!report || !receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isOwner && !isReviewer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: signedData, error } = await adminClient.storage
    .from('expense-receipts')
    .createSignedUrl(receipt.storage_path, 3600) // 1 hour

  if (error || !signedData?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create signed URL' }, { status: 500 })
  }

  return NextResponse.json({
    signed_url: signedData.signedUrl,
    filename: receipt.filename,
    mime_type: receipt.mime_type,
  })
}
