'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArticleTypeBadge } from '@/components/news/ArticleTypeBadge'
import { formatPublishDate, ARTICLE_TYPES, ARTICLE_TYPE_BADGE } from '@/lib/news-utils'
import type { NewsArticleWithAuthor, ArticleStatus, ArticleType } from '@/types'

const STATUS_TABS: { label: string; value: ArticleStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
]

const STATUS_PILL: Record<ArticleStatus, string> = {
  draft: 'bg-slate-100 text-slate-600',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-amber-100 text-amber-700',
}

function LoadingSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
      {[1, 2, 3, 4, 5].map((n) => (
        <div key={n} className="px-5 py-4 animate-pulse flex items-center gap-4">
          <div className="h-4 bg-slate-100 rounded w-1/3" />
          <div className="h-5 w-16 bg-slate-100 rounded-full" />
          <div className="h-4 bg-slate-100 rounded w-20 ml-auto" />
        </div>
      ))}
    </div>
  )
}

export default function NewsAdminPage() {
  const router = useRouter()
  const [articles, setArticles] = useState<NewsArticleWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all')
  const [typeFilter, setTypeFilter] = useState<ArticleType | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [mutating, setMutating] = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchArticles = useCallback(async (q?: string) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ limit: '200' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (q) params.set('q', q)

    const res = await fetch(`/api/admin/news?${params}`)
    const data = await res.json()
    if (res.ok) {
      setArticles(data.articles ?? [])
    } else {
      setError(data.error ?? 'Failed to load articles')
    }
    setLoading(false)
  }, [statusFilter, typeFilter])

  useEffect(() => {
    fetchArticles(searchQuery)
  }, [statusFilter, typeFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (val: string) => {
    setSearchQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => fetchArticles(val), 300)
  }

  async function updateStatus(id: string, status: ArticleStatus) {
    setMutating(id)
    await fetch(`/api/admin/news/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setMutating(null)
    fetchArticles(searchQuery)
  }

  async function togglePin(id: string, pinned: boolean) {
    setMutating(id)
    await fetch(`/api/admin/news/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !pinned }),
    })
    setMutating(null)
    fetchArticles(searchQuery)
  }

  async function deleteArticle() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/admin/news/${deleteTarget}`, { method: 'DELETE' })
    setDeleting(false)
    setDeleteTarget(null)
    fetchArticles(searchQuery)
  }

  const counts = {
    all: articles.length,
    draft: articles.filter((a) => a.status === 'draft').length,
    published: articles.filter((a) => a.status === 'published').length,
    archived: articles.filter((a) => a.status === 'archived').length,
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">News & Announcements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage articles published to the intranet feed</p>
        </div>
        <button
          onClick={() => router.push('/admin/news/new')}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors flex items-center gap-2"
        >
          <span>+ New Article</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', count: counts.all, color: 'text-slate-700' },
          { label: 'Published', count: counts.published, color: 'text-green-700' },
          { label: 'Draft', count: counts.draft, color: 'text-slate-500' },
          { label: 'Archived', count: counts.archived, color: 'text-amber-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Status tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Type dropdown */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ArticleType | 'all')}
          className="text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
        >
          <option value="all">All Types</option>
          {ARTICLE_TYPES.map((t) => (
            <option key={t} value={t}>{ARTICLE_TYPE_BADGE[t].label}</option>
          ))}
        </select>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by title..."
          className="flex-1 min-w-48 text-sm border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 mb-4">{error}</div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingSkeleton />
      ) : articles.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-400 text-sm">No articles found.</p>
          <button
            onClick={() => router.push('/admin/news/new')}
            className="mt-3 px-4 py-2 bg-purple-600 text-white text-sm rounded-xl hover:bg-purple-700"
          >
            Create your first article
          </button>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Pin</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Title</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Type</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Author</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs">Read</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {articles.map((article) => (
                <tr key={article.id} className="hover:bg-slate-50 transition-colors">
                  {/* Pin */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => togglePin(article.id, article.pinned)}
                      disabled={mutating === article.id}
                      title={article.pinned ? 'Unpin' : 'Pin'}
                      className={`text-base transition-opacity ${article.pinned ? 'opacity-100' : 'opacity-20 hover:opacity-60'}`}
                    >
                      📌
                    </button>
                  </td>

                  {/* Title */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/news/${article.id}`}
                      className="font-medium text-slate-900 hover:text-purple-700 transition-colors line-clamp-1"
                    >
                      {article.title}
                    </Link>
                    {article.excerpt && (
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{article.excerpt}</p>
                    )}
                  </td>

                  {/* Type */}
                  <td className="px-4 py-3">
                    <ArticleTypeBadge type={article.type} size="sm" />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_PILL[article.status]}`}>
                      {article.status}
                    </span>
                  </td>

                  {/* Author */}
                  <td className="px-4 py-3 text-slate-500">
                    {(article.author as { display_name: string })?.display_name ?? '—'}
                  </td>

                  {/* Publish date */}
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatPublishDate(article.publish_date)}
                  </td>

                  {/* Reading time */}
                  <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                    {article.reading_time_minutes ? `${article.reading_time_minutes} min` : '—'}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/news/${article.id}`}
                        className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        Edit
                      </Link>

                      {/* Status quick-change */}
                      <select
                        value={article.status}
                        onChange={(e) => updateStatus(article.id, e.target.value as ArticleStatus)}
                        disabled={mutating === article.id}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white disabled:opacity-50"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                        <option value="archived">Archived</option>
                      </select>

                      <button
                        onClick={() => setDeleteTarget(article.id)}
                        className="px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Delete article?</h3>
            <p className="text-sm text-slate-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm border border-slate-300 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteArticle}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
