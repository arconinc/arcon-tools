'use client'

import Link from 'next/link'
import { ArticleTypeBadge } from './ArticleTypeBadge'
import { formatPublishDate } from '@/lib/news-utils'
import type { NewsArticleSummary } from '@/types'

interface Props {
  article: NewsArticleSummary
}

export function ArticleCard({ article }: Props) {
  return (
    <Link
      href={`/news/${article.id}`}
      className={`block bg-white rounded-2xl border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all overflow-hidden group ${
        article.pinned ? 'border-l-4 border-l-purple-500' : ''
      }`}
    >
      {article.cover_image_url && (
        <div className="w-full h-40 overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.cover_image_url}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <ArticleTypeBadge type={article.type} size="sm" />
          {article.pinned && (
            <span className="text-xs text-purple-600 font-medium flex items-center gap-1">
              📌 Pinned
            </span>
          )}
          {article.reading_time_minutes && (
            <span className="text-xs text-slate-400 ml-auto">{article.reading_time_minutes} min read</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-2 group-hover:text-purple-700 transition-colors">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{article.excerpt}</p>
        )}
        <div className="text-xs text-slate-400">
          {article.author_name} · {formatPublishDate(article.publish_date)}
        </div>
      </div>
    </Link>
  )
}
