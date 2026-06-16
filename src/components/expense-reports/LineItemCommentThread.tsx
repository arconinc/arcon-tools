'use client'

import { useState } from 'react'
import type { ExpenseReportComment } from '@/types'

export function LineItemCommentThread({
  comment,
  reportId,
  isReviewer,
  onRefresh,
}: {
  comment: ExpenseReportComment
  reportId: string
  isReviewer: boolean
  onRefresh: () => void
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)

  async function sendReply() {
    if (!replyBody.trim()) return
    setSending(true)
    await fetch(`/api/expense-reports/${reportId}/comments/${comment.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody.trim() }),
    })
    setReplyBody('')
    setShowReply(false)
    setSending(false)
    onRefresh()
  }

  async function toggleResolve() {
    setResolving(true)
    await fetch(`/api/expense-reports/${reportId}/comments/${comment.id}/resolve`, { method: 'POST' })
    setResolving(false)
    onRefresh()
  }

  const isResolved = !!comment.resolved_at

  return (
    <div style={{ background: isResolved ? '#f9fafb' : '#fef9c3', borderRadius: 8, padding: '10px 12px', marginBottom: 8, border: `1px solid ${isResolved ? '#e5e7eb' : '#fde68a'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 12, color: '#1e1b4b' }}>{comment.author?.display_name ?? 'Unknown'}</strong>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {new Date(comment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
            {isResolved && <span style={{ fontSize: 11, color: '#9ca3af' }}>· resolved</span>}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: isResolved ? '#6b7280' : '#374151' }}>{comment.body}</p>
          {(comment.replies ?? []).map(r => (
            <div key={r.id} style={{ marginLeft: 12, marginTop: 6, paddingLeft: 10, borderLeft: '2px solid #e5e7eb' }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 1 }}>
                <strong style={{ fontSize: 11, color: '#1e1b4b' }}>{r.author?.display_name ?? 'Unknown'}</strong>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>
                  {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: '#374151' }}>{r.body}</p>
            </div>
          ))}
          {!isResolved && (
            <div style={{ marginTop: 6 }}>
              {showReply ? (
                <div>
                  <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} placeholder="Reply…" rows={2} style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 12, boxSizing: 'border-box', resize: 'none' }} />
                  <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                    <button onClick={sendReply} disabled={sending || !replyBody.trim()} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 5, fontSize: 12, cursor: 'pointer', opacity: (sending || !replyBody.trim()) ? 0.6 : 1 }}>
                      {sending ? '…' : 'Reply'}
                    </button>
                    <button onClick={() => { setShowReply(false); setReplyBody('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowReply(true)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, cursor: 'pointer', padding: 0, fontWeight: 600 }}>↳ Reply</button>
              )}
            </div>
          )}
        </div>
        {isReviewer && (
          <button onClick={toggleResolve} disabled={resolving} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '3px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap', color: '#6b7280', flexShrink: 0 }}>
            {isResolved ? '↩ Reopen' : '✓ Resolve'}
          </button>
        )}
      </div>
    </div>
  )
}
