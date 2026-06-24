'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArticleCard } from './ArticleCard'
import { ARTICLE_TYPES, ARTICLE_TYPE_BADGE } from '@/lib/news-utils'
import type { NewsArticleSummary, ArticleType } from '@/types'

const PAGE_SIZE = 30

function SkeletonCard() {
  return (
    <div
      className="bg-white rounded-[10px] border border-slate-200 p-4 animate-pulse flex-shrink-0"
      style={{ width: 'calc(33.333% - 11px)', minWidth: 240 }}
    >
      <div className="flex gap-2 mb-3">
        <div className="h-5 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-full mb-1" />
      <div className="h-3 bg-slate-100 rounded w-2/3" />
    </div>
  )
}

export function NewsFeed() {
  const [articles, setArticles] = useState<NewsArticleSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<ArticleType | 'all'>('all')
  const [availableTypes, setAvailableTypes] = useState<ArticleType[]>([])

  async function fetchArticles(typeFilter: ArticleType | 'all') {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: '0' })
    if (typeFilter !== 'all') params.set('type', typeFilter)

    const res = await fetch(`/api/news?${params}`)
    const data = await res.json()
    if (res.ok) {
      const fetched: NewsArticleSummary[] = data.articles ?? []
      setArticles(fetched)
      if (typeFilter === 'all') {
        const types = [...new Set(fetched.map((a) => a.type))] as ArticleType[]
        setAvailableTypes(types)
      }
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchArticles('all').finally(() => setLoading(false))
  }, [])

  async function handleTypeChange(type: ArticleType | 'all') {
    setActiveType(type)
    setLoading(true)
    await fetchArticles(type)
    setLoading(false)
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold text-slate-900">News & Announcements</h2>
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[13px] font-bold text-slate-900">News & Announcements</h2>
        </div>
        <div className="bg-white rounded-[10px] border border-slate-200 p-8 text-center text-slate-500 text-sm">
          No announcements yet.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[13px] font-bold text-slate-900">News & Announcements</h2>
        <Link href="/news" className="text-xs text-purple-700 hover:text-purple-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 rounded font-semibold">
          View All →
        </Link>
      </div>

      {/* Type filter tabs */}
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleTypeChange('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 ${
              activeType === 'all'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {ARTICLE_TYPES.filter((t) => availableTypes.includes(t)).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-400 ${
                activeType === type
                  ? `${ARTICLE_TYPE_BADGE[type].bg} ${ARTICLE_TYPE_BADGE[type].text}`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {ARTICLE_TYPE_BADGE[type].label}
            </button>
          ))}
        </div>
      )}

      {/* Horizontally scrollable article row — shows 3 at a time */}
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
      >
        {articles.map((article) => (
          <div
            key={article.id}
            className="flex-shrink-0"
            style={{ width: 'calc(33.333% - 11px)', minWidth: 240, scrollSnapAlign: 'start' }}
          >
            <ArticleCard article={article} />
          </div>
        ))}
      </div>
    </div>
  )
}
