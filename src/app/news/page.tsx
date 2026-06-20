import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import { ArticleCard } from '@/components/news/ArticleCard'
import { formatPublishDate } from '@/lib/news-utils'
import type { NewsArticleSummary } from '@/types'

export default async function NewsListingPage() {
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

  const { data: articles } = await adminClient
    .from('news_articles')
    .select(`
      id, title, type, excerpt, cover_image_url, pinned,
      reading_time_minutes, publish_date,
      author:users!created_by(display_name)
    `)
    .eq('status', 'published')
    .order('pinned', { ascending: false })
    .order('publish_date', { ascending: false })
    .limit(50)

  const summaries: NewsArticleSummary[] = (articles ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    type: a.type,
    excerpt: a.excerpt,
    cover_image_url: a.cover_image_url,
    pinned: a.pinned,
    reading_time_minutes: a.reading_time_minutes,
    publish_date: a.publish_date,
    author_name: (a.author as unknown as { display_name: string } | null)?.display_name ?? 'Unknown',
  }))

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null

  return (
    <AppShell user={{ ...appUser, avatar_url: avatarUrl }}>
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">News & Announcements</h1>
            <p className="text-sm text-slate-500 mt-1">{summaries.length} published article{summaries.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-400 hover:text-purple-600">
            ← Dashboard
          </Link>
        </div>

        {summaries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center">
            <p className="text-slate-400">No articles published yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {summaries.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
