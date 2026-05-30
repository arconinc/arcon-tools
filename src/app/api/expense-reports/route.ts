import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { copyExpenseTemplate, writeArcSheetMetadata } from '@/lib/google-drive'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { expenseReportSubmitted } from '@/lib/notifications/registry'

// GET /api/expense-reports — list current user's expense reports
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, status, drive_file_id, drive_url, reviewer_comment, created_at, updated_at')
    .eq('created_by', appUser.id)
    .order('period_month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}

// POST /api/expense-reports — create a new report by copying the Drive template
// Body: { period_month }  (YYYY-MM format)
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const period_month = (body.period_month as string | undefined)?.trim()

  if (!period_month || !/^\d{4}-\d{2}$/.test(period_month)) {
    return NextResponse.json({ error: 'period_month must be in YYYY-MM format' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Enforce one report per user/month
  const { data: existing } = await adminClient
    .from('expense_reports')
    .select('id, drive_url')
    .eq('created_by', appUser.id)
    .eq('period_month', period_month)
    .single()

  if (existing) {
    return NextResponse.json(
      { error: 'A report for this month already exists.', report: existing },
      { status: 409 }
    )
  }

  // Load config: template file ID, folder ID, reviewer email
  const { data: config } = await adminClient
    .from('expense_report_config')
    .select('template_drive_file_id, expense_folder_id, reviewer_user_id')
    .single()

  if (!config?.template_drive_file_id || !config?.expense_folder_id) {
    return NextResponse.json(
      { error: 'Expense report template is not configured yet. Please contact your administrator.' },
      { status: 503 }
    )
  }

  // Look up the employee's email and the reviewer's email
  const [{ data: employee }, { data: reviewer }] = await Promise.all([
    adminClient.from('users').select('email, display_name').eq('id', appUser.id).single(),
    config.reviewer_user_id
      ? adminClient.from('users').select('email, display_name').eq('id', config.reviewer_user_id).single()
      : Promise.resolve({ data: null }),
  ])

  if (!employee?.email) {
    return NextResponse.json({ error: 'Could not resolve your user record.' }, { status: 500 })
  }

  // Format: "Matt Christianson — Expense Report — May 2026"
  const [year, month] = period_month.split('-')
  const monthLabel = new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const fileName = `${employee.display_name ?? employee.email} — Expense Report — ${monthLabel}`

  // Copy the template in Google Drive
  let fileId: string
  let webViewLink: string
  try {
    const result = await copyExpenseTemplate(
      config.template_drive_file_id,
      config.expense_folder_id,
      fileName,
      employee.email,
      reviewer?.email ?? employee.email
    )
    fileId = result.fileId
    webViewLink = result.webViewLink
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create expense report in Google Drive'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Create the DB record
  const { data: report, error: dbError } = await adminClient
    .from('expense_reports')
    .insert({
      created_by: appUser.id,
      period_month,
      status: 'draft',
      drive_file_id: fileId,
      drive_url: webViewLink,
    })
    .select()
    .single()

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Write metadata to the hidden _arc sheet so the Apps Script can identify
  // users without needing Session.getActiveUser() (removes userinfo.email scope).
  // Fire-and-forget — the report is already created, don't fail on metadata error.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thearc.arconinc.com'
  writeArcSheetMetadata(
    fileId,
    employee.email,
    reviewer?.email ?? employee.email,
    `${appUrl}/expense-reports/${report.id}`,
    `${appUrl}/admin/expense-reports/${report.id}`
  ).catch(() => {})

  return NextResponse.json({ report }, { status: 201 })
}
