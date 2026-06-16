'use client'

import { useState, useRef } from 'react'
import { formatDateTime, formatBytes } from '@/lib/format'
import type { Comment } from '@/hooks/useTask'

function isImageMime(mime: string | null) {
  return mime?.startsWith('image/') ?? false
}

export function CommentsTab({
  taskId,
  comments,
  currentUserId,
  isAdmin,
  onRefresh,
}: {
  taskId: string
  comments: Comment[]
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLabel, setDriveLabel] = useState('')
  const [showDriveForm, setShowDriveForm] = useState(false)
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null)
  const [uploadingCommentId, setUploadingCommentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function submitComment() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text.trim() }),
      })
      if (res.ok) {
        setText('')
        onRefresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteComment(cid: string) {
    if (!confirm('Delete this comment?')) return
    await fetch(`/api/marketing/tasks/${taskId}/comments/${cid}`, { method: 'DELETE' })
    onRefresh()
  }

  async function addDriveLink(cid: string) {
    if (!driveUrl.trim() || !driveLabel.trim()) return
    await fetch(`/api/marketing/tasks/${taskId}/comments/${cid}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: driveUrl.trim(), label: driveLabel.trim(), is_drive_link: true }),
    })
    setDriveUrl('')
    setDriveLabel('')
    setShowDriveForm(false)
    setPendingCommentId(null)
    onRefresh()
  }

  async function uploadFile(cid: string, file: File) {
    setUploadingCommentId(cid)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) { alert('Upload failed'); return }
      const uploaded = await uploadRes.json()
      await fetch(`/api/marketing/tasks/${taskId}/comments/${cid}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploaded.url,
          label: uploaded.file_name,
          file_name: uploaded.file_name,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          is_drive_link: false,
        }),
      })
      onRefresh()
    } finally {
      setUploadingCommentId(null)
    }
  }

  async function deleteAttachment(cid: string, aid: string) {
    if (!confirm('Remove this attachment?')) return
    await fetch(`/api/marketing/tasks/${taskId}/comments/${cid}/attachments/${aid}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-5">
      {/* New comment */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-700 mb-3">Add Comment</div>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-3"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={submitComment}
            disabled={submitting || !text.trim()}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Posting…' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 && (
        <div className="text-center text-sm text-slate-400 py-6">No comments yet. Be the first to comment!</div>
      )}

      {comments.map((c) => (
        <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                {c.user.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-slate-800">{c.user.display_name}</span>
              <span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
            </div>
            {(c.user_id === currentUserId || isAdmin) && (
              <button
                onClick={() => deleteComment(c.id)}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                Delete
              </button>
            )}
          </div>

          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">{c.comment}</p>

          {/* Attachments */}
          {c.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {c.attachments.map((att) => (
                <div key={att.id} className="group relative">
                  {isImageMime(att.mime_type) ? (
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-300 transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.url} alt={att.label} className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors">
                      {att.is_drive_link ? (
                        <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.19 2l4.5 7.79H2l4.19-7.79zM12 2l6.19 10.72H5.81L12 2zM22 14.39L17.81 22H6.19L2 14.39h20z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      <span className="truncate max-w-[120px]">{att.label}</span>
                      {att.file_size && <span className="text-slate-400 flex-shrink-0">{formatBytes(att.file_size)}</span>}
                    </a>
                  )}
                  {(att.uploaded_by === currentUserId || isAdmin) && (
                    <button
                      onClick={() => deleteAttachment(c.id, att.id)}
                      className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center text-xs leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attach to this comment */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={c.id === pendingCommentId ? fileInputRef : undefined}
              type="file"
              className="hidden"
              id={`file-input-${c.id}`}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await uploadFile(c.id, file)
                e.target.value = ''
              }}
            />
            <label
              htmlFor={`file-input-${c.id}`}
              className="cursor-pointer text-xs text-slate-400 hover:text-purple-700 transition-colors flex items-center gap-1"
            >
              {uploadingCommentId === c.id ? (
                <span>Uploading…</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach file
                </>
              )}
            </label>

            <button
              onClick={() => {
                setPendingCommentId(c.id)
                setShowDriveForm((prev) => !prev || pendingCommentId !== c.id)
              }}
              className="text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.19 2l4.5 7.79H2l4.19-7.79zM12 2l6.19 10.72H5.81L12 2zM22 14.39L17.81 22H6.19L2 14.39h20z" />
              </svg>
              Add Drive link
            </button>
          </div>

          {/* Drive link inline form */}
          {showDriveForm && pendingCommentId === c.id && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="Google Drive URL"
                className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <input
                type="text"
                value={driveLabel}
                onChange={(e) => setDriveLabel(e.target.value)}
                placeholder="Label (e.g. Design Brief v2)"
                className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => addDriveLink(c.id)}
                  disabled={!driveUrl.trim() || !driveLabel.trim()}
                  className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  Add Link
                </button>
                <button
                  onClick={() => { setShowDriveForm(false); setPendingCommentId(null) }}
                  className="px-3 py-1 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
