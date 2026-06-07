import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { expenseReportCommentAdded } from '@/lib/notifications/registry'

async function getCommentAccess(reportId: string, appUser: { id: string; is_admin: boolean }) {
  const adminClient = createAdminClient()
  const [{ data: report }, { data: config }] = await Promise.all([
    adminClient.from('expense_reports').select('id, created_by, period_month').eq('id', reportId).single(),
    adminClient.from('expense_report_config').select('reviewer_user_id').single(),
  ])
  if (!report) return null
  const isOwner = report.created_by === appUser.id
  const isReviewer = config?.reviewer_user_id === appUser.id || appUser.is_admin
  if (!isOwner && !isReviewer) return null
  return { report, config, isOwner, isReviewer }
}

// GET /api/expense-reports/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getCommentAccess(id, appUser)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const adminClient = createAdminClient()
  const { data: comments, error } = await adminClient
    .from('expense_report_comments')
    .select('*')
    .eq('report_id', id)
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch replies
  const topLevelIds = (comments ?? []).map(c => c.id)
  let repliesMap: Record<string, unknown[]> = {}
  if (topLevelIds.length > 0) {
    const { data: replies } = await adminClient
      .from('expense_report_comments')
      .select('*')
      .in('parent_id', topLevelIds)
      .order('created_at', { ascending: true })
    for (const r of replies ?? []) {
      if (!repliesMap[r.parent_id]) repliesMap[r.parent_id] = []
      repliesMap[r.parent_id].push(r)
    }
  }

  // Enrich with author names
  const allComments = [...(comments ?? []), ...Object.values(repliesMap).flat() as { author_id: string }[]]
  const authorIds = [...new Set(allComments.map(c => (c as { author_id: string }).author_id))]
  let authorMap: Record<string, { id: string; display_name: string; email: string; avatar_url?: string | null }> = {}
  if (authorIds.length > 0) {
    const { data: authors } = await adminClient
      .from('users')
      .select('id, display_name, email, avatar_url')
      .in('id', authorIds)
    for (const a of authors ?? []) authorMap[a.id] = a
  }

  const enriched = (comments ?? []).map(c => ({
    ...c,
    author: authorMap[c.author_id] ?? null,
    replies: ((repliesMap[c.id] ?? []) as Record<string, unknown>[]).map(r => ({
      ...r,
      author: authorMap[(r as { author_id: string }).author_id] ?? null,
    })),
  }))

  return NextResponse.json({ comments: enriched })
}

// POST /api/expense-reports/[id]/comments — add top-level or line-item comment
// Body: { body, line_item_id? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const access = await getCommentAccess(id, appUser)
  if (!access) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (!body.body?.trim()) return NextResponse.json({ error: 'Comment body required.' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: comment, error } = await adminClient
    .from('expense_report_comments')
    .insert({
      report_id: id,
      line_item_id: body.line_item_id ?? null,
      author_id: appUser.id,
      body: body.body.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the other party
  const { data: author } = await adminClient
    .from('users')
    .select('display_name')
    .eq('id', appUser.id)
    .single()

  const recipientId = access.isOwner
    ? access.config?.reviewer_user_id
    : access.report.created_by

  if (recipientId && recipientId !== appUser.id) {
    try {
      await dispatchNotification({
        definition: expenseReportCommentAdded,
        payload: {
          report_id: id,
          period_month: access.report.period_month,
          author_name: author?.display_name ?? 'Someone',
          is_line_item_comment: !!body.line_item_id,
          body_excerpt: body.body.trim().slice(0, 120),
          recipient_is_admin: access.isOwner,
        },
        recipientSpec: { userId: recipientId },
        suppressUserIds: [appUser.id],
      })
    } catch {}
  }

  // Enrich with author
  const { data: authorFull } = await adminClient
    .from('users')
    .select('id, display_name, email, avatar_url')
    .eq('id', appUser.id)
    .single()

  return NextResponse.json({ comment: { ...comment, author: authorFull, replies: [] } }, { status: 201 })
}
