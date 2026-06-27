'use client'

import { useState, useEffect, useRef, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ExpenseReportLineItem, ExpenseReportVersion, ExpenseReportComment } from '@/types'
import { EXPENSE_CATEGORIES } from '@/lib/expense-constants'

interface ReportDetail {
  id: string
  created_by: string
  period_month: string
  status: string
  title: string | null
  reviewer_comment: string | null
  created_at: string
  updated_at: string
  submitter: { id: string; display_name: string; email: string } | null
  line_items?: ExpenseReportLineItem[]
  versions?: ExpenseReportVersion[]
  comments?: ExpenseReportComment[]
  is_reviewer: boolean
  can_edit: boolean
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatCurrency(n: number | null | undefined) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; description: string }> = {
  draft:                { label: 'In Progress',          bg: '#f3f4f6', color: '#374151', description: 'Employee is still working on this report.' },
  submitted:            { label: 'Submitted',            bg: '#dbeafe', color: '#1d4ed8', description: 'Submitted and waiting for your review.' },
  needs_changes:        { label: 'Changes Needed',       bg: '#fef3c7', color: '#92400e', description: 'You requested changes. Waiting for re-submission.' },
  approved:             { label: 'Approved',             bg: '#dcfce7', color: '#166534', description: 'Report approved.' },
  submitted_to_payroll: { label: 'Submitted to Payroll', bg: '#ede9fe', color: '#5b21b6', description: 'Submitted to payroll for reimbursement.' },
}

const VERSION_ICONS: Record<string, string> = {
  created: '🆕', submitted: '📤', needs_changes: '↩️', approved: '✅',
  submitted_to_payroll: '💰', updated: '✏️',
}

interface CommentThreadProps {
  comments: ExpenseReportComment[]
  reportId: string
  lineItemId: string | null
  currentUserId?: string
  isAdmin: boolean
  onRefresh: () => void
}

