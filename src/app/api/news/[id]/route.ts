import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPollData } from '@/lib/poll-utils'

// GET /api/news/[id] — single published article
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await adminClient
    .from('news_articles')
    .select(`*, author:users!created_by(id, display_name, email)`)
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const poll = data.content_kind === 'poll'
    ? await getPollData(id, appUser.id, !data.poll_is_anonymous || appUser.is_admin)
    : undefined
  return NextResponse.json({ article: { ...data, poll } })
}
