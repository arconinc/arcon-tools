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
  const [
    { data: report, error },
    { data: lineItems },
    { data: versions },
    { data: comments },
  ] = await Promise.all([
    adminClient
      .from('expense_reports')
      .select('id, created_by, period_month, title, status, reviewer_comment, created_at, updated_at')
      .eq('id', id)
      .single(),
    adminClient
      .from('expense_report_line_items')
      .select('*')
      .eq('report_id', id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    adminClient
      .from('expense_report_versions')
      .select('id, action, previous_status, new_status, comment, created_at, changed_by')
      .eq('report_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
    adminClient
      .from('expense_report_comments')
      .select('*')
      .eq('report_id', id)
      .is('parent_id', null)
      .order('created_at', { ascending: true }),
  ])

  if (error || !report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: submitter } = await adminClient
    .from('users')
    .select('id, display_name, email')
    .eq('id', report.created_by)
    .single()

  // Enrich versions with changer names
  const changerIds = [...new Set((versions ?? []).map(v => v.changed_by))]
  let changerMap: Record<string, { id: string; display_name: string; email: string }> = {}
  if (changerIds.length > 0) {
    const { data: changers } = await adminClient
      .from('users')
      .select('id, display_name, email')
      .in('id', changerIds)
    for (const c of changers ?? []) changerMap[c.id] = c
  }

  // Enrich comments with authors + replies
  const topIds = (comments ?? []).map(c => c.id)
  let repliesMap: Record<string, unknown[]> = {}
  if (topIds.length > 0) {
    const { data: replies } = await adminClient
      .from('expense_report_comments')
      .select('*')
      .in('parent_id', topIds)
      .order('created_at', { ascending: true })
    for (const r of replies ?? []) {
      if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
      repliesMap[r.parent_id].push(r)
    }
  }
  const allCommentRows = [
    ...(comments ?? []),
    ...Object.values(repliesMap).flat() as { author_id: string }[],
  ]
  const authorIds = [...new Set(allCommentRows.map(c => (c as { author_id: string }).author_id))]
  let authorMap: Record<string, { id: string; display_name: string; email: string; avatar_url?: string | null }> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await adminClient
      .from('users')
      .select('id, display_name, email, avatar_url')
      .in('id', authorIds)
    for (const a of authors ?? []) authorMap[a.id] = a
  }
  const enrichedComments = (comments ?? []).map(c => ({
    ...c,
    author: authorMap[c.author_id] ?? null,
    replies: ((repliesMap[c.id] ?? []) as Record<string, unknown>[]).map(r => ({
      ...r,
      author: authorMap[(r as { author_id: string }).author_id] ?? null,
    })),
  }))

  return NextResponse.json({
    report: {
      ...report,
      submitter,
      line_items: lineItems ?? [],
      versions: (versions ?? []).map(v => ({ ...v, changer: changerMap[v.changed_by] ?? null })),
      comments: enrichedComments,
    },
  })
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
    .select('id, created_by, period_month, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const allowedStatuses = ['submitted', 'needs_changes', 'approved', 'submitted_to_payroll', 'draft']
  if (!body.status || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const prevStatus = report.status
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

  // Version log with snapshot
  const { data: lineItems } = await adminClient
    .from('expense_report_line_items')
    .select('*')
    .eq('report_id', id)

  await adminClient.from('expense_report_versions').insert({
    report_id: id,
    changed_by: admin.id,
    action: body.status,
    previous_status: prevStatus,
    new_status: body.status,
    comment: body.comment ?? null,
    snapshot_json: lineItems ?? [],
  })

  const reviewerName = admin.display_name ?? 'The reviewer'

  try {
    if (body.status === 'needs_changes') {
      await dispatchNotification({
        definition: expenseReportNeedsChanges,
        payload: {
          report_id: id,
          period_month: report.period_month,
          reviewer_name: reviewerName,
          comment: body.comment ?? null,
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
