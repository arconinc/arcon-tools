'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TiptapEditor } from '@/components/news/TiptapEditor'
import { TiptapRenderer } from '@/components/news/TiptapRenderer'
import { ARTICLE_TYPES, ARTICLE_TYPE_BADGE, computeReadingTime, stripHtml } from '@/lib/news-utils'
import type { NewsArticle, ArticleType, ArticleStatus } from '@/types'

const EMPTY_CONTENT = {}

interface Props {
  params: Promise<{ id: string }>
}

export default function ArticleEditorPage({ params }: Props) {
  const { id } = use(params)
  const isNew = id === 'new'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [preview, setPreview] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)

  const [title, setTitle] = useState('')
  const [type, setType] = useState<ArticleType>('GENERAL')
  const [status, setStatus] = useState<ArticleStatus>('draft')
  const [publishDate, setPublishDate] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [pinned, setPinned] = useState(false)
  const [contentJson, setContentJson] = useState<Record<string, unknown>>(EMPTY_CONTENT)
  const [contentHtml, setContentHtml] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDirty = useRef(false)

  // Load existing article
  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/news/${id}`)
      .then((r) => r.json())
      .then(({ article }: { article: NewsArticle }) => {
        if (!article) return
        setTitle(article.title)
        setType(article.type)
        setStatus(article.status)
        setPublishDate(article.publish_date ? article.publish_date.slice(0, 16) : '')
        setCoverImageUrl(article.cover_image_url ?? '')
        setPinned(article.pinned)
        setContentJson(article.content_json ?? EMPTY_CONTENT)
        setContentHtml(article.content_html ?? '')
      })
      .catch(() => setError('Failed to load article'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  // Warn on unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const wordCount = stripHtml(contentHtml).split(/\s+/).filter(Boolean).length
  const estimatedRead = computeReadingTime(contentHtml)

  async function save(targetStatus: ArticleStatus) {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      title,
      type,
      status: targetStatus,
      content_json: contentJson,
      content_html: contentHtml,
      cover_image_url: coverImageUrl || null,
      pinned,
      publish_date: publishDate ? new Date(publishDate).toISOString() : null,
    }

    const url = isNew ? '/api/admin/news' : `/api/admin/news/${id}`
    const method = isNew ? 'POST' : 'PUT'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }

    isDirty.current = false
    setSuccess(targetStatus === 'published' ? 'Article published!' : 'Draft saved.')
    setSaving(false)

    if (isNew && data.article?.id) {
      router.replace(`/admin/news/${data.article.id}`)
    } else {
      setStatus(targetStatus)
      setTimeout(() => setSuccess(null), 3000)
    }
  }

  async function archiveArticle() {
    setSaving(true)
    await fetch(`/api/admin/news/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'archived' }),
    })
    setSaving(false)
    setArchiveConfirm(false)
    router.push('/admin/news')
  }

  async function uploadCoverImage(file: File) {
    setUploadingCover(true)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/admin/news/upload', { method: 'POST', body: formData })
    const data = await res.json()
    setUploadingCover(false)
    if (res.ok && data.url) {
      setCoverImageUrl(data.url)
      isDirty.current = true
    } else {
      setError(data.error ?? 'Upload failed')
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-4xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-100 rounded w-1/2" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/admin/news" className="text-slate-400 hover:text-slate-600 text-sm">
            ← Back
          </Link>
          <h1 className="text-xl font-semibold text-slate-900">
            {isNew ? 'New Article' : 'Edit Article'}
          </h1>
          {!isNew && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              status === 'published' ? 'bg-green-100 text-green-700' :
              status === 'archived' ? 'bg-amber-100 text-amber-700' :
              'bg-slate-100 text-slate-600'
            }`}>
              {status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
          {!isNew && status !== 'archived' && (
            <button
              onClick={() => setArchiveConfirm(true)}
              className="px-3 py-1.5 text-sm border border-amber-300 text-amber-700 rounded-xl hover:bg-amber-50"
            >
              Archive
            </button>
          )}
          <button
            onClick={() => { isDirty.current = true; save('draft') }}
            disabled={saving}
            className="px-4 py-2 text-sm border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            onClick={() => { isDirty.current = true; save('published') }}
            disabled={saving}
            className="px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-xl disabled:opacity-50 font-medium"
          >
            {saving ? 'Saving...' : status === 'published' ? 'Update' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="p-3 mb-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">{success}</div>
      )}

      {preview ? (
        /* ── Preview Mode ── */
        <div className="bg-white border border-slate-200 rounded-2xl p-8">
          {coverImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImageUrl} alt="" className="w-full max-h-64 object-cover rounded-xl mb-6" />
          )}
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ARTICLE_TYPE_BADGE[type]?.bg} ${ARTICLE_TYPE_BADGE[type]?.text}`}>
              {ARTICLE_TYPE_BADGE[type]?.label}
            </span>
            {pinned && <span className="text-xs text-purple-600 font-medium">📌 Pinned</span>}
            <span className="text-xs text-slate-400 ml-auto">{estimatedRead} min read</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-6">{title || 'Untitled Article'}</h1>
          {contentHtml ? (
            <TiptapRenderer html={contentHtml} />
          ) : (
            <p className="text-slate-400 italic">No content yet.</p>
          )}
        </div>
      ) : (
        /* ── Edit Mode ── */
        <div className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); isDirty.current = true }}
              placeholder="Article title..."
              className="w-full text-lg font-medium border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          {/* Type + Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Category</label>
              <select
                value={type}
                onChange={(e) => { setType(e.target.value as ArticleType); isDirty.current = true }}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                {ARTICLE_TYPES.map((t) => (
                  <option key={t} value={t}>{ARTICLE_TYPE_BADGE[t].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Publish Date</label>
              <input
                type="datetime-local"
                value={publishDate}
                onChange={(e) => { setPublishDate(e.target.value); isDirty.current = true }}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          {/* Cover image */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Cover Image</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={coverImageUrl}
                onChange={(e) => { setCoverImageUrl(e.target.value); isDirty.current = true }}
                placeholder="https://... or upload below"
                className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCover}
                className="px-4 py-2 text-sm border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-700 whitespace-nowrap disabled:opacity-50"
              >
                {uploadingCover ? 'Uploading...' : 'Upload'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) uploadCoverImage(file)
                }}
              />
            </div>
            {coverImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverImageUrl} alt="Cover preview" className="mt-2 h-28 w-full object-cover rounded-xl border border-slate-200" />
            )}
          </div>

          {/* Pin option */}
          <div className="flex items-center gap-2">
            <input
              id="pinned"
              type="checkbox"
              checked={pinned}
              onChange={(e) => { setPinned(e.target.checked); isDirty.current = true }}
              className="w-4 h-4 accent-purple-600"
            />
            <label htmlFor="pinned" className="text-sm text-slate-700 cursor-pointer">
              📌 Pin to top of news feed
            </label>
          </div>

          {/* Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-600">Content</label>
              <span className="text-xs text-slate-400">
                {wordCount} words · {estimatedRead} min read
              </span>
            </div>
            <TiptapEditor
              content={contentJson}
              onChange={(json, html) => {
                setContentJson(json)
                setContentHtml(html)
                isDirty.current = true
              }}
              minHeight="400px"
            />
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {archiveConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <h3 className="font-semibold text-slate-900 mb-2">Archive this article?</h3>
            <p className="text-sm text-slate-500 mb-5">It will be removed from the news feed but not deleted.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setArchiveConfirm(false)} className="px-4 py-2 text-sm border border-slate-300 rounded-xl hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={archiveArticle}
                disabled={saving}
                className="px-4 py-2 text-sm bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50"
              >
                {saving ? 'Archiving...' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
