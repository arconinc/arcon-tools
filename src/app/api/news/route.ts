import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  let query = adminClient
    .from('news_articles')
    .select(`
      id,
      title,
      type,
      excerpt,
      cover_image_url,
      pinned,
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
  const articles = (data ?? []).map((a) => ({
    ...a,
    author_name: (a.author as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
    author: undefined,
  }))

  return NextResponse.json({ articles, total: count ?? 0 })
}
