'use client'

import { useEffect, useState } from 'react'
import EmployeeAvatar from '@/components/employees/EmployeeAvatar'
import { formatRelative } from '@/lib/format'

interface CommentUser {
  id: string
  display_name: string
  avatar_url: string | null
  profile_image_url: string | null
}

interface NewsComment {
  id: string
  comment: string
  created_at: string
  user_id: string
  user: CommentUser | null
}

interface CommentSectionProps {
  articleId: string
  currentUserId: string
  isAdmin: boolean
}

export function CommentSection({ articleId, currentUserId, isAdmin }: CommentSectionProps) {
  const [comments, setComments] = useState<NewsComment[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/news/${articleId}/comments`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setComments(Array.isArray(data) ? data : [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [articleId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body || submitting) return
    setSubmitting(true)
    setError(null)

    const res = await fetch(`/api/news/${articleId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: body }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? 'Could not post comment')
      return
    }
    setComments((prev) => [...prev, data])
    setDraft('')
  }

  async function remove(id: string) {
    if (!confirm('Delete this comment?')) return
    const res = await fetch(`/api/news/${articleId}/comments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not delete comment')
      return
    }
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  return (
    <section id="comments" className="mt-12 pt-8 border-t border-slate-100 scroll-mt-24">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">
        {loading ? 'Comments' : `${comments.length} Comment${comments.length === 1 ? '' : 's'}`}
      </h2>

      {comments.length > 0 && (
        <ul className="space-y-6 mb-8">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <EmployeeAvatar
                displayName={c.user?.display_name ?? 'Unknown'}
                profileImageUrl={c.user?.profile_image_url}
                avatarUrl={c.user?.avatar_url}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-slate-900">{c.user?.display_name ?? 'Unknown'}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{formatRelative(c.created_at)}</span>
                  {(c.user_id === currentUserId || isAdmin) && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="ml-auto text-xs text-slate-400 hover:text-red-600 transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 text-slate-700 whitespace-pre-wrap break-words">{c.comment}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && comments.length === 0 && (
        <p className="text-sm text-slate-400 mb-8">No comments yet. Start the conversation.</p>
      )}

      <form onSubmit={submit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder="Leave a comment…"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={!draft.trim() || submitting}
            className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Posting…' : 'Post Comment'}
          </button>
        </div>
      </form>
    </section>
  )
}
