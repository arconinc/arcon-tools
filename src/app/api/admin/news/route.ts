import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateExcerpt, computeReadingTime } from '@/lib/news-utils'
import type { NewsArticlePayload } from '@/types'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  return appUser?.is_admin ? appUser : null
}

// GET /api/admin/news — list all articles (admin only)
export async function GET(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const type = searchParams.get('type')
  const q = searchParams.get('q')
  const limit = parseInt(searchParams.get('limit') ?? '100')
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const adminClient = createAdminClient()
  let query = adminClient
    .from('news_articles')
    .select(`
      *,
      author:users!created_by(id, display_name, email)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ articles: data, total: count ?? 0 })
}

// POST /api/admin/news — create article (admin only)
export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body: NewsArticlePayload = await request.json()

  if (!body.title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!body.type) {
    return NextResponse.json({ error: 'Type is required' }, { status: 400 })
  }

  const excerpt = generateExcerpt(body.content_html ?? '')
  const reading_time_minutes = computeReadingTime(body.content_html ?? '')
  const publish_date =
    body.status === 'published' && !body.publish_date
      ? new Date().toISOString()
      : (body.publish_date ?? null)

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('news_articles')
    .insert({
      title: body.title.trim(),
      type: body.type,
      status: body.status,
      content_json: body.content_json,
      content_html: body.content_html,
      excerpt,
      reading_time_minutes,
      cover_image_url: body.cover_image_url ?? null,
      pinned: body.pinned ?? false,
      publish_date,
      created_by: admin.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ article: data }, { status: 201 })
}
