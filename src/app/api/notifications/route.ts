import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const filter = searchParams.get('filter') === 'unread' ? 'unread' : 'all'
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
  const before = searchParams.get('before')

  const adminClient = createAdminClient()

  let q = adminClient
    .from('notifications')
    .select('id, type, title, body, link_url, metadata, read_at, archived_at, email_status, email_sent_at, created_at')
    .eq('user_id', appUser.id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (filter === 'unread') q = q.is('read_at', null)
  if (before) q = q.lt('created_at', before)

  const [listRes, unreadRes] = await Promise.all([
    q,
    adminClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', appUser.id)
      .is('archived_at', null)
      .is('read_at', null),
  ])

  if (listRes.error) {
    return NextResponse.json({ error: listRes.error.message }, { status: 500 })
  }

  const rows = listRes.data ?? []
  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows

  return NextResponse.json({
    notifications: trimmed,
    unreadCount: unreadRes.count ?? 0,
    hasMore,
  })
}
