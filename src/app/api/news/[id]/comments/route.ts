import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_LENGTH = 5000

async function currentUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  return appUser ?? null
}

// GET /api/news/[id]/comments
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await currentUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: articleId } = await params
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('news_comments')
    .select('id, comment, created_at, user_id, user:users!user_id(id, display_name, avatar_url, profile_image_url)')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/news/[id]/comments
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await currentUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: articleId } = await params
  const body = await req.json()
  const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
  if (!comment) return NextResponse.json({ error: 'Comment is required' }, { status: 400 })
  if (comment.length > MAX_LENGTH) {
    return NextResponse.json({ error: `Comment must be under ${MAX_LENGTH} characters` }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Only published articles accept comments.
  const { data: article } = await adminClient
    .from('news_articles')
    .select('id')
    .eq('id', articleId)
    .eq('status', 'published')
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })

  const { data, error } = await adminClient
    .from('news_comments')
    .insert({ article_id: articleId, user_id: appUser.id, comment })
    .select('id, comment, created_at, user_id, user:users!user_id(id, display_name, avatar_url, profile_image_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
