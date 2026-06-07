import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

async function getReportAccess(id: string, appUser: { id: string; is_admin: boolean }) {
  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, status').eq('id', id).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
  ])
  if (!report) return null
  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id
  if (!isOwner && !isReviewer && !appUser.is_admin) return null
  const canEdit = (isOwner && (report.status === 'draft' || report.status === 'needs_changes')) || appUser.is_admin
  return { report, canEdit }
}

// GET /api/expense-reports/[id]/line-items
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getReportAccess(id, appUser)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('expense_report_line_items')
    .select('*')
    .eq('report_id', id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ line_items: data ?? [] })
}

// POST /api/expense-reports/[id]/line-items — add a line item
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getReportAccess(id, appUser)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!access.canEdit) return NextResponse.json({ error: 'Report cannot be edited in its current status.' }, { status: 409 })

  const body = await req.json()
  const adminClient = createAdminClient()

  // Determine next sort_order
  const { data: last } = await adminClient
    .from('expense_report_line_items')
    .select('sort_order')
    .eq('report_id', id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sort_order = (last?.sort_order ?? -1) + 1

  const { data: item, error } = await adminClient
    .from('expense_report_line_items')
    .insert({
      report_id: id,
      expense_date: body.expense_date ?? null,
      vendor: body.vendor ?? null,
      category: body.category ?? null,
      description: body.description ?? null,
      original_amount: body.original_amount ?? null,
      adjusted_amount: body.adjusted_amount ?? null,
      payment_type: body.payment_type ?? null,
      receipt_url: body.receipt_url ?? null,
      reimbursable: body.reimbursable ?? true,
      sort_order,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Touch the parent report updated_at
  await adminClient
    .from('expense_reports')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ item }, { status: 201 })
}
