import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPollData } from '@/lib/poll-utils'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const optionId = typeof body.option_id === 'string' ? body.option_id : ''
  if (!optionId) return NextResponse.json({ error: 'Option is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: article } = await adminClient
    .from('news_articles')
    .select('id, content_kind, status, poll_is_anonymous')
    .eq('id', id)
    .eq('status', 'published')
    .eq('content_kind', 'poll')
    .single()

  if (!article) return NextResponse.json({ error: 'Poll not found' }, { status: 404 })

  const { data: option } = await adminClient
    .from('poll_options')
    .select('id')
    .eq('id', optionId)
    .eq('article_id', id)
    .single()

  if (!option) return NextResponse.json({ error: 'Invalid option' }, { status: 400 })

  const { error } = await adminClient
    .from('poll_votes')
    .insert({ article_id: id, option_id: optionId, user_id: appUser.id })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already voted' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const poll = await getPollData(id, appUser.id, !article.poll_is_anonymous || appUser.is_admin)
  return NextResponse.json({ poll })
}
