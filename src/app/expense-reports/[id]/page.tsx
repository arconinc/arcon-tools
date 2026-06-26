'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ExpenseReportLineItem, ExpenseReportVersion, ExpenseReportComment } from '@/types'
import { ConfirmButton } from '@/components/ui/ConfirmButton'

interface ReportDetail {
  id: string
  created_by: string
  period_month: string
  title: string | null
  status: string
  reviewer_comment: string | null
  created_at: string
  updated_at: string
  submitter: { id: string; display_name: string; email: string } | null
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatCurrency(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; description: string }> = {
  draft:                { label: 'In Progress',          bg: '#f3f4f6', color: '#374151', description: 'Still being edited. Submit when ready for review.' },
  submitted:            { label: 'Submitted',            bg: '#dbeafe', color: '#1d4ed8', description: 'Submitted and awaiting review.' },
  needs_changes:        { label: 'Changes Needed',       bg: '#fef3c7', color: '#92400e', description: 'The reviewer has requested changes. Open the editor, make corrections, and resubmit.' },
  approved:             { label: 'Approved',             bg: '#dcfce7', color: '#166534', description: 'Report has been approved.' },
  submitted_to_payroll: { label: 'Submitted to Payroll', bg: '#ede9fe', color: '#5b21b6', description: 'Submitted to payroll for reimbursement.' },
}

const VERSION_ACTIONS: Record<string, { label: string; icon: string }> = {
  created:              { label: 'Report created',         icon: '📄' },
  submitted:            { label: 'Submitted for review',   icon: '📤' },
  needs_changes:        { label: 'Changes requested',      icon: '↩' },
  approved:             { label: 'Approved',               icon: '✓' },
  submitted_to_payroll: { label: 'Submitted to payroll',   icon: '💰' },
  updated:              { label: 'Updated',                icon: '✏️' },
}

function CommentThread({
  comment,
  reportId,
  canComment,
  onRefresh,
}: {
  comment: ExpenseReportComment
  reportId: string
  canComment: boolean
  onRefresh: () => void
}) {
  const [showReply, setShowReply] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [showResolved, setShowResolved] = useState(false)

  const isResolved = !!comment.resolved_at
  const replies = comment.replies ?? []

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

  if (isResolved && !showResolved) {
    return (
      <div style={{ padding: '6px 0' }}>
        <button onClick={() => setShowResolved(true)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', padding: 0 }}>
          ✓ Show resolved comment
        </button>
      </div>
    )
  }

  return (
    <div style={{ borderLeft: `3px solid ${isResolved ? '#d1d5db' : '#7c3aed'}`, paddingLeft: 12, marginBottom: 12, opacity: isResolved ? 0.65 : 1 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
        {comment.author?.avatar_url ? (
          <img src={comment.author.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 2 }} />
        ) : (
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#ede9fe', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>
            {(comment.author?.display_name ?? '?')[0]}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 2 }}>
            <strong style={{ fontSize: 13, color: '#1e1b4b' }}>{comment.author?.display_name ?? 'Unknown'}</strong>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDate(comment.created_at)}</span>
            {isResolved && <span style={{ fontSize: 11, color: '#9ca3af' }}>· resolved</span>}
          </div>
          <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{comment.body}</p>
        </div>
      </div>

      {replies.map(r => (
        <div key={r.id} style={{ marginLeft: 32, marginTop: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            {r.author?.avatar_url ? (
              <img src={r.author.avatar_url} alt="" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, marginTop: 2 }} />
            ) : (
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#ede9fe', flexShrink: 0, marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#7c3aed' }}>
                {(r.author?.display_name ?? '?')[0]}
              </div>
            )}
            <div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
                <strong style={{ fontSize: 12, color: '#1e1b4b' }}>{r.author?.display_name ?? 'Unknown'}</strong>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDate(r.created_at)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{r.body}</p>
            </div>
          </div>
        </div>
      ))}

      {canComment && !isResolved && (
        <div style={{ marginLeft: 32, marginTop: 8 }}>
          {showReply ? (
            <div>
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Write a reply…"
                autoFocus
                rows={2}
                style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', resize: 'vertical' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button onClick={sendReply} disabled={sending || !replyBody.trim()} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (sending || !replyBody.trim()) ? 0.6 : 1 }}>
                  {sending ? 'Sending…' : 'Reply'}
                </button>
                <button onClick={() => { setShowReply(false); setReplyBody('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowReply(true)} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              ↳ Reply
            </button>
          )}
        </div>
      )}

      {isResolved && (
        <button onClick={() => setShowResolved(false)} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer', padding: '4px 0 0', display: 'block', marginLeft: 32 }}>
          Hide resolved
        </button>
      )}
    </div>
  )
}

export default function ExpenseReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [lineItems, setLineItems] = useState<ExpenseReportLineItem[]>([])
  const [versions, setVersions] = useState<ExpenseReportVersion[]>([])
  const [comments, setComments] = useState<ExpenseReportComment[]>([])
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [newComment, setNewComment] = useState('')
  const [postingComment, setPostingComment] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/expense-reports/${id}`)
    if (res.status === 404) { router.replace('/expense-reports'); return }
    const data = await res.json()
    if (data.report) setReport(data.report)
    setLineItems(data.line_items ?? [])
    setVersions(data.versions ?? [])
    setCanEdit(data.can_edit ?? false)

    // Load comments separately
    const cRes = await fetch(`/api/expense-reports/${id}/comments`)
    if (cRes.ok) {
      const cData = await cRes.json()
      setComments(cData.comments ?? [])
    }

    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    const res = await fetch(`/api/expense-reports/${id}/submit`, { method: 'POST' })
    const data = await res.json()
      if (res.ok) {
      load()
    } else {
      setSubmitError(data.error ?? 'Submission failed')
    }
    setSubmitting(false)
  }

  async function postComment() {
    if (!newComment.trim()) return
    setPostingComment(true)
    await fetch(`/api/expense-reports/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newComment.trim() }),
    })
    setNewComment('')
    setPostingComment(false)
    const cRes = await fetch(`/api/expense-reports/${id}/comments`)
    if (cRes.ok) setComments((await cRes.json()).comments ?? [])
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</p>
  if (!report) return null

