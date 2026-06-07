import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/expense-reports — list current user's expense reports with totals
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, title, status, reviewer_comment, created_at, updated_at')
    .eq('created_by', appUser.id)
    .order('period_month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch line item counts + totals for all reports in one query
  const reportIds = (data ?? []).map(r => r.id)
  let totalsMap: Record<string, { count: number; total_original: number; total_adjusted: number }> = {}

  if (reportIds.length > 0) {
    const { data: lineItems } = await adminClient
      .from('expense_report_line_items')
      .select('report_id, original_amount, adjusted_amount')
      .in('report_id', reportIds)

    for (const item of lineItems ?? []) {
      if (!totalsMap[item.report_id]) totalsMap[item.report_id] = { count: 0, total_original: 0, total_adjusted: 0 }
      totalsMap[item.report_id].count++
      totalsMap[item.report_id].total_original += item.original_amount ?? 0
      totalsMap[item.report_id].total_adjusted += item.adjusted_amount ?? 0
    }
  }

  const reports = (data ?? []).map(r => ({
    ...r,
    line_item_count: totalsMap[r.id]?.count ?? 0,
    total_original: totalsMap[r.id]?.total_original ?? 0,
    total_adjusted: totalsMap[r.id]?.total_adjusted ?? 0,
  }))

  return NextResponse.json({ reports })
}

// POST /api/expense-reports — create a new report
// Body: { period_month, title? }  (YYYY-MM format)
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const period_month = (body.period_month as string | undefined)?.trim()

  if (!period_month || !/^\d{4}-\d{2}$/.test(period_month)) {
    return NextResponse.json({ error: 'period_month must be in YYYY-MM format' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Check for existing report for this month (allow multiple, but warn)
  const { data: existing } = await adminClient
    .from('expense_reports')
    .select('id, status')
    .eq('created_by', appUser.id)
    .eq('period_month', period_month)
    .not('status', 'eq', 'approved')
    .not('status', 'eq', 'submitted_to_payroll')

  if (existing && existing.length > 0 && !body.allow_duplicate) {
    return NextResponse.json(
      { error: 'An active report for this month already exists.', existing: existing[0] },
      { status: 409 }
    )
  }

  const { data: report, error: dbError } = await adminClient
    .from('expense_reports')
    .insert({
      created_by: appUser.id,
      period_month,
      title: body.title ?? null,
      status: 'draft',
    })
    .select('id, created_by, period_month, title, status, reviewer_comment, created_at, updated_at')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // Log version
  await adminClient.from('expense_report_versions').insert({
    report_id: report.id,
    changed_by: appUser.id,
    action: 'created',
    new_status: 'draft',
  })

  return NextResponse.json({ report }, { status: 201 })
}
