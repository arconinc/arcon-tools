import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { expenseReportSubmitted } from '@/lib/notifications/registry'

// POST /api/expense-reports/[id]/submit
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { data: report } = await adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (report.created_by !== appUser.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (report.status !== 'draft' && report.status !== 'needs_changes') {
    return NextResponse.json({ error: 'Report can only be submitted from in-progress or needs-changes status.' }, { status: 409 })
  }

  // Require at least one line item
  const { count } = await adminClient
    .from('expense_report_line_items')
    .select('id', { count: 'exact', head: true })
    .eq('report_id', id)

  if (!count || count === 0) {
    return NextResponse.json({ error: 'Add at least one expense before submitting.' }, { status: 422 })
  }

  const prevStatus = report.status
  const { data: updated, error } = await adminClient
    .from('expense_reports')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, created_by, period_month, title, status, reviewer_comment, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get submitter display name
  const { data: submitter } = await adminClient
    .from('users')
    .select('display_name, email')
    .eq('id', appUser.id)
    .single()

  // Version log
  await adminClient.from('expense_report_versions').insert({
    report_id: id,
    changed_by: appUser.id,
    action: 'submitted',
    previous_status: prevStatus,
    new_status: 'submitted',
  })

  // Snapshot line items
  const { data: lineItems } = await adminClient
    .from('expense_report_line_items')
    .select('*')
    .eq('report_id', id)

  if (lineItems) {
    await adminClient
      .from('expense_report_versions')
      .update({ snapshot_json: lineItems })
      .eq('report_id', id)
      .eq('action', 'submitted')
      .order('created_at', { ascending: false })
      .limit(1)
  }

  // Notify reviewer
  const { data: config } = await adminClient
    .from('expense_report_config')
    .select('reviewer_user_id')
    .single()

  if (config?.reviewer_user_id) {
    try {
      await dispatchNotification({
        definition: expenseReportSubmitted,
        payload: {
          report_id: id,
          period_month: report.period_month,
          submitter_name: submitter?.display_name ?? 'Employee',
        },
        recipientSpec: { userId: config.reviewer_user_id },
        suppressUserIds: [appUser.id],
      })
    } catch {}
  }

  return NextResponse.json({ report: updated })
}
