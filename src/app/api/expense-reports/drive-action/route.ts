/**
 * POST /api/expense-reports/drive-action
 *
 * Called by the Google Apps Script installed in each expense report Sheet.
 * Uses the same bearer-token + X-User-Email auth pattern as the Gmail add-on.
 *
 * Body: { drive_file_id, action, comment? }
 * Actions:
 *   get_info            — return current status + Arc URL (no state change)
 *   submit              — employee submits for review (draft → submitted, or needs_changes → submitted)
 *   needs_changes       — reviewer flags corrections needed (submitted → needs_changes)
 *   approve             — reviewer approves (submitted → approved)
 *   submit_to_payroll   — reviewer sends to payroll (approved → submitted_to_payroll)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import {
  expenseReportSubmitted,
  expenseReportNeedsChanges,
  expenseReportApproved,
  expenseReportSubmittedToPayroll,
} from '@/lib/notifications/registry'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://thearc.arconinc.com'

type Action = 'get_info' | 'submit' | 'needs_changes' | 'approve' | 'submit_to_payroll'

async function requireExpenseApiUser(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const userEmail = req.headers.get('x-user-email')
  if (!authHeader || !userEmail) return null

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null

  const apiKey = process.env.EXPENSE_REPORT_API_KEY
  if (!apiKey || token !== apiKey) return null

  const adminClient = createAdminClient()
  const { data: user } = await adminClient
    .from('users')
    .select('id, email, display_name, is_admin')
    .eq('email', userEmail.toLowerCase().trim())
    .is('deactivated_at', null)
    .single()

  return user ?? null
}

export async function POST(req: NextRequest) {
  const caller = await requireExpenseApiUser(req)
  if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const drive_file_id = (body.drive_file_id as string | undefined)?.trim()
  const action = body.action as Action | undefined
  const comment = (body.comment as string | undefined)?.trim() || null

  if (!drive_file_id) return NextResponse.json({ error: 'drive_file_id is required' }, { status: 400 })
  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 })

  const adminClient = createAdminClient()

  const { data: report } = await adminClient
    .from('expense_reports')
    .select('id, created_by, period_month, status, drive_url')
    .eq('drive_file_id', drive_file_id)
    .single()

  if (!report) {
    return NextResponse.json({ error: 'Expense report not found for this file.' }, { status: 404 })
  }

  const { data: config } = await adminClient
    .from('expense_report_config')
    .select('reviewer_user_id')
    .single()

  const isOwner = report.created_by === caller.id
  const isReviewer = config?.reviewer_user_id === caller.id || caller.is_admin

  const reportUrl = `${APP_URL}/expense-reports/${report.id}`
  const adminReportUrl = `${APP_URL}/admin/expense-reports/${report.id}`

  // ── get_info: no state change, just return current status ─────────────────
  if (action === 'get_info') {
    return NextResponse.json({
      ok: true,
      status: report.status,
      report_url: isReviewer ? adminReportUrl : reportUrl,
    })
  }

  // ── submit: employee submits for review ───────────────────────────────────
  if (action === 'submit') {
    if (!isOwner) {
      return NextResponse.json({ error: 'Only the report owner can submit.' }, { status: 403 })
    }
    if (!['draft', 'needs_changes'].includes(report.status)) {
      return NextResponse.json(
        { error: `Cannot submit from status "${report.status}".` },
        { status: 400 }
      )
    }

    await adminClient
      .from('expense_reports')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', report.id)

    if (config?.reviewer_user_id) {
      try {
        const { data: submitter } = await adminClient
          .from('users')
          .select('display_name')
          .eq('id', caller.id)
          .single()
        await dispatchNotification({
          definition: expenseReportSubmitted,
          payload: {
            report_id: report.id,
            period_month: report.period_month,
            submitter_name: submitter?.display_name ?? caller.email,
            drive_url: report.drive_url ?? '',
          },
          recipientSpec: { userId: config.reviewer_user_id },
          suppressUserIds: [caller.id],
        })
      } catch {}
    }

    return NextResponse.json({ ok: true, status: 'submitted', report_url: adminReportUrl })
  }

  // ── Reviewer-only actions ─────────────────────────────────────────────────
  if (!isReviewer) {
    return NextResponse.json({ error: 'Only the reviewer can perform this action.' }, { status: 403 })
  }

  if (action === 'needs_changes') {
    if (report.status !== 'submitted') {
      return NextResponse.json(
        { error: `Cannot request changes from status "${report.status}".` },
        { status: 400 }
      )
    }

    await adminClient
      .from('expense_reports')
      .update({
        status: 'needs_changes',
        reviewer_comment: comment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    try {
      await dispatchNotification({
        definition: expenseReportNeedsChanges,
        payload: {
          report_id: report.id,
          period_month: report.period_month,
          reviewer_name: caller.display_name ?? caller.email,
          comment,
          drive_url: report.drive_url ?? '',
        },
        recipientSpec: { userId: report.created_by },
        suppressUserIds: [caller.id],
      })
    } catch {}

    return NextResponse.json({ ok: true, status: 'needs_changes', report_url: reportUrl })
  }

  if (action === 'approve') {
    if (report.status !== 'submitted') {
      return NextResponse.json(
        { error: `Cannot approve from status "${report.status}".` },
        { status: 400 }
      )
    }

    await adminClient
      .from('expense_reports')
      .update({
        status: 'approved',
        reviewer_comment: comment,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id)

    try {
      await dispatchNotification({
        definition: expenseReportApproved,
        payload: {
          report_id: report.id,
          period_month: report.period_month,
          reviewer_name: caller.display_name ?? caller.email,
        },
        recipientSpec: { userId: report.created_by },
        suppressUserIds: [caller.id],
      })
    } catch {}

    return NextResponse.json({ ok: true, status: 'approved', report_url: reportUrl })
  }

  if (action === 'submit_to_payroll') {
    if (!['approved', 'submitted'].includes(report.status)) {
      return NextResponse.json(
        { error: `Cannot submit to payroll from status "${report.status}".` },
        { status: 400 }
      )
    }

    await adminClient
      .from('expense_reports')
      .update({ status: 'submitted_to_payroll', updated_at: new Date().toISOString() })
      .eq('id', report.id)

    try {
      await dispatchNotification({
        definition: expenseReportSubmittedToPayroll,
        payload: {
          report_id: report.id,
          period_month: report.period_month,
          reviewer_name: caller.display_name ?? caller.email,
        },
        recipientSpec: { userId: report.created_by },
        suppressUserIds: [caller.id],
      })
    } catch {}

    return NextResponse.json({ ok: true, status: 'submitted_to_payroll', report_url: reportUrl })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