function CommentThread({ comments, reportId, lineItemId, currentUserId, isAdmin, onRefresh }: CommentThreadProps) {
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [newBody, setNewBody] = useState('')
  const [posting, setPosting] = useState(false)

  const top = comments.filter(c => !c.parent_id && c.line_item_id === lineItemId)

  async function postComment() {
    if (!newBody.trim()) return
    setPosting(true)
    await fetch(`/api/expense-reports/${reportId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newBody.trim(), line_item_id: lineItemId }),
    })
    setNewBody('')
    setPosting(false)
    onRefresh()
  }

  async function postReply(parentId: string) {
    if (!replyBody.trim()) return
    setPosting(true)
    await fetch(`/api/expense-reports/${reportId}/comments/${parentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: replyBody.trim() }),
    })
    setReplyBody('')
    setReplyTo(null)
    setPosting(false)
    onRefresh()
  }

  async function toggleResolve(commentId: string) {
    await fetch(`/api/expense-reports/${reportId}/comments/${commentId}/resolve`, { method: 'POST' })
    onRefresh()
  }

  async function deleteComment(commentId: string) {
    await fetch(`/api/expense-reports/${reportId}/comments/${commentId}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {top.map(c => {
        const replies = comments.filter(r => r.parent_id === c.id)
        const isResolved = !!c.resolved_at
        return (
          <div key={c.id} style={{ marginBottom: 16, border: `1px solid ${isResolved ? '#d1fae5' : '#e9d5ff'}`, borderRadius: 10, overflow: 'hidden', opacity: isResolved ? 0.7 : 1 }}>
            {/* Top-level comment */}
            <div style={{ padding: '10px 14px', background: isResolved ? '#f0fdf4' : '#faf5ff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: '#1e1b4b' }}>{c.author?.display_name ?? 'User'}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>{formatDate(c.created_at)}</span>
                  {isResolved && <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 8, fontWeight: 600 }}>✓ Resolved</span>}
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: '#374151', whiteSpace: 'pre-wrap' }}>{c.body}</p>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {isAdmin && (
                    <button onClick={() => toggleResolve(c.id)} style={{ fontSize: 11, color: isResolved ? '#9ca3af' : '#16a34a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 6px' }}>
                      {isResolved ? 'Reopen' : 'Resolve'}
                    </button>
                  )}
                  {(c.author_id === currentUserId || isAdmin) && (
                    <button onClick={() => deleteComment(c.id)} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Replies */}
            {replies.map(r => (
              <div key={r.id} style={{ padding: '8px 14px 8px 28px', borderTop: '1px solid #ede9fe', background: '#fff' }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: '#6d28d9' }}>{r.author?.display_name ?? 'User'}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{formatDate(r.created_at)}</span>
                {(r.author_id === currentUserId || isAdmin) && (
                  <button onClick={() => deleteComment(r.id)} style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>✕</button>
                )}
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{r.body}</p>
              </div>
            ))}

            {/* Reply box */}
            {!isResolved && (
              <div style={{ borderTop: '1px solid #ede9fe', padding: '8px 14px', background: '#fff' }}>
                {replyTo === c.id ? (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <textarea value={replyBody} onChange={e => setReplyBody(e.target.value)} rows={2} placeholder="Write a reply…" style={{ flex: 1, border: '1.5px solid #c4b5fd', borderRadius: 6, padding: '6px 10px', fontSize: 13, resize: 'vertical' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button disabled={posting || !replyBody.trim()} onClick={() => postReply(c.id)} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        {posting ? '…' : 'Reply'}
                      </button>
                      <button onClick={() => { setReplyTo(null); setReplyBody('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setReplyTo(c.id)} style={{ fontSize: 12, color: '#7c3aed', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>↩ Reply</button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* New comment box */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <textarea value={newBody} onChange={e => setNewBody(e.target.value)} rows={2} placeholder="Add a comment…" style={{ flex: 1, border: '1.5px solid #ddd6fe', borderRadius: 8, padding: '8px 12px', fontSize: 14, resize: 'vertical' }} />
        <button disabled={posting || !newBody.trim()} onClick={postComment} style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>
          {posting ? '…' : 'Post'}
        </button>
      </div>
    </div>
  )
}

export default function AdminExpenseReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [expandedCommentRow, setExpandedCommentRow] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: string } | null>(null)
  const [cellValue, setCellValue] = useState('')
  const [savingCell, setSavingCell] = useState(false)

  // Modals
  const [showNeedsChanges, setShowNeedsChanges] = useState(false)
  const [needsChangesComment, setNeedsChangesComment] = useState('')
  const [showApproveConfirm, setShowApproveConfirm] = useState(false)
  const [showPayrollConfirm, setShowPayrollConfirm] = useState(false)

  // Add row
  const [addingRow, setAddingRow] = useState(false)
  const [newRow, setNewRow] = useState<Partial<ExpenseReportLineItem>>({})
  const [savingRow, setSavingRow] = useState(false)

  const cellRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/expense-reports/${id}`)
    if (res.status === 404 || res.status === 403) { router.replace('/admin/expense-reports'); return }
    const data = await res.json()
    setReport(data.report)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleAction(status: string, comment?: string) {
    setActionLoading(true)
    setActionError(null)
    const res = await fetch(`/api/admin/expense-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, comment: comment ?? null }),
    })
    const data = await res.json()
    if (!res.ok) {
      setActionError(data.error ?? 'Action failed')
      setActionLoading(false)
      return
    }
    setShowNeedsChanges(false)
    setShowApproveConfirm(false)
    setShowPayrollConfirm(false)
    setNeedsChangesComment('')
    load()
    setActionLoading(false)
  }

  async function saveCell(itemId: string, field: string, value: string) {
    setSavingCell(true)
    const body: Record<string, unknown> = {}
    if (field === 'original_amount' || field === 'adjusted_amount') {
      body[field] = value === '' ? null : parseFloat(value)
    } else if (field === 'reimbursable') {
      body[field] = value === 'true'
    } else {
      body[field] = value === '' ? null : value
    }
    await fetch(`/api/expense-reports/${id}/line-items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSavingCell(false)
    setEditingCell(null)
    load()
  }

  async function addRow() {
    setSavingRow(true)
    await fetch(`/api/expense-reports/${id}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRow),
    })
    setNewRow({})
    setAddingRow(false)
    setSavingRow(false)
    load()
  }

  async function deleteItem(itemId: string) {
    await fetch(`/api/expense-reports/${id}/line-items/${itemId}`, { method: 'DELETE' })
    load()
  }

  function startEdit(itemId: string, field: string, current: string) {
    setEditingCell({ itemId, field })
    setCellValue(current)
    setTimeout(() => cellRef.current?.focus(), 30)
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</p>
  if (!report) return null

  const statusCfg = STATUS_CONFIG[report.status] ?? { label: report.status, bg: '#f3f4f6', color: '#374151', description: '' }
  const lineItems = report.line_items ?? []
  const versions = report.versions ?? []
  const comments = report.comments ?? []

  const totalOriginal = lineItems.reduce((s, i) => s + (i.original_amount ?? 0), 0)
  const totalAdjusted = lineItems.reduce((s, i) => s + (i.adjusted_amount ?? 0), 0)

  const lineItemCommentCounts = lineItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.id] = comments.filter(c => c.line_item_id === item.id && !c.parent_id).length
    return acc
  }, {})

  const unresolvedCount = comments.filter(c => c.line_item_id && !c.parent_id && !c.resolved_at).length

  return (
    <div style={{ width: '100%', padding: '32px 16px' }}>
      <style>{`
        .btn-primary { background: #7c3aed; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover:not(:disabled) { background: #6d28d9; }
        .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-secondary { background: #ede9fe; color: #5b21b6; border: none; padding: 7px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
        .btn-secondary:hover:not(:disabled) { background: #ddd6fe; }
        .btn-secondary:disabled { opacity: .6; cursor: not-allowed; }
        .btn-green { background: #16a34a; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-green:hover:not(:disabled) { background: #15803d; }
        .btn-green:disabled { opacity: .6; cursor: not-allowed; }
        .btn-amber { background: #d97706; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .btn-amber:hover:not(:disabled) { background: #b45309; }
        .btn-amber:disabled { opacity: .6; cursor: not-allowed; }
        .btn-danger { background: #fee2e2; color: #dc2626; border: none; padding: 5px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .btn-danger:hover { background: #fecaca; }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 50; display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 16px; padding: 32px; max-width: 500px; width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.18); }
        .form-input { width: 100%; border: 1.5px solid #d1d5db; border-radius: 8px; padding: 8px 12px; font-size: 14px; box-sizing: border-box; }
        .form-input:focus { outline: none; border-color: #7c3aed; }
        .li-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .li-table th { text-align: left; padding: 8px 10px; background: #f8f7ff; color: #6d28d9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; border-bottom: 2px solid #ede9fe; white-space: nowrap; }
        .li-table td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .li-table tr:last-child td { border-bottom: none; }
        .li-table tr:hover td { background: #faf5ff; }
        .cell-edit { border: 1.5px solid #7c3aed; border-radius: 4px; padding: 3px 6px; font-size: 13px; width: 100%; box-sizing: border-box; }
        .cell-edit:focus { outline: none; }
        .editable-cell { cursor: pointer; min-height: 22px; border-radius: 4px; padding: 3px 6px; }
        .editable-cell:hover { background: #f0ebff; }
      `}</style>

      <div style={{ marginBottom: 8 }}>
        <Link href="/admin/expense-reports" style={{ color: '#7c3aed', fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>
          ← Back to All Reports
        </Link>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20, marginTop: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#1e1b4b' }}>
            {report.submitter?.display_name ?? 'Unknown'} — {formatMonth(report.period_month)}
            {report.title && <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 500, marginLeft: 8 }}>({report.title})</span>}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
            {report.submitter?.email} · Last updated {formatDate(report.updated_at)}
          </p>
        </div>
        <span style={{ background: statusCfg.bg, color: statusCfg.color, border: `1.5px solid ${statusCfg.color}55`, padding: '5px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
          {statusCfg.label}
        </span>
      </div>

      {/* Summary stats */}
      {lineItems.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Line Items', value: lineItems.length },
            { label: 'Total Amount', value: formatCurrency(totalOriginal) },
            { label: 'Adjusted Total', value: formatCurrency(totalAdjusted) },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8f7ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Unresolved comments alert */}
      {unresolvedCount > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 10, padding: '10px 16px', marginBottom: 20, fontSize: 14, color: '#78350f' }}>
          💬 {unresolvedCount} unresolved line-item comment{unresolvedCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Status actions */}
      <div style={{ background: '#f8f7ff', border: '1px solid #e9d5ff', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>{statusCfg.description}</div>
        {actionError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '8px 14px', color: '#dc2626', fontSize: 13, marginBottom: 12 }}>
            {actionError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {report.status !== 'submitted_to_payroll' && (
            <>
              {['submitted', 'needs_changes', 'draft', 'approved'].includes(report.status) && (
                <button className="btn-amber" disabled={actionLoading} onClick={() => setShowNeedsChanges(true)}>
                  ↩ Request Changes
                </button>
              )}
              {['submitted', 'needs_changes', 'draft'].includes(report.status) && (
                <button className="btn-green" disabled={actionLoading} onClick={() => setShowApproveConfirm(true)}>
                  ✓ Approve
                </button>
              )}
              {report.status === 'approved' && (
                <button className="btn-primary" disabled={actionLoading} onClick={() => setShowPayrollConfirm(true)}>
                  💰 Submit to Payroll
                </button>
              )}
            </>
          )}
          {report.status === 'submitted_to_payroll' && (
            <>
              <span style={{ color: '#5b21b6', fontWeight: 600, fontSize: 14 }}>✓ Submitted to payroll</span>
              <button className="btn-amber" disabled={actionLoading} onClick={() => setShowNeedsChanges(true)}>
                ↩ Reopen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Line Items Table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e1b4b' }}>Line Items</h2>
          <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => setAddingRow(true)}>+ Add Row</button>
        </div>

        {lineItems.length === 0 ? (
          <div style={{ background: '#f8f7ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            No line items yet.
          </div>
        ) : (
          <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'auto' }}>
            <table className="li-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Vendor</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Adj. Amt</th>
                  <th>Type</th>
                  <th>Reimb.</th>
                  <th style={{ width: 60 }}>💬</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map(item => {
                  const commentCount = lineItemCommentCounts[item.id] ?? 0
                  const hasUnresolved = comments.some(c => c.line_item_id === item.id && !c.parent_id && !c.resolved_at)
                  const isExpanded = expandedCommentRow === item.id
                  const isEditing = (field: string) => editingCell?.itemId === item.id && editingCell?.field === field

                  function CellInput({ field, type = 'text', options }: { field: string; type?: string; options?: string[] }) {
                    if (!isEditing(field)) return null
                    if (options) {
                      return (
                        <select
                          ref={cellRef as React.RefObject<HTMLSelectElement>}
                          className="cell-edit"
                          value={cellValue}
                          onChange={e => setCellValue(e.target.value)}
                          onBlur={() => saveCell(item.id, field, cellValue)}
                          onKeyDown={e => { if (e.key === 'Enter') saveCell(item.id, field, cellValue); if (e.key === 'Escape') setEditingCell(null) }}
                        >
                          <option value=""></option>
                          {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      )
                    }
                    return (
                      <input
                        ref={cellRef as React.RefObject<HTMLInputElement>}
                        className="cell-edit"
                        type={type}
                        value={cellValue}
                        onChange={e => setCellValue(e.target.value)}
                        onBlur={() => saveCell(item.id, field, cellValue)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCell(item.id, field, cellValue); if (e.key === 'Escape') setEditingCell(null) }}
                      />
                    )
                  }

                  return (
                    <Fragment key={item.id}>
                      <tr style={{ background: hasUnresolved ? '#fffbeb' : undefined }}>
                        <td>
                          {isEditing('expense_date') ? <CellInput field="expense_date" type="date" /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'expense_date', item.expense_date ?? '')}>
                              {item.expense_date ? formatDateShort(item.expense_date + 'T12:00:00') : <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing('vendor') ? <CellInput field="vendor" /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'vendor', item.vendor ?? '')}>
                              {item.vendor || <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing('category') ? <CellInput field="category" options={[...EXPENSE_CATEGORIES]} /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'category', item.category ?? '')}>
                              {item.category || <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td style={{ maxWidth: 180 }}>
                          {isEditing('description') ? <CellInput field="description" /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'description', item.description ?? '')} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                              {item.description || <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing('original_amount') ? <CellInput field="original_amount" type="number" /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'original_amount', String(item.original_amount ?? ''))}>
                              {item.original_amount != null ? formatCurrency(item.original_amount) : <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing('adjusted_amount') ? <CellInput field="adjusted_amount" type="number" /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'adjusted_amount', String(item.adjusted_amount ?? ''))}>
                              {item.adjusted_amount != null ? formatCurrency(item.adjusted_amount) : <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td>
                          {isEditing('payment_type') ? <CellInput field="payment_type" options={['cash', 'credit_card']} /> : (
                            <span className="editable-cell" onClick={() => startEdit(item.id, 'payment_type', item.payment_type ?? '')}>
                              {item.payment_type === 'credit_card' ? 'CC' : item.payment_type === 'cash' ? 'Cash' : <em style={{ color: '#c4b5fd' }}>—</em>}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="editable-cell" onClick={() => saveCell(item.id, 'reimbursable', String(!item.reimbursable))}>
                            {item.reimbursable ? '✓' : '—'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => setExpandedCommentRow(isExpanded ? null : item.id)}
                            style={{ background: hasUnresolved ? '#fef3c7' : (commentCount > 0 ? '#ede9fe' : 'none'), border: 'none', cursor: 'pointer', borderRadius: 6, padding: '3px 8px', fontSize: 12, color: hasUnresolved ? '#92400e' : '#6d28d9', fontWeight: commentCount > 0 ? 700 : 400 }}
                          >
                            💬{commentCount > 0 ? ` ${commentCount}` : ''}
                          </button>
                        </td>
                        <td>
                          <button className="btn-danger" onClick={() => deleteItem(item.id)}>✕</button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${item.id}-comments`}>
                          <td colSpan={10} style={{ padding: 0, background: '#faf5ff' }}>
                            <CommentThread
                              comments={comments}
                              reportId={id}
                              lineItemId={item.id}
                              isAdmin={true}
                              onRefresh={load}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Overall Comments */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 17, fontWeight: 700, color: '#1e1b4b' }}>Reviewer Notes</h2>
        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden' }}>
          <CommentThread
            comments={comments}
            reportId={id}
            lineItemId={null}
            isAdmin={true}
            onRefresh={load}
          />
        </div>
      </div>

      {/* Version History */}
      {versions.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 700, color: '#1e1b4b' }}>History</h2>
          <div style={{ position: 'relative', paddingLeft: 28 }}>
            <div style={{ position: 'absolute', left: 10, top: 0, bottom: 0, width: 2, background: '#e9d5ff', borderRadius: 2 }} />
            {versions.map((v, i) => (
              <div key={v.id} style={{ position: 'relative', marginBottom: i < versions.length - 1 ? 20 : 0 }}>
                <div style={{ position: 'absolute', left: -22, top: 2, width: 22, height: 22, background: '#fff', border: '2px solid #a78bfa', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                  {VERSION_ICONS[v.action] ?? '•'}
                </div>
                <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 10, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: '#1e1b4b', textTransform: 'capitalize' }}>{v.action.replace('_', ' ')}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatDate(v.created_at)}</span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                    by {(v as ExpenseReportVersion & { changer?: { display_name: string } | null }).changer?.display_name ?? 'User'}
                    {v.new_status && <> → <span style={{ fontWeight: 600, color: STATUS_CONFIG[v.new_status]?.color ?? '#374151' }}>{STATUS_CONFIG[v.new_status]?.label ?? v.new_status}</span></>}
                  </p>
                  {v.comment && (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: '#78350f', fontStyle: 'italic', background: '#fef3c7', padding: '4px 10px', borderRadius: 6 }}>
                      &ldquo;{v.comment}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Row modal */}
      {addingRow && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setAddingRow(false) }}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>Add Expense Item</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'Date', field: 'expense_date', type: 'date' },
                { label: 'Supplier', field: 'vendor', type: 'text' },
                { label: 'Original Amount', field: 'original_amount', type: 'number' },
                { label: 'Adjusted Amount', field: 'adjusted_amount', type: 'number' },
              ].map(f => (
                <div key={f.field}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} className="form-input" value={(newRow as Record<string, unknown>)[f.field] as string ?? ''} onChange={e => setNewRow(r => ({ ...r, [f.field]: e.target.value }))} />
                </div>
              ))}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Category</label>
                <select className="form-input" value={newRow.category ?? ''} onChange={e => setNewRow(r => ({ ...r, category: e.target.value }))}>
                  <option value=""></option>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description</label>
                <input type="text" className="form-input" value={newRow.description ?? ''} onChange={e => setNewRow(r => ({ ...r, description: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn-secondary" onClick={() => { setAddingRow(false); setNewRow({}) }}>Cancel</button>
              <button className="btn-primary" disabled={savingRow} onClick={addRow}>{savingRow ? 'Saving…' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Needs Changes modal */}
      {showNeedsChanges && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setShowNeedsChanges(false); setNeedsChangesComment('') } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Request Changes</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              {report.submitter?.display_name} will be notified that their report needs corrections.
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Comment for employee *</label>
              <textarea className="form-input" rows={4} value={needsChangesComment} onChange={e => setNeedsChangesComment(e.target.value)} placeholder="Describe what needs to be corrected…" autoFocus />
            </div>
            {actionError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => { setShowNeedsChanges(false); setNeedsChangesComment('') }}>Cancel</button>
              <button className="btn-amber" disabled={actionLoading || !needsChangesComment.trim()} onClick={() => handleAction('needs_changes', needsChangesComment.trim())}>
                {actionLoading ? 'Saving…' : '↩ Request Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve confirmation */}
      {showApproveConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowApproveConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Approve Report?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              Mark <strong>{report.submitter?.display_name}</strong>&apos;s {formatMonth(report.period_month)} expense report as approved and notify them.
            </p>
            {actionError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowApproveConfirm(false)}>Cancel</button>
              <button className="btn-green" disabled={actionLoading} onClick={() => handleAction('approved')}>
                {actionLoading ? 'Saving…' : '✓ Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit to Payroll confirmation */}
      {showPayrollConfirm && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setShowPayrollConfirm(false) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>Submit to Payroll?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              Mark <strong>{report.submitter?.display_name}</strong>&apos;s {formatMonth(report.period_month)} expense report as submitted to payroll.
            </p>
            {actionError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {actionError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setShowPayrollConfirm(false)}>Cancel</button>
              <button className="btn-primary" disabled={actionLoading} onClick={() => handleAction('submitted_to_payroll')}>
                {actionLoading ? 'Saving…' : '💰 Submit to Payroll'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
