import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/expense-reports/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient
      .from('expense_reports')
      .select('id, created_by, period_month, title, status, reviewer_comment, created_at, updated_at')
      .eq('id', id)
      .single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
  ])

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id
  if (!isOwner && !isReviewer && !appUser.is_admin) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const [{ data: submitter }, { data: lineItems }, { data: versions }] = await Promise.all([
    adminClient.from('users').select('id, display_name, email').eq('id', report.created_by).single(),
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
  ])

  // Enrich version entries with changer names
  const changerIds = [...new Set((versions ?? []).map(v => v.changed_by))]
  let changerMap: Record<string, { id: string; display_name: string; email: string }> = {}
  if (changerIds.length > 0) {
    const { data: changers } = await adminClient
      .from('users')
      .select('id, display_name, email')
      .in('id', changerIds)
    for (const c of changers ?? []) changerMap[c.id] = c
  }

  const enrichedVersions = (versions ?? []).map(v => ({
    ...v,
    changer: changerMap[v.changed_by] ?? null,
  }))

  return NextResponse.json({
    report: { ...report, submitter },
    line_items: lineItems ?? [],
    versions: enrichedVersions,
    is_reviewer: isReviewer || appUser.is_admin,
    can_edit: (isOwner && (report.status === 'draft' || report.status === 'needs_changes')) || appUser.is_admin,
  })
}

// DELETE /api/expense-reports/[id]
// Only the owner can delete, and only when status is 'draft'
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { data: report } = await adminClient
    .from('expense_reports')
    .select('id, created_by, status')
    .eq('id', id)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (report.created_by !== appUser.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (report.status !== 'draft') {
    return NextResponse.json({ error: 'Only in-progress reports can be deleted.' }, { status: 400 })
  }

  const { error } = await adminClient.from('expense_reports').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to delete report' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
