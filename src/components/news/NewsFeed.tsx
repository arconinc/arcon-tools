'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArticleCard } from './ArticleCard'
import { ARTICLE_TYPES, ARTICLE_TYPE_BADGE } from '@/lib/news-utils'
import type { NewsArticleSummary, ArticleType } from '@/types'

const PAGE_SIZE = 6

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
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
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeType, setActiveType] = useState<ArticleType | 'all'>('all')
  const [availableTypes, setAvailableTypes] = useState<ArticleType[]>([])
  const [offset, setOffset] = useState(0)

  async function fetchArticles(typeFilter: ArticleType | 'all', currentOffset: number, append = false) {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(currentOffset) })
    if (typeFilter !== 'all') params.set('type', typeFilter)

    const res = await fetch(`/api/news?${params}`)
    const data = await res.json()
    if (res.ok) {
      setTotal(data.total)
      if (append) {
        setArticles((prev) => [...prev, ...(data.articles ?? [])])
      } else {
        setArticles(data.articles ?? [])
        // Compute which types are present
        const types = [...new Set((data.articles ?? []).map((a: NewsArticleSummary) => a.type))] as ArticleType[]
        setAvailableTypes(types)
      }
    }
  }

  useEffect(() => {
    setLoading(true)
    fetchArticles('all', 0).finally(() => setLoading(false))
  }, [])

  async function handleTypeChange(type: ArticleType | 'all') {
    setActiveType(type)
    setOffset(0)
    setLoading(true)
    await fetchArticles(type, 0)
    setLoading(false)
  }

  async function loadMore() {
    const nextOffset = offset + PAGE_SIZE
    setOffset(nextOffset)
    setLoadingMore(true)
    await fetchArticles(activeType, nextOffset, true)
    setLoadingMore(false)
  }

  const hasMore = articles.length < total

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">News & Announcements</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
        </div>
      </div>
    )
  }

  if (!loading && articles.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">News & Announcements</h2>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
          No announcements yet.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">News & Announcements</h2>
        <Link href="/news" className="text-xs text-purple-600 hover:text-purple-800 font-medium">
          View All →
        </Link>
      </div>

      {/* Type filter tabs */}
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => handleTypeChange('all')}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
              activeType === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {ARTICLE_TYPES.filter((t) => availableTypes.includes(t)).map((type) => (
            <button
              key={type}
              onClick={() => handleTypeChange(type)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
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

      {/* Article grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}
