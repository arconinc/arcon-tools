import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateExcerpt, computeReadingTime } from '@/lib/news-utils'
import { getPollData, validatePollOptions } from '@/lib/poll-utils'

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

// GET /api/admin/news/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('news_articles')
    .select(`*, author:users!created_by(id, display_name, email)`)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  const poll = data.content_kind === 'poll' ? await getPollData(id, admin.id, true) : undefined
  return NextResponse.json({ article: { ...data, poll } })
}

// PUT /api/admin/news/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) updates.title = body.title.trim()
  if (body.type !== undefined) updates.type = body.type
  if (body.status !== undefined) updates.status = body.status
  if (body.content_kind !== undefined) updates.content_kind = body.content_kind
  if (body.content_json !== undefined) updates.content_json = body.content_json
  if (body.cover_image_url !== undefined) updates.cover_image_url = body.cover_image_url
  if (body.pinned !== undefined) updates.pinned = body.pinned
  if (body.publish_date !== undefined) updates.publish_date = body.publish_date
  if (body.poll_question !== undefined) updates.poll_question = body.poll_question?.trim() || null
  if (body.poll_is_anonymous !== undefined) updates.poll_is_anonymous = body.poll_is_anonymous

  // Recompute derived fields if content changed
  if (body.content_html !== undefined) {
    updates.content_html = body.content_html
    updates.excerpt = body.content_kind === 'poll' && body.poll_question
      ? body.poll_question.trim()
      : generateExcerpt(body.content_html)
    updates.reading_time_minutes = computeReadingTime(body.content_html)
  }

  if (body.content_kind === 'poll') {
    if (!body.poll_question?.trim()) {
      return NextResponse.json({ error: 'Poll question is required' }, { status: 400 })
    }
    const validation = validatePollOptions(body.poll_options)
    if (validation.error) return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  // Auto-set publish_date when publishing for the first time
  if (body.status === 'published' && !body.publish_date) {
    const adminClient = createAdminClient()
    const { data: existing } = await adminClient
      .from('news_articles')
      .select('publish_date, status')
      .eq('id', id)
      .single()
    if (existing && !existing.publish_date && existing.status !== 'published') {
      updates.publish_date = new Date().toISOString()
    }
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('news_articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (body.content_kind === 'poll' && body.poll_options !== undefined) {
    const validation = validatePollOptions(body.poll_options)
    const { count } = await adminClient
      .from('poll_votes')
      .select('id', { count: 'exact', head: true })
      .eq('article_id', id)

    if ((count ?? 0) > 0) {
      for (const option of body.poll_options) {
        if (!option.id) continue
        await adminClient
          .from('poll_options')
          .update({ option_text: option.option_text.trim() })
          .eq('id', option.id)
          .eq('article_id', id)
      }
    } else {
      await adminClient.from('poll_options').delete().eq('article_id', id)
      const { error: optionsError } = await adminClient
        .from('poll_options')
        .insert(validation.options.map((option) => ({ ...option, article_id: id })))
      if (optionsError) return NextResponse.json({ error: optionsError.message }, { status: 500 })
    }
  }
  return NextResponse.json({ article: data })
}

// DELETE /api/admin/news/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('news_articles')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
