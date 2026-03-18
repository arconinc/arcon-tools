import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/tasks/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const adminClient = createAdminClient()

  const { data: comments, error } = await adminClient
    .from('crm_task_comments')
    .select('*, crm_comment_attachments(*)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = comments ?? []
  const userIds = [...new Set(rows.map((c: any) => c.user_id).filter(Boolean))]
  let usersMap: Record<string, { display_name: string }> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', userIds)
    for (const u of users ?? []) usersMap[u.id] = { display_name: u.display_name }
  }

  const enriched = rows.map((c: any) => ({
    ...c,
    attachments: c.crm_comment_attachments ?? [],
    user: usersMap[c.user_id] ?? { display_name: 'Unknown' },
  }))

  return NextResponse.json(enriched)
}

// POST /api/crm/tasks/[id]/comments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const body = await req.json()
  const { comment } = body

  if (!comment?.trim()) return NextResponse.json({ error: 'Comment text is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_task_comments')
    .insert({
      task_id: taskId,
      user_id: appUser.id,
      comment: comment.trim(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/crm/tasks/[id]/comments/[cid]  ← handled in sub-route
