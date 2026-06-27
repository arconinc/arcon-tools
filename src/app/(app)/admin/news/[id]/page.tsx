'use client'

import { useState, useEffect, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { TiptapEditor } from '@/components/news/TiptapEditor'
import { TiptapRenderer } from '@/components/news/TiptapRenderer'
import { ARTICLE_TYPES, ARTICLE_TYPE_BADGE, computeReadingTime, stripHtml } from '@/lib/news-utils'
import type { NewsArticle, ArticleType, ArticleStatus, ArticleContentKind } from '@/types'
import { ConfirmButton } from '@/components/ui/ConfirmButton'

const EMPTY_CONTENT = {}
const DEFAULT_POLL_OPTIONS = [
  { option_text: '', sort_order: 0 },
  { option_text: '', sort_order: 1 },
]

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

  const [uploadingCover, setUploadingCover] = useState(false)

  const [title, setTitle] = useState('')
  const [contentKind, setContentKind] = useState<ArticleContentKind>('article')
  const [type, setType] = useState<ArticleType>('GENERAL')
  const [status, setStatus] = useState<ArticleStatus>('draft')
  const [publishDate, setPublishDate] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [pinned, setPinned] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollIsAnonymous, setPollIsAnonymous] = useState(true)
  const [pollOptions, setPollOptions] = useState<{ id?: string; option_text: string; sort_order: number; vote_count?: number }[]>(DEFAULT_POLL_OPTIONS)
  const [pollHasVotes, setPollHasVotes] = useState(false)
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
        setContentKind(article.content_kind ?? 'article')
        setType(article.type)
        setStatus(article.status)
        setPublishDate(article.publish_date ? article.publish_date.slice(0, 16) : '')
        setCoverImageUrl(article.cover_image_url ?? '')
        setPinned(article.pinned)
        setPollQuestion(article.poll_question ?? '')
        setPollIsAnonymous(article.poll_is_anonymous ?? true)
        if (article.poll?.options?.length) {
          setPollOptions(article.poll.options.map((option) => ({
            id: option.id,
            option_text: option.option_text,
            sort_order: option.sort_order,
            vote_count: option.vote_count,
          })))
          setPollHasVotes(article.poll.total_votes > 0)
        }
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
    if (contentKind === 'poll') {
      const cleanOptions = pollOptions.filter((option) => option.option_text.trim())
      if (!pollQuestion.trim()) {
        setError('Poll question is required')
        return
      }
      if (cleanOptions.length < 1 || cleanOptions.length > 10) {
        setError('Polls require 1-10 options')
        return
      }
    }
    setSaving(true)
    setError(null)
    setSuccess(null)

    const payload = {
      title,
      content_kind: contentKind,
      type,
      status: targetStatus,
      content_json: contentJson,
      content_html: contentHtml,
      cover_image_url: coverImageUrl || null,
      pinned,
      publish_date: publishDate ? new Date(publishDate).toISOString() : null,
      poll_question: contentKind === 'poll' ? pollQuestion : null,
      poll_is_anonymous: pollIsAnonymous,
      poll_options: contentKind === 'poll'
        ? pollOptions.map((option, index) => ({ ...option, sort_order: index }))
        : undefined,
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
            <ConfirmButton
              idleLabel="Archive"
              confirmLabel="Yes, archive?"
              onConfirm={archiveArticle}
              variant="yellow"
              disabled={saving}
            />
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
            {contentKind === 'poll' && <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">Poll</span>}
            {pinned && <span className="text-xs text-purple-600 font-medium">📌 Pinned</span>}
            <span className="text-xs text-slate-400 ml-auto">{estimatedRead} min read</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-6">{title || 'Untitled Article'}</h1>
          {contentKind === 'poll' && (
            <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900 mb-3">{pollQuestion || 'Poll question...'}</p>
              <div className="space-y-2">
                {pollOptions.filter((option) => option.option_text.trim()).map((option, index) => (
                  <div key={option.id ?? index} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                    {option.option_text}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-400">
                {pollIsAnonymous ? 'Anonymous poll: only admins can see voters.' : 'Non-anonymous poll: voters visible on detail page.'}
              </p>
            </div>
          )}
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

          {/* Content kind */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Format</label>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              {(['article', 'poll'] as ArticleContentKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => { setContentKind(kind); isDirty.current = true }}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                    contentKind === kind ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {kind === 'article' ? 'Article' : 'Poll'}
                </button>
              ))}
            </div>
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

          {contentKind === 'poll' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Poll Question *</label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => { setPollQuestion(e.target.value); isDirty.current = true }}
                  placeholder="What should we ask?"
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-600">Options *</label>
                  <span className="text-xs text-slate-400">{pollOptions.length}/10</span>
                </div>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={option.id ?? index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={option.option_text}
                        onChange={(e) => {
                          setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, option_text: e.target.value } : item))
                          isDirty.current = true
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      {pollHasVotes && (
                        <span className="w-16 text-right text-xs text-slate-400">{option.vote_count ?? 0} votes</span>
                      )}
                      {!pollHasVotes && pollOptions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => { setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index)); isDirty.current = true }}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {!pollHasVotes && pollOptions.length < 10 && (
                  <button
                    type="button"
                    onClick={() => { setPollOptions((current) => [...current, { option_text: '', sort_order: current.length }]); isDirty.current = true }}
                    className="mt-3 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700"
                  >
                    + Add option
                  </button>
                )}
                {pollHasVotes && <p className="mt-2 text-xs text-slate-400">Options cannot be added or removed after voting starts.</p>}
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={pollIsAnonymous}
                  onChange={(e) => { setPollIsAnonymous(e.target.checked); isDirty.current = true }}
                  className="mt-0.5 w-4 h-4 accent-purple-600"
                />
                <span>
                  Anonymous poll
                  <span className="block text-xs text-slate-400">If checked, only admins can see who voted for what.</span>
                </span>
              </label>
            </div>
          )}

          {/* Editor */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-600">Content</label>
              <span className="text-xs text-slate-400">
                {contentKind === 'poll' ? 'Optional detail page content' : `${wordCount} words · ${estimatedRead} min read`}
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


    </div>
  )
}
