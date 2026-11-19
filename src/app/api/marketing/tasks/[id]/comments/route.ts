import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { addTaskComment } from '@/lib/crm/tasks-service'

// GET /api/marketing/tasks/[id]/comments
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
  const usersMap: Record<string, { display_name: string; email: string; avatar_url: string | null; profile_image_url: string | null }> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, display_name, email, avatar_url, profile_image_url')
      .in('id', userIds)
    for (const u of users ?? []) usersMap[u.id] = { display_name: u.display_name, email: u.email, avatar_url: u.avatar_url, profile_image_url: u.profile_image_url }
  }

  const enriched = rows.map((c: any) => ({
    ...c,
    attachments: c.crm_comment_attachments ?? [],
    user: usersMap[c.user_id] ?? { display_name: 'Unknown' },
  }))

  return NextResponse.json(enriched)
}

// POST /api/marketing/tasks/[id]/comments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  return addTaskComment(appUser, taskId, await req.json())
}

// DELETE /api/marketing/tasks/[id]/comments/[cid]  ← handled in sub-route