  const statusCfg = STATUS_CONFIG[report.status] ?? { label: report.status, bg: '#f3f4f6', color: '#374151', description: '' }
  const totalOriginal = lineItems.reduce((s, i) => s + (i.original_amount ?? 0), 0)
  const totalAdjusted = lineItems.reduce((s, i) => s + (i.adjusted_amount ?? i.original_amount ?? 0), 0)
  const canSubmit = canEdit && report.status !== 'submitted' && lineItems.length > 0

  // Separate line-item comments from general comments
  const lineItemComments = comments.filter(c => c.line_item_id)
  const generalComments = comments.filter(c => !c.line_item_id)
  const unresolvedLineComments = lineItemComments.filter(c => !c.resolved_at).length

  return (
    <div style={{ width: '100%', padding: '24px 16px 40px' }}>
      <style>{`
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover { background: #ddd6fe; }
        .btn-submit { background: #16a34a; color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; white-space: nowrap; }
        .btn-submit:hover:not(:disabled) { background: #15803d; }
        .btn-submit:disabled { opacity: .6; cursor: not-allowed; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 640px) { .modal-backdrop { align-items: center; } }
        .modal { background: #fff; border-radius: 20px 20px 0 0; padding: 28px 24px 32px; width: 100%; max-width: 480px; }
        @media (min-width: 640px) { .modal { border-radius: 16px; padding: 32px; } }
        .li-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .li-table th { text-align: left; padding: 8px 10px; background: #f8f7ff; color: #6d28d9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
        .li-table td { padding: 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
        .li-table tr:last-child td { border-bottom: none; }
        @media (max-width: 639px) { .li-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; } }
        .bottom-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 767px) { .bottom-grid { grid-template-columns: 1fr; } }
        .status-description { display: inline; }
        @media (max-width: 639px) { .status-description { display: none; } }
        .stat-block { text-align: center; padding-right: 16px; }
        @media (max-width: 639px) { .stat-block { padding-right: 8px; } .stat-block .stat-val { font-size: 16px; } }
      `}</style>

      <div style={{ marginBottom: 12 }}>
        <Link href="/expense-reports" style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
          ← Expense Reports
        </Link>
      </div>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 700, color: '#1e1b4b' }}>
            {formatMonth(report.period_month)} Expense Report
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
            Created {formatDate(report.created_at)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {canSubmit && (
            <ConfirmButton
              idleLabel={report.status === 'needs_changes' ? '↩ Resubmit for Review' : '📤 Submit for Review'}
              confirmLabel="Yes, submit?"
              onConfirm={() => { setSubmitError(null); handleSubmit() }}
              variant="green"
              disabled={submitting}
            />
          )}
          {canEdit && (
            <Link href={`/expense-reports/${id}/edit`} style={{ textDecoration: 'none' }}>
              <button className="btn-primary">Edit Report</button>
            </Link>
          )}
        </div>
      </div>

      {/* Status + stats row */}
      <div style={{ background: statusCfg.bg, border: `1.5px solid ${statusCfg.color}33`, borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingRight: 12, minWidth: 0, flexShrink: 1 }}>
          <span style={{ background: statusCfg.bg, color: statusCfg.color, border: `1.5px solid ${statusCfg.color}55`, padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {statusCfg.label}
          </span>
          <span className="status-description" style={{ fontSize: 12, color: statusCfg.color, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusCfg.description}</span>
          {report.status === 'needs_changes' && report.reviewer_comment && (
            <span className="status-description" style={{ fontSize: 12, color: statusCfg.color, fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>&ldquo;{report.reviewer_comment}&rdquo;</span>
          )}
        </div>
        {lineItems.length > 0 && (
          <>
            <div style={{ width: 1, background: `${statusCfg.color}33`, alignSelf: 'stretch', margin: '0 12px 0 auto', flexShrink: 0 }} />
            <div className="stat-block" style={{ flexShrink: 0 }}>
              <div className="stat-val" style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>{lineItems.length}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Line Items</div>
            </div>
            <div style={{ width: 1, background: `${statusCfg.color}33`, alignSelf: 'stretch', margin: '0 12px 0 0', flexShrink: 0 }} />
            <div className="stat-block" style={{ paddingRight: 0, flexShrink: 0 }}>
              <div className="stat-val" style={{ fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>{formatCurrency(totalOriginal)}</div>
              <div style={{ fontSize: 11, color: '#6b7280' }}>Total Amount</div>
            </div>
            {totalAdjusted !== totalOriginal && (
              <>
                <div style={{ width: 1, background: `${statusCfg.color}33`, alignSelf: 'stretch', margin: '0 12px', flexShrink: 0 }} />
                <div className="stat-block" style={{ paddingRight: 0, flexShrink: 0 }}>
                  <div className="stat-val" style={{ fontSize: 18, fontWeight: 700, color: '#7c3aed' }}>{formatCurrency(totalAdjusted)}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>Adjusted Total</div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Inline line-item comment alert */}
      {unresolvedLineComments > 0 && (
        <div style={{ background: '#fef3c7', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14, color: '#78350f' }}>
          💬 {unresolvedLineComments} unresolved comment{unresolvedLineComments > 1 ? 's' : ''} on line items — see the editor for details.
          {canEdit && (
            <Link href={`/expense-reports/${id}/edit`} style={{ marginLeft: 8, color: '#92400e', fontWeight: 600, textDecoration: 'underline' }}>
              Open editor →
            </Link>
          )}
        </div>
      )}

      {/* Line items table */}
      {lineItems.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, marginBottom: 24, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #e9d5ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>Expense Items</h2>
          </div>
          <div className="li-table-wrap">
            <table className="li-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Supplier</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Type</th>
                  <th>Reimb.</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map(item => (
                  <tr key={item.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#6b7280' }}>{item.expense_date ?? '—'}</td>
                    <td style={{ fontWeight: 500 }}>{item.vendor ?? '—'}</td>
                    <td style={{ color: '#6b7280' }}>{item.category ?? '—'}</td>
                    <td style={{ color: '#6b7280', maxWidth: 200 }}>{item.description ?? '—'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 500 }}>
                      {formatCurrency(item.original_amount)}
                      {item.adjusted_amount !== null && item.adjusted_amount !== item.original_amount && (
                        <div style={{ fontSize: 11, color: '#7c3aed' }}>→ {formatCurrency(item.adjusted_amount)}</div>
                      )}
                    </td>
                    <td style={{ color: '#6b7280', textTransform: 'capitalize' }}>{item.payment_type?.replace('_', ' ') ?? '—'}</td>
                    <td style={{ color: item.reimbursable ? '#166534' : '#dc2626' }}>{item.reimbursable ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {lineItems.length === 0 && (
        <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 12, padding: '32px 24px', textAlign: 'center', marginBottom: 24, color: '#9ca3af' }}>
          <p style={{ margin: 0, fontSize: 15 }}>No expense items yet.</p>
          {canEdit && (
            <Link href={`/expense-reports/${id}/edit`} style={{ textDecoration: 'none' }}>
              <button style={{ marginTop: 12, background: '#7c3aed', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Add Expenses →
              </button>
            </Link>
          )}
        </div>
      )}

      {submitError && (
        <p style={{ marginBottom: 12, fontSize: 14, color: '#dc2626' }}>{submitError}</p>
      )}

      {/* Comments + History side by side */}
      <div className="bottom-grid">
        {/* Comments */}
        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e9d5ff' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>Comments</h2>
          </div>
          <div style={{ padding: 16, flex: 1 }}>
            {generalComments.length === 0 ? (
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#9ca3af' }}>No comments yet.</p>
            ) : (
              <div style={{ marginBottom: 16 }}>
                {generalComments.map(c => (
                  <CommentThread key={c.id} comment={c} reportId={id} canComment={true} onRefresh={load} />
                ))}
              </div>
            )}
            <div>
              <textarea
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder="Add a comment…"
                rows={3}
                style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '10px 12px', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#7c3aed')}
                onBlur={e => (e.currentTarget.style.borderColor = '#d1d5db')}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={postComment} disabled={postingComment || !newComment.trim()} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: (postingComment || !newComment.trim()) ? 0.6 : 1 }}>
                  {postingComment ? 'Sending…' : 'Comment'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* History */}
        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e9d5ff' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1e1b4b' }}>History</h2>
          </div>
          <div style={{ padding: '4px 16px' }}>
            {versions.length === 0 ? (
              <p style={{ padding: '12px 0', fontSize: 14, color: '#9ca3af', margin: 0 }}>No history yet.</p>
            ) : versions.map((v, i) => {
              const actionCfg = VERSION_ACTIONS[v.action] ?? { label: v.action, icon: '•' }
              return (
                <div key={v.id} style={{ display: 'flex', gap: 10, padding: '10px 0', borderBottom: i < versions.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                  <span style={{ fontSize: 16, width: 22, flexShrink: 0, textAlign: 'center' }}>{actionCfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1e1b4b' }}>{actionCfg.label}</div>
                    {v.comment && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>&ldquo;{v.comment}&rdquo;</p>}
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {v.changer?.display_name ?? 'Unknown'} · {formatDate(v.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>


    </div>
  )
}
