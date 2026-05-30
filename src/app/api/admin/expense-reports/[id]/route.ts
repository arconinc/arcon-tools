import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import {
  expenseReportNeedsChanges,
  expenseReportApproved,
  expenseReportSubmittedToPayroll,
} from '@/lib/notifications/registry'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('users')
    .select('id, is_admin, display_name')
    .eq('google_id', user.id)
    .single()
  return data?.is_admin ? data : null
}

// GET /api/admin/expense-reports/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data: report, error } = await adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, status, drive_file_id, drive_url, reviewer_comment, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error || !report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: submitter } = await adminClient
    .from('users')
    .select('id, display_name, email')
    .eq('id', report.created_by)
    .single()

  return NextResponse.json({ report: { ...report, submitter } })
}

// PATCH /api/admin/expense-reports/[id] — update status from the admin UI
// Body: { status, comment? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const adminClient = createAdminClient()

  const { data: report } = await adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, status, drive_url')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowedStatuses = ['submitted', 'needs_changes', 'approved', 'submitted_to_payroll']
  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data: updated, error } = await adminClient
    .from('expense_reports')
    .update({
      status: body.status,
      reviewer_comment: body.comment ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reviewerName = admin.display_name ?? 'The reviewer'

  // Dispatch appropriate notification
  try {
    if (body.status === 'needs_changes') {
      await dispatchNotification({
        definition: expenseReportNeedsChanges,
        payload: {
          report_id: id,
          period_month: report.period_month,
          reviewer_name: reviewerName,
          comment: body.comment ?? null,
          drive_url: report.drive_url ?? '',
        },
        recipientSpec: { userId: report.created_by },
        suppressUserIds: [admin.id],
      })
    } else if (body.status === 'approved') {
      await dispatchNotification({
        definition: expenseReportApproved,
        payload: { report_id: id, period_month: report.period_month, reviewer_name: reviewerName },
        recipientSpec: { userId: report.created_by },
        suppressUserIds: [admin.id],
      })
    } else if (body.status === 'submitted_to_payroll') {
      await dispatchNotification({
        definition: expenseReportSubmittedToPayroll,
        payload: { report_id: id, period_month: report.period_month, reviewer_name: reviewerName },
        recipientSpec: { userId: report.created_by },
        suppressUserIds: [admin.id],
      })
    }
  } catch {}

  return NextResponse.json({ report: updated })
}
