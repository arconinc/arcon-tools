import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getPollData } from '@/lib/poll-utils'

// GET /api/news — published articles for all authenticated users
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const limit = parseInt(searchParams.get('limit') ?? '10')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id')
    .eq('google_id', user.id)
    .single()

  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let query = adminClient
    .from('news_articles')
    .select(`
      id,
      title,
      type,
      content_kind,
      excerpt,
      cover_image_url,
      pinned,
      poll_question,
      poll_is_anonymous,
      reading_time_minutes,
      publish_date,
      author:users!created_by(display_name)
    `, { count: 'exact' })
    .eq('status', 'published')
    .order('pinned', { ascending: false })
    .order('publish_date', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type) query = query.eq('type', type)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten author join
  const articles = await Promise.all((data ?? []).map(async (a) => ({
    ...a,
    poll: a.content_kind === 'poll' ? await getPollData(a.id, appUser.id, false) : undefined,
    author_name: (a.author as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
    author: undefined,
  })))

  return NextResponse.json({ articles, total: count ?? 0 })
}
