import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// POST /api/expense-reports/[id]/receipts
// Accepts multipart/form-data: file + optional line_item_id
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, status').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
  ])

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isOwner && !isReviewer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canUpload = (isOwner && (report.status === 'draft' || report.status === 'needs_changes')) || isReviewer
  if (!canUpload) {
    return NextResponse.json({ error: 'Receipts cannot be uploaded in the current report status.' }, { status: 409 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Request must be multipart/form-data.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'Missing "file" field.' }, { status: 400 })
  }

  const lineItemId = (formData.get('line_item_id') as string | null) || null

  // Generate a unique storage path
  const ext = file.name.split('.').pop() ?? 'bin'
  const receiptId = crypto.randomUUID()
  const storagePath = `${id}/${receiptId}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from('expense-receipts')
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: receipt, error: dbError } = await adminClient
    .from('expense_report_receipts')
    .insert({
      id: receiptId,
      report_id: id,
      line_item_id: lineItemId,
      filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      file_size: file.size,
      uploaded_by: appUser.id,
    })
    .select()
    .single()

  if (dbError) {
    // Clean up the uploaded file if DB insert fails
    await adminClient.storage.from('expense-receipts').remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ receipt }, { status: 201 })
}

// GET /api/expense-reports/[id]/receipts
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
  ])

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isOwner && !isReviewer) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: receipts, error } = await adminClient
    .from('expense_report_receipts')
    .select('*')
    .eq('report_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ receipts: receipts ?? [] })
}
