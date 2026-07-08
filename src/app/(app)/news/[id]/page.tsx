import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TiptapRenderer } from '@/components/news/TiptapRenderer'
import { ArticleTypeBadge } from '@/components/news/ArticleTypeBadge'
import { formatPublishDate } from '@/lib/news-utils'
import { getPollData } from '@/lib/poll-utils'
import { PollBlock } from '@/components/news/PollBlock'
import type { NewsArticle, ArticleType } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ArticleReaderPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, email, display_name, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!appUser) redirect('/login')

  const { data: article } = await adminClient
    .from('news_articles')
    .select(`
      *,
      author:users!created_by(id, display_name, email)
    `)
    .eq('id', id)
    .eq('status', 'published')
    .single()

  if (!article) notFound()

  const a = article as NewsArticle & { author: { display_name: string } }
  const poll = a.content_kind === 'poll'
    ? await getPollData(a.id, appUser.id, !a.poll_is_anonymous || appUser.is_admin)
    : undefined

  return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back */}
        <Link href="/news" className="text-sm text-slate-400 hover:text-purple-600 flex items-center gap-1 mb-6 transition-colors">
          ← Back to News
        </Link>

        {/* Cover image */}
        {a.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.cover_image_url}
            alt={a.title}
            className="w-full max-h-72 object-cover rounded-2xl mb-8"
          />
        )}

        {/* Meta */}
        <div className="flex items-center gap-3 mb-4">
          <ArticleTypeBadge type={a.type as ArticleType} />
          {a.content_kind === 'poll' && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">Poll</span>
          )}
          {a.pinned && <span className="text-sm text-purple-600 font-medium">📌 Pinned</span>}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-slate-900 mb-4 leading-tight">{a.title}</h1>

        {/* Author + date + reading time */}
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-8 pb-8 border-b border-slate-100">
          <span>{a.author?.display_name ?? 'Unknown'}</span>
          <span>·</span>
          <span>{formatPublishDate(a.publish_date)}</span>
          {a.reading_time_minutes && (
            <>
              <span>·</span>
              <span>{a.reading_time_minutes} min read</span>
            </>
          )}
        </div>

        {/* Content */}
        {a.content_html ? (
          <TiptapRenderer html={a.content_html} />
        ) : a.content_kind !== 'poll' ? (
          <p className="text-slate-400 italic">No content available.</p>
        ) : null}

        {poll && (
          <div className="mt-8">
            <PollBlock articleId={a.id} poll={poll} showVoters={poll.can_view_voters ?? false} variant="detail" />
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-100">
          <Link href="/news" className="text-sm text-purple-600 hover:text-purple-800 font-medium">
            ← Back to all news
          </Link>
        </div>
      </div>
  )
}
