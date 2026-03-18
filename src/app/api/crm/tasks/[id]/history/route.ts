import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/tasks/[id]/history
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: taskId } = await params
  const adminClient = createAdminClient()

  const { data: history, error } = await adminClient
    .from('crm_task_history')
    .select('*')
    .eq('task_id', taskId)
    .order('changed_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = history ?? []
  const userIds = [...new Set(rows.map((h: any) => h.user_id).filter(Boolean))]
  let usersMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: users } = await adminClient
      .from('users')
      .select('id, display_name')
      .in('id', userIds)
    for (const u of users ?? []) usersMap[u.id] = u.display_name
  }

  const enriched = rows.map((h: any) => ({
    ...h,
    user: { id: h.user_id, display_name: usersMap[h.user_id] ?? 'Unknown' },
  }))

  return NextResponse.json(enriched)
}
