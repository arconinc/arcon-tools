'use client'

import Link from 'next/link'
import { ArticleTypeBadge } from './ArticleTypeBadge'
import { PollBlock } from './PollBlock'
import { formatPublishDate } from '@/lib/news-utils'
import type { NewsArticleSummary } from '@/types'

interface Props {
  article: NewsArticleSummary
}

export function ArticleCard({ article }: Props) {
  const isPoll = article.content_kind === 'poll' && article.poll

  return (
    <article
      className={`block bg-white rounded-[10px] border border-slate-200 hover:shadow-sm hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 transition-all overflow-hidden group ${
        article.pinned ? 'bg-purple-50/40 border-purple-200' : ''
      }`}
    >
      {article.cover_image_url && (
        <Link href={`/news/${article.id}`} className="block w-full h-40 overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </Link>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArticleTypeBadge type={article.type} size="sm" />
          {isPoll && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Poll</span>
          )}
          {article.pinned && (
            <span className="text-xs text-purple-700 font-semibold flex items-center gap-1">
              📌 Pinned
            </span>
          )}
          {isPoll ? (
            <span className="text-xs text-slate-400 ml-auto">{article.poll?.total_votes ?? 0} votes</span>
          ) : article.reading_time_minutes && (
            <span className="text-xs text-slate-400 ml-auto">{article.reading_time_minutes} min read</span>
          )}
        </div>
        <Link href={`/news/${article.id}`} className="block rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400">
          <h3 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2 group-hover:text-purple-700 transition-colors">
            {article.title}
          </h3>
        </Link>
        {isPoll ? (
          <div className="mt-3">
            <PollBlock articleId={article.id} poll={article.poll!} variant="card" />
          </div>
        ) : article.excerpt && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{article.excerpt}</p>
        )}
        <div className="text-xs text-slate-400 mt-3">
          {article.author_name} · {formatPublishDate(article.publish_date)}
        </div>
        {isPoll && (
          <Link href={`/news/${article.id}`} className="mt-3 inline-flex text-xs font-semibold text-purple-700 hover:text-purple-900">
            View details →
          </Link>
        )}
      </div>
    </article>
  )
}
