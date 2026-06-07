import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

async function getItemAccess(reportId: string, itemId: string, appUser: { id: string; is_admin: boolean }) {
  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }, { data: item }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, status').eq('id', reportId).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
    adminClient.from('expense_report_line_items').select('*').eq('id', itemId).eq('report_id', reportId).single(),
  ])
  if (!report || !item) return null
  const isOwner = report.created_by === appUser.id
  if (!isOwner && config?.reviewer_user_id !== appUser.id && !appUser.is_admin) return null
  const canEdit = (isOwner && (report.status === 'draft' || report.status === 'needs_changes')) || appUser.is_admin
  return { report, item, canEdit }
}

// PUT /api/expense-reports/[id]/line-items/[itemId]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getItemAccess(id, itemId, appUser)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'Report cannot be edited in its current status.' }, { status: 409 })

  const body = await req.json()
  const adminClient = createAdminClient()

  const allowedFields = ['expense_date', 'vendor', 'category', 'description', 'original_amount', 'adjusted_amount', 'payment_type', 'receipt_url', 'reimbursable', 'sort_order']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of allowedFields) {
    if (field in body) updates[field] = body[field]
  }

  const { data: item, error } = await adminClient
    .from('expense_report_line_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient
    .from('expense_reports')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ item })
}

// DELETE /api/expense-reports/[id]/line-items/[itemId]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getItemAccess(id, itemId, appUser)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'Report cannot be edited in its current status.' }, { status: 409 })

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('expense_report_line_items').delete().eq('id', itemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await adminClient
    .from('expense_reports')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
