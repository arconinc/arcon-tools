'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { EXPENSE_CATEGORIES } from '@/lib/expense-constants'
import type { ExpenseReportLineItem, ExpenseReportComment, ExpenseReportReceipt } from '@/types'

interface ReportInfo {
  id: string
  period_month: string
  title: string | null
  status: string
  created_by: string
}

function formatMonth(ym: string) {
  const [year, month] = ym.split('-')
  return new Date(Number(year), Number(month) - 1, 1)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatCurrency(n: number | null) {
  if (n === null || n === undefined) return ''
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const EMPTY_ITEM: Partial<ExpenseReportLineItem> = {
  expense_date: '',
  vendor: '',
  category: '',
  description: '',
  original_amount: null,
  adjusted_amount: null,
  payment_type: null,
  reimbursable: true,
}

function ExternalReceiptLink({ url, compact }: { url: string; compact?: boolean }) {
  if (compact) {
    return (
      <a href={url} target="_blank" rel="noreferrer" title="View Expensify receipt" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 5, padding: '3px 7px', fontSize: 11, fontWeight: 600, color: '#166534', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        🔗 Receipt
      </a>
    )
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '6px 10px' }}>
      <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>🔗 Expensify receipt</span>
      <a href={url} target="_blank" rel="noreferrer" style={{ color: '#166534', fontSize: 12, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>View</a>
    </div>
  )
}

function ExistingReceipt({ receipt, reportId, compact }: { receipt: ExpenseReportReceipt; reportId: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false)

  async function open() {
    setLoading(true)
    const res = await fetch(`/api/expense-reports/${reportId}/receipts/${receipt.id}/signed-url`)
    if (res.ok) {
      const { signed_url } = await res.json()
      window.open(signed_url, '_blank')
    }
    setLoading(false)
  }

  const isImage = receipt.mime_type?.startsWith('image/')

  if (compact) {
    return (
      <button onClick={open} disabled={loading} title={receipt.filename} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 5, padding: '3px 7px', fontSize: 11, fontWeight: 600, color: '#7c3aed', cursor: 'pointer', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {loading ? '…' : <>{isImage ? '🖼' : '📎'} {receipt.filename.length > 10 ? receipt.filename.slice(0, 10) + '…' : receipt.filename}</>}
      </button>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '6px 10px' }}>
      <span style={{ fontSize: 13, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{isImage ? '🖼' : '📎'} {receipt.filename}</span>
      <button onClick={open} disabled={loading} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, padding: 0 }}>
        {loading ? 'Opening…' : 'View'}
      </button>
    </div>
  )
}

function ReceiptPreviewMobile({ receipt, reportId }: { receipt: ExpenseReportReceipt; reportId: string }) {
  const [loading, setLoading] = useState(false)
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const isImage = receipt.mime_type?.startsWith('image/')

  useEffect(() => {
    if (!isImage) return
    let cancelled = false
    fetch(`/api/expense-reports/${reportId}/receipts/${receipt.id}/signed-url`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !cancelled) setThumbUrl(d.signed_url) })
    return () => { cancelled = true }
  }, [receipt.id, reportId, isImage])

  async function open() {
    if (thumbUrl) { window.open(thumbUrl, '_blank'); return }
    setLoading(true)
    const res = await fetch(`/api/expense-reports/${reportId}/receipts/${receipt.id}/signed-url`)
    if (res.ok) { const { signed_url } = await res.json(); window.open(signed_url, '_blank') }
    setLoading(false)
  }

  if (isImage && thumbUrl) {
    return (
      <button onClick={open} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block', width: '100%' }}>
        <img src={thumbUrl} alt={receipt.filename} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid #ddd6fe' }} />
        <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af', textAlign: 'center' }}>{receipt.filename}</p>
      </button>
    )
  }

  return (
    <button onClick={open} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 8, padding: '10px 12px', cursor: 'pointer', width: '100%', textAlign: 'left' }}>
      <span style={{ fontSize: 20 }}>{isImage ? '🖼' : '📄'}</span>
      <span style={{ flex: 1, fontSize: 13, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{receipt.filename}</span>
      <span style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, flexShrink: 0 }}>{loading ? '…' : 'View'}</span>
    </button>
  )
}

// ── Row dialog (add/edit) ────────────────────────────────────────────────────

function RowDialog({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Partial<ExpenseReportLineItem>
  onSave: (data: Partial<ExpenseReportLineItem>, file?: File | null) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<Partial<ExpenseReportLineItem>>({ ...EMPTY_ITEM, ...initial })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!receiptFile) { setPreviewUrl(null); return }
    if (receiptFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(receiptFile)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreviewUrl(null)
  }, [receiptFile])

  function set(field: string, value: unknown) {
    setForm(f => ({ ...f, [field]: value }))
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
        {/* Date */}
        <div style={{ gridColumn: '1 / 2', minWidth: 0 }}>
          <label style={labelStyle}>Date</label>
          <input type="date" style={inputStyle} value={form.expense_date ?? ''} onChange={e => set('expense_date', e.target.value || null)} />
        </div>

        {/* Vendor */}
        <div style={{ gridColumn: '2 / 3', minWidth: 0 }}>
          <label style={labelStyle}>Vendor / Merchant</label>
          <input type="text" style={inputStyle} placeholder="e.g. Amazon, Delta" value={form.vendor ?? ''} onChange={e => set('vendor', e.target.value || null)} />
        </div>

        {/* Category */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Category</label>
          <select style={inputStyle} value={form.category ?? ''} onChange={e => set('category', e.target.value || null)}>
            <option value="">Select a category…</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Description */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description / Notes</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} placeholder="Optional details…" value={form.description ?? ''} onChange={e => set('description', e.target.value || null)} />
        </div>

        {/* Original Amount */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={labelStyle}>Amount ($)</label>
          <input type="number" style={inputStyle} placeholder="0.00" min="0" step="0.01" value={form.original_amount ?? ''} onChange={e => set('original_amount', e.target.value ? parseFloat(e.target.value) : null)} />
        </div>

        {/* Adjusted Amount */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={labelStyle}>Adjusted Amount ($) <span style={{ fontWeight: 400, color: '#9ca3af' }}>optional</span></label>
          <input type="number" style={inputStyle} placeholder="0.00" min="0" step="0.01" value={form.adjusted_amount ?? ''} onChange={e => set('adjusted_amount', e.target.value ? parseFloat(e.target.value) : null)} />
        </div>

        {/* Payment type */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Payment Type</label>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['cash', 'credit_card'] as const).map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', flex: 1, padding: '10px 14px', border: `2px solid ${form.payment_type === t ? '#7c3aed' : '#d1d5db'}`, borderRadius: 8, background: form.payment_type === t ? '#f5f3ff' : '#fff' }}>
                <input type="radio" name="payment_type" value={t} checked={form.payment_type === t} onChange={() => set('payment_type', t)} style={{ accentColor: '#7c3aed' }} />
                {t === 'cash' ? '💵 Cash' : '💳 Credit Card'}
              </label>
            ))}
          </div>
        </div>

        {/* Reimbursable */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.reimbursable ?? true} onChange={e => set('reimbursable', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#7c3aed' }} />
            <span><strong>Reimbursable</strong> — I&apos;m requesting reimbursement for this expense</span>
          </label>
        </div>

        {/* Receipt upload */}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Receipt Photo / File <span style={{ fontWeight: 400, color: '#9ca3af' }}>optional</span></label>
          {(initial.receipt_url || (initial.receipts ?? []).length > 0) && (
            <div style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {initial.receipt_url && <ExternalReceiptLink url={initial.receipt_url} />}
              {(initial.receipts ?? []).map(r => (
                <ExistingReceipt key={r.id} receipt={r} reportId={initial.report_id!} />
              ))}
            </div>
          )}
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#ede9fe', color: '#5b21b6', border: '1.5px solid #c4b5fd', borderRadius: 8, padding: '9px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            📎 {receiptFile ? receiptFile.name : 'Choose Photo or File'}
            <input
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={e => setReceiptFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {previewUrl && (
            <div style={{ marginTop: 8 }}>
              <img src={previewUrl} alt="Receipt preview" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8, border: '1px solid #ddd6fe', objectFit: 'contain' }} />
            </div>
          )}
          {receiptFile && !previewUrl && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#6b7280' }}>📄 {receiptFile.name}</p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        <button onClick={onCancel} disabled={saving} style={secondaryBtnStyle}>Cancel</button>
        <button onClick={() => onSave(form, receiptFile)} disabled={saving} style={{ ...primaryBtnStyle, flex: 2 }}>
          {saving ? 'Saving…' : (initial.id ? 'Save Changes' : 'Add Expense')}
        </button>
      </div>
    </div>
  )
}

// ── Comment thread for line item ──────────────────────────────────────────────

function LineItemCommentThread({
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

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: '1.5px solid #d1d5db',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 15,
  boxSizing: 'border-box',
  background: '#fff',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 600,
  color: '#374151',
  marginBottom: 5,
}

const primaryBtnStyle: React.CSSProperties = {
  background: '#7c3aed',
  color: '#fff',
  border: 'none',
  padding: '11px 20px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}

const secondaryBtnStyle: React.CSSProperties = {
  background: '#ede9fe',
  color: '#5b21b6',
  border: 'none',
  padding: '11px 16px',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  flex: 1,
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExpenseReportEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [report, setReport] = useState<ReportInfo | null>(null)
  const [lineItems, setLineItems] = useState<ExpenseReportLineItem[]>([])
  const [comments, setComments] = useState<ExpenseReportComment[]>([])
  const [loading, setLoading] = useState(true)
  const [isReviewer, setIsReviewer] = useState(false)
  const [canEdit, setCanEdit] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Partial<ExpenseReportLineItem> | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)

  // Inline new row (desktop only)
  const [inlineNewRow, setInlineNewRow] = useState<Partial<ExpenseReportLineItem> | null>(null)
  const [savingInline, setSavingInline] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const newRowDateRef = useRef<HTMLInputElement>(null)

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ExpenseReportLineItem | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)

  // Import
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)

  // Expanded comment threads per line item
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  // New comment being typed per item
  const [newCommentFor, setNewCommentFor] = useState<string | null>(null)
  const [newCommentBody, setNewCommentBody] = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<{ top: number; right: number } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/expense-reports/${id}`)
    if (res.status === 404) { router.replace('/expense-reports'); return }
    const data = await res.json()
    if (!data.report) return

    if (!data.can_edit && !data.is_reviewer) {
      router.replace(`/expense-reports/${id}`)
      return
    }

    setReport(data.report)
    setLineItems(data.line_items ?? [])
    setIsReviewer(data.is_reviewer ?? false)
    setCanEdit(data.can_edit ?? false)

    const [cRes, rRes] = await Promise.all([
      fetch(`/api/expense-reports/${id}/comments`),
      fetch(`/api/expense-reports/${id}/receipts`),
    ])
    if (cRes.ok) setComments((await cRes.json()).comments ?? [])
    if (rRes.ok) {
      const allReceipts: ExpenseReportReceipt[] = (await rRes.json()).receipts ?? []
      const byItem: Record<string, ExpenseReportReceipt[]> = {}
      for (const r of allReceipts) {
        if (r.line_item_id) {
          byItem[r.line_item_id] = [...(byItem[r.line_item_id] ?? []), r]
        }
      }
      setLineItems(prev => prev.map(li => ({ ...li, receipts: byItem[li.id] ?? [] })))
    }

    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  function openAdd() {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      if (inlineNewRow) {
        newRowDateRef.current?.focus()
        return
      }
      setInlineNewRow({ ...EMPTY_ITEM, reimbursable: true })
      setInlineError(null)
      return
    }
    setEditingItem({ ...EMPTY_ITEM })
    setItemError(null)
    setDialogOpen(true)
  }

  async function saveInlineNewRow() {
    if (!inlineNewRow) return
    setSavingInline(true)
    setInlineError(null)
    const res = await fetch(`/api/expense-reports/${id}/line-items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inlineNewRow),
    })
    const json = await res.json()
    if (!res.ok) {
      setInlineError(json.error ?? 'Save failed')
      setSavingInline(false)
      return
    }
    setInlineNewRow(null)
    setSavingInline(false)
    load()
  }

  function openEdit(item: ExpenseReportLineItem) {
    setEditingItem({ ...item })
    setItemError(null)
    setDialogOpen(true)
  }

  async function saveItem(data: Partial<ExpenseReportLineItem>, file?: File | null) {
    setSavingItem(true)
    setItemError(null)

    let savedItemId: string | null = null

    if (data.id) {
      // Update existing
      const res = await fetch(`/api/expense-reports/${id}/line-items/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setItemError(json.error ?? 'Save failed'); setSavingItem(false); return }
      savedItemId = data.id
    } else {
      // Create new
      const res = await fetch(`/api/expense-reports/${id}/line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok) { setItemError(json.error ?? 'Save failed'); setSavingItem(false); return }
      savedItemId = json.item?.id ?? null
    }

    // Upload receipt if provided
    if (file && savedItemId) {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('line_item_id', savedItemId)
      await fetch(`/api/expense-reports/${id}/receipts`, { method: 'POST', body: fd })
    }

    setDialogOpen(false)
    setEditingItem(null)
    setSavingItem(false)
    load()
  }

  async function deleteItem() {
    if (!deleteTarget) return
    setDeletingItem(true)
    const res = await fetch(`/api/expense-reports/${id}/line-items/${deleteTarget.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDeleteTarget(null)
      load()
    }
    setDeletingItem(false)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImporting(true)
    setImportResult(null)
    setImportError(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch(`/api/expense-reports/${id}/line-items/import`, { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        setImportResult(`${data.imported} item${data.imported === 1 ? '' : 's'} imported`)
        load()
      } else {
        setImportError(data.error ?? 'Import failed')
      }
    } catch {
      setImportError('Network error')
    }
    setImporting(false)
  }

  async function postLineItemComment(itemId: string) {
    if (!newCommentBody.trim()) return
    setPostingComment(true)
    await fetch(`/api/expense-reports/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newCommentBody.trim(), line_item_id: itemId }),
    })
    setNewCommentBody('')
    setNewCommentFor(null)
    setPostingComment(false)
    const cRes = await fetch(`/api/expense-reports/${id}/comments`)
    if (cRes.ok) setComments((await cRes.json()).comments ?? [])
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</p>
  if (!report) return null

  const totalOriginal = lineItems.reduce((s, i) => s + (i.original_amount ?? 0), 0)
  const totalAdjusted = lineItems.reduce((s, i) => s + (i.adjusted_amount ?? 0), 0)

  // Map comments by line item id
  const commentsByItem: Record<string, ExpenseReportComment[]> = {}
  for (const c of comments) {
    if (c.line_item_id) {
      if (!commentsByItem[c.line_item_id]) commentsByItem[c.line_item_id] = []
      commentsByItem[c.line_item_id].push(c)
    }
  }

  const isLocked = report.status !== 'draft' && report.status !== 'needs_changes'

  return (
    <div style={{ width: '100%', padding: '20px 16px 100px' }}>
      <style>{`
        .li-desktop { display: none; }
        .li-mobile { display: block; }
        @media (min-width: 768px) { .li-desktop { display: block; } .li-mobile { display: none; } }
        .sheet-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .sheet-table th { text-align: left; padding: 8px 8px; background: #f8f7ff; color: #6d28d9; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; border-bottom: 2px solid #ede9fe; }
        .sheet-table td { padding: 1px 2px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
        .sheet-table tr:last-child td { border-bottom: none; }
        .sheet-table tr:hover td { background: #faf5ff; }
        .cell-input { border: none; background: transparent; width: 100%; padding: 7px 8px; font-size: 13px; outline: none; min-width: 60px; }
        .cell-input:focus { background: #fdf4ff; outline: 2px solid #7c3aed; border-radius: 4px; }
        .cell-select { border: none; background: transparent; width: 100%; padding: 7px 8px; font-size: 13px; outline: none; }
        .cell-select:focus { background: #fdf4ff; outline: 2px solid #7c3aed; border-radius: 4px; }
        .amount-cell { position: relative; display: flex; align-items: center; }
        .amount-cell .currency-prefix { position: absolute; left: 8px; font-size: 13px; color: #6b7280; pointer-events: none; z-index: 1; }
        .amount-cell .cell-input { padding-left: 18px; }
        .mobile-card { background: #fff; border: 1px solid #e9d5ff; border-radius: 12px; margin-bottom: 10px; overflow: hidden; }
        .mobile-card-header { padding: 12px 14px; background: #f8f7ff; border-bottom: 1px solid #e9d5ff; display: flex; justify-content: space-between; align-items: center; }
        .mobile-card-body { padding: 12px 14px; font-size: 14px; }
        .mobile-field { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f9f9f9; }
        .mobile-field:last-child { border-bottom: none; }
        .mobile-field-label { color: #9ca3af; font-size: 12px; }
        .btn-fab { position: fixed; bottom: 24px; right: 20px; background: #7c3aed; color: #fff; border: none; width: 56px; height: 56px; border-radius: 50%; font-size: 24px; cursor: pointer; box-shadow: 0 4px 16px rgba(124,58,237,.4); display: flex; align-items: center; justify-content: center; z-index: 10; }
        .btn-fab:hover { background: #6d28d9; }
        @media (min-width: 768px) { .btn-fab { display: none; } }
        .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 40; display: flex; align-items: flex-end; justify-content: center; }
        @media (min-width: 640px) { .modal-backdrop { align-items: center; } }
        .modal { background: #fff; border-radius: 20px 20px 0 0; padding: 24px; width: 100%; max-width: 540px; max-height: 90vh; overflow-y: auto; }
        @media (min-width: 640px) { .modal { border-radius: 16px; padding: 28px; } }
        .comment-badge { display: inline-flex; align-items: center; gap: 3px; background: #fef3c7; color: #92400e; border-radius: 999px; padding: 1px 6px; font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid #fde68a; margin-left: 4px; white-space: nowrap; }
        .comment-badge.has-unresolved { background: #fef08a; border-color: #fbbf24; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Link href={`/expense-reports/${id}`} style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            ← Back
          </Link>
          <h1 style={{ margin: '8px 0 2px', fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>
            {formatMonth(report.period_month)} Expense Report
          </h1>
          {isLocked && !isReviewer && (
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              Report is locked — viewing only. <Link href={`/expense-reports/${id}`} style={{ color: '#7c3aed' }}>View status →</Link>
            </p>
          )}
        </div>

        {canEdit && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Expensify import */}
            <label>
              <span style={{ ...secondaryBtnStyle, cursor: 'pointer', display: 'inline-block', padding: '9px 16px', fontSize: 13, opacity: importing ? 0.6 : 1 }}>
                {importing ? 'Importing…' : '📊 Import CSV'}
              </span>
              <input ref={importRef} type="file" accept=".csv,.xlsx" style={{ display: 'none' }} disabled={importing} onChange={handleImport} />
            </label>
            <button onClick={openAdd} style={{ ...primaryBtnStyle, padding: '9px 18px', fontSize: 13 }}>
              + Add Expense
            </button>
          </div>
        )}
      </div>

      {importResult && <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', color: '#166534', fontSize: 14, marginBottom: 14 }}>✓ {importResult}</div>}
      {importError && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>{importError}</div>}

      {/* Totals bar */}
      {lineItems.length > 0 && (
        <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '10px 16px', marginBottom: 20, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#374151' }}><strong>{lineItems.length}</strong> items</span>
          <span style={{ fontSize: 14, color: '#374151' }}>Total: <strong>${formatCurrency(totalOriginal)}</strong></span>
          {canEdit && (
            <Link href={`/expense-reports/${id}`} style={{ marginLeft: 'auto', textDecoration: 'none' }}>
              <button style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                View / Submit →
              </button>
            </Link>
          )}
        </div>
      )}

      {/* ── Desktop spreadsheet ─────────────────────────── */}
      <div className="li-desktop">
        <div style={{ background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12, overflow: 'hidden' }}>
          {lineItems.length === 0 && !inlineNewRow && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
              <p style={{ margin: '0 0 16px', fontSize: 15 }}>No expenses yet.</p>
              {canEdit && <button onClick={openAdd} style={primaryBtnStyle}>+ Add Your First Expense</button>}
            </div>
          )}
          {(lineItems.length > 0 || !!inlineNewRow) && (
            <div style={{ overflowX: 'auto' }}>
              <table className="sheet-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Vendor</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th style={{ textAlign: 'right' }}>Adjusted</th>
                    <th>Type</th>
                    <th>Reimb.</th>
                    <th style={{ width: 80 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(item => {
                    const itemComments = commentsByItem[item.id] ?? []
                    const unresolvedCount = itemComments.filter(c => !c.resolved_at).length
                    const isExpanded = expandedComments.has(item.id)

                    return (
                      <Fragment key={item.id}>
                        <tr>
                          {canEdit ? (
                            <>
                              <td><input className="cell-input" type="date" defaultValue={item.expense_date ?? ''} onBlur={async e => { if (e.target.value !== (item.expense_date ?? '')) await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expense_date: e.target.value || null }) }) }} /></td>
                              <td><input className="cell-input" type="text" defaultValue={item.vendor ?? ''} placeholder="Vendor…" onBlur={async e => { if (e.target.value !== (item.vendor ?? '')) await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vendor: e.target.value || null }) }) }} /></td>
                              <td>
                                <select className="cell-select" defaultValue={item.category ?? ''} onBlur={async e => { if (e.target.value !== (item.category ?? '')) await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: e.target.value || null }) }) }}>
                                  <option value="">— select —</option>
                                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              <td><input className="cell-input" type="text" defaultValue={item.description ?? ''} placeholder="Notes…" style={{ minWidth: 120 }} onBlur={async e => { if (e.target.value !== (item.description ?? '')) await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: e.target.value || null }) }) }} /></td>
                              <td><div className="amount-cell"><span className="currency-prefix">$</span><input className="cell-input" type="number" defaultValue={item.original_amount ?? ''} placeholder="0.00" style={{ textAlign: 'right', minWidth: 80 }} onBlur={async e => { const v = e.target.value ? parseFloat(e.target.value) : null; if (v !== item.original_amount) { await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ original_amount: v }) }); setLineItems(prev => prev.map(li => li.id === item.id ? { ...li, original_amount: v } : li)) } }} /></div></td>
                              <td><div className="amount-cell"><span className="currency-prefix">$</span><input className="cell-input" type="number" defaultValue={item.adjusted_amount ?? ''} placeholder="—" style={{ textAlign: 'right', minWidth: 80 }} onBlur={async e => { const v = e.target.value ? parseFloat(e.target.value) : null; if (v !== item.adjusted_amount) { await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ adjusted_amount: v }) }); setLineItems(prev => prev.map(li => li.id === item.id ? { ...li, adjusted_amount: v } : li)) } }} /></div></td>
                              <td>
                                <select className="cell-select" defaultValue={item.payment_type ?? ''} style={{ minWidth: 100 }} onBlur={async e => { const v = e.target.value || null; if (v !== item.payment_type) await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payment_type: v }) }) }}>
                                  <option value="">—</option>
                                  <option value="cash">Cash</option>
                                  <option value="credit_card">Credit Card</option>
                                </select>
                              </td>
                              <td>
                                <select className="cell-select" defaultValue={item.reimbursable ? 'yes' : 'no'} onBlur={async e => { const v = e.target.value === 'yes'; if (v !== item.reimbursable) await fetch(`/api/expense-reports/${id}/line-items/${item.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reimbursable: v }) }) }}>
                                  <option value="yes">Yes</option>
                                  <option value="no">No</option>
                                </select>
                              </td>
                            </>
                          ) : (
                            <>
                              <td style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{item.expense_date ?? '—'}</td>
                              <td style={{ fontWeight: 500 }}>{item.vendor ?? '—'}</td>
                              <td style={{ color: '#6b7280' }}>{item.category ?? '—'}</td>
                              <td style={{ color: '#6b7280' }}>{item.description ?? '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 500 }}>{item.original_amount != null ? `$${formatCurrency(item.original_amount)}` : '—'}</td>
                              <td style={{ textAlign: 'right', color: '#7c3aed' }}>{item.adjusted_amount != null ? `$${formatCurrency(item.adjusted_amount)}` : '—'}</td>
                              <td style={{ color: '#6b7280', textTransform: 'capitalize' }}>{item.payment_type?.replace('_', ' ') ?? '—'}</td>
                              <td style={{ color: item.reimbursable ? '#166534' : '#dc2626' }}>{item.reimbursable ? 'Yes' : 'No'}</td>
                            </>
                          )}
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                              {(item.receipt_url || (item.receipts ?? []).length > 0) && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                  {item.receipt_url && <ExternalReceiptLink url={item.receipt_url} compact />}
                                  {(item.receipts ?? []).map(r => (
                                    <ExistingReceipt key={r.id} receipt={r} reportId={id} compact />
                                  ))}
                                </div>
                              )}
                              {openMenuId === item.id && (
                                <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setOpenMenuId(null); setMenuAnchor(null) }} />
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (openMenuId === item.id) { setOpenMenuId(null); setMenuAnchor(null) }
                                  else { const r = e.currentTarget.getBoundingClientRect(); setMenuAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right }); setOpenMenuId(item.id) }
                                }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, padding: '2px 6px', color: '#9ca3af', borderRadius: 6, lineHeight: 1 }}
                                title="Actions"
                              >
                                ···
                              </button>
                              {openMenuId === item.id && menuAnchor && (
                                <div style={{ position: 'fixed', top: menuAnchor.top, right: menuAnchor.right, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150, padding: '4px 0' }}>
                                  <button
                                    onClick={() => { setOpenMenuId(null); setMenuAnchor(null); setExpandedComments(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n }) }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: unresolvedCount > 0 ? '#92400e' : '#374151', textAlign: 'left', whiteSpace: 'nowrap' }}
                                  >
                                    💬 Comments{itemComments.length > 0 ? ` (${itemComments.length})` : ''}
                                  </button>
                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={() => { setOpenMenuId(null); setMenuAnchor(null); openEdit(item) }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#7c3aed', textAlign: 'left', whiteSpace: 'nowrap' }}
                                      >
                                        ✏️ Edit
                                      </button>
                                      <button
                                        onClick={() => { setOpenMenuId(null); setMenuAnchor(null); setDeleteTarget(item) }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left', whiteSpace: 'nowrap' }}
                                      >
                                        🗑 Delete
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Inline comment panel */}
                        {isExpanded && (
                          <tr key={`${item.id}-comments`}>
                            <td colSpan={9} style={{ padding: '12px 16px', background: '#fffbeb' }}>
                              {itemComments.length === 0 && <p style={{ margin: '0 0 10px', fontSize: 13, color: '#9ca3af' }}>No comments on this row.</p>}
                              {itemComments.map(c => (
                                <LineItemCommentThread key={c.id} comment={c} reportId={id} isReviewer={isReviewer} onRefresh={load} />
                              ))}
                              <div style={{ marginTop: 8 }}>
                                {newCommentFor === item.id ? (
                                  <div>
                                    <textarea value={newCommentBody} onChange={e => setNewCommentBody(e.target.value)} placeholder="Add a comment on this row…" rows={2} style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', resize: 'none' }} autoFocus />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                                      <button onClick={() => postLineItemComment(item.id)} disabled={postingComment || !newCommentBody.trim()} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (postingComment || !newCommentBody.trim()) ? 0.6 : 1 }}>
                                        {postingComment ? 'Sending…' : 'Comment'}
                                      </button>
                                      <button onClick={() => { setNewCommentFor(null); setNewCommentBody('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                  </div>
                                ) : (
                                  <button onClick={() => { setNewCommentFor(item.id); setNewCommentBody('') }} style={{ background: 'none', border: '1.5px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                                    + Add comment on this row
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {inlineNewRow && (
                    <tr style={{ background: '#fdf4ff', boxShadow: 'inset 0 0 0 2px #7c3aed' }}>
                      <td>
                        <input
                          ref={newRowDateRef}
                          autoFocus
                          className="cell-input"
                          type="date"
                          value={inlineNewRow.expense_date ?? ''}
                          style={{ background: '#fdf4ff' }}
                          onChange={e => setInlineNewRow(r => ({ ...r!, expense_date: e.target.value || null }))}
                        />
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          type="text"
                          placeholder="Vendor…"
                          value={inlineNewRow.vendor ?? ''}
                          style={{ background: '#fdf4ff' }}
                          onChange={e => setInlineNewRow(r => ({ ...r!, vendor: e.target.value || null }))}
                        />
                      </td>
                      <td>
                        <select
                          className="cell-select"
                          value={inlineNewRow.category ?? ''}
                          style={{ background: '#fdf4ff' }}
                          onChange={e => setInlineNewRow(r => ({ ...r!, category: e.target.value || null }))}
                        >
                          <option value="">— select —</option>
                          {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>
                      <td>
                        <input
                          className="cell-input"
                          type="text"
                          placeholder="Notes…"
                          value={inlineNewRow.description ?? ''}
                          style={{ minWidth: 120, background: '#fdf4ff' }}
                          onChange={e => setInlineNewRow(r => ({ ...r!, description: e.target.value || null }))}
                        />
                      </td>
                      <td>
                        <div className="amount-cell">
                          <span className="currency-prefix">$</span>
                          <input
                            className="cell-input"
                            type="number"
                            placeholder="0.00"
                            style={{ textAlign: 'right', minWidth: 80, background: '#fdf4ff' }}
                            value={inlineNewRow.original_amount ?? ''}
                            onChange={e => setInlineNewRow(r => ({ ...r!, original_amount: e.target.value ? parseFloat(e.target.value) : null }))}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="amount-cell">
                          <span className="currency-prefix">$</span>
                          <input
                            className="cell-input"
                            type="number"
                            placeholder="—"
                            style={{ textAlign: 'right', minWidth: 80, background: '#fdf4ff' }}
                            value={inlineNewRow.adjusted_amount ?? ''}
                            onChange={e => setInlineNewRow(r => ({ ...r!, adjusted_amount: e.target.value ? parseFloat(e.target.value) : null }))}
                          />
                        </div>
                      </td>
                      <td>
                        <select
                          className="cell-select"
                          value={inlineNewRow.payment_type ?? ''}
                          style={{ minWidth: 100, background: '#fdf4ff' }}
                          onChange={e => setInlineNewRow(r => ({ ...r!, payment_type: (e.target.value as 'cash' | 'credit_card') || null }))}
                        >
                          <option value="">—</option>
                          <option value="cash">Cash</option>
                          <option value="credit_card">Credit Card</option>
                        </select>
                      </td>
                      <td>
                        <select
                          className="cell-select"
                          value={(inlineNewRow.reimbursable ?? true) ? 'yes' : 'no'}
                          style={{ background: '#fdf4ff' }}
                          onChange={e => setInlineNewRow(r => ({ ...r!, reimbursable: e.target.value === 'yes' }))}
                        >
                          <option value="yes">Yes</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 6px' }}>
                          <button
                            onClick={saveInlineNewRow}
                            disabled={savingInline}
                            style={{ background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 5, padding: '4px 9px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: savingInline ? 0.6 : 1 }}
                            title="Save row"
                          >
                            {savingInline ? '…' : '✓'}
                          </button>
                          <button
                            onClick={() => { setInlineNewRow(null); setInlineError(null) }}
                            disabled={savingInline}
                            style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: 5, padding: '4px 9px', fontSize: 13, cursor: 'pointer', color: '#9ca3af' }}
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8f7ff', borderTop: '2px solid #ede9fe' }}>
                    <td colSpan={4} style={{ padding: '10px 8px', fontSize: 13, fontWeight: 700, color: '#6d28d9' }}>
                      Total ({lineItems.length} item{lineItems.length !== 1 ? 's' : ''})
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#1e1b4b', fontSize: 13 }}>
                      {totalOriginal > 0 ? `$${formatCurrency(totalOriginal)}` : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#7c3aed', fontSize: 13 }}>
                      {totalAdjusted > 0 ? `$${formatCurrency(totalAdjusted)}` : '—'}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {inlineError && (
            <div style={{ padding: '8px 16px', background: '#fef2f2', borderTop: '1px solid #fca5a5', color: '#dc2626', fontSize: 13 }}>{inlineError}</div>
          )}
          {canEdit && (lineItems.length > 0 || !!inlineNewRow) && (
            <div style={{ padding: '12px 16px', borderTop: '1px solid #f3f4f6' }}>
              <button onClick={openAdd} style={{ ...secondaryBtnStyle, flex: 'none', padding: '8px 16px', fontSize: 13 }}>+ Add row</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile cards ──────────────────────────────────── */}
      <div className="li-mobile">
        {lineItems.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af', background: '#fff', border: '1px solid #e9d5ff', borderRadius: 12 }}>
            <p style={{ margin: '0 0 16px', fontSize: 15 }}>No expenses yet.</p>
            {canEdit && <button onClick={openAdd} style={primaryBtnStyle}>+ Add Your First Expense</button>}
          </div>
        )}
        {lineItems.map(item => {
          const itemComments = commentsByItem[item.id] ?? []
          const unresolvedCount = itemComments.filter(c => !c.resolved_at).length
          const isExpanded = expandedComments.has(item.id)

          return (
            <div key={item.id} className="mobile-card" onClick={() => { if (canEdit) openEdit(item) }} style={canEdit ? { cursor: 'pointer' } : undefined}>
              <div className="mobile-card-header">
                <div>
                  <div style={{ fontWeight: 600, color: '#1e1b4b', fontSize: 15 }}>
                    {item.vendor ?? 'No vendor'}
                    {unresolvedCount > 0 && (
                      <span className="comment-badge has-unresolved" onClick={() => setExpandedComments(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}>
                        💬 {unresolvedCount}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{item.expense_date ?? '—'} · {item.category ?? 'No category'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 16, color: '#1e1b4b' }}>
                    {item.original_amount != null ? `$${formatCurrency(item.original_amount)}` : '—'}
                  </span>
                  <div>
                    {openMenuId === `m-${item.id}` && (
                      <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => { setOpenMenuId(null); setMenuAnchor(null) }} />
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (openMenuId === `m-${item.id}`) { setOpenMenuId(null); setMenuAnchor(null) }
                        else { const r = e.currentTarget.getBoundingClientRect(); setMenuAnchor({ top: r.bottom + 4, right: window.innerWidth - r.right }); setOpenMenuId(`m-${item.id}`) }
                      }}
                      style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: '#6b7280' }}
                    >
                      ···
                    </button>
                    {openMenuId === `m-${item.id}` && menuAnchor && (
                      <div style={{ position: 'fixed', top: menuAnchor.top, right: menuAnchor.right, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 100, minWidth: 150, padding: '4px 0' }}>
                        <button
                          onClick={() => { setOpenMenuId(null); setMenuAnchor(null); setExpandedComments(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n }) }}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: unresolvedCount > 0 ? '#92400e' : '#374151', textAlign: 'left', whiteSpace: 'nowrap' }}
                        >
                          💬 Comments{itemComments.length > 0 ? ` (${itemComments.length})` : ''}
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => { setOpenMenuId(null); setMenuAnchor(null); openEdit(item) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#7c3aed', textAlign: 'left', whiteSpace: 'nowrap' }}
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => { setOpenMenuId(null); setMenuAnchor(null); setDeleteTarget(item) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left', whiteSpace: 'nowrap' }}
                            >
                              🗑 Delete
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {(item.description || item.payment_type || item.adjusted_amount != null || itemComments.length > 0 || (item.receipts ?? []).length > 0) && (
                <div className="mobile-card-body" onClick={e => e.stopPropagation()}>
                  {item.description && <p style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280' }}>{item.description}</p>}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 12, color: '#6b7280' }}>
                    {item.payment_type && <span>{item.payment_type === 'cash' ? '💵 Cash' : '💳 Credit Card'}</span>}
                    {item.adjusted_amount != null && item.adjusted_amount !== item.original_amount && (
                      <span style={{ color: '#7c3aed' }}>Adjusted: ${formatCurrency(item.adjusted_amount)}</span>
                    )}
                    <span style={{ color: item.reimbursable ? '#166534' : '#dc2626' }}>{item.reimbursable ? '✓ Reimbursable' : '✗ Not reimbursable'}</span>
                  </div>

                  {/* Receipts */}
                  {(item.receipt_url || (item.receipts ?? []).length > 0) && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {item.receipt_url && (
                        <a href={item.receipt_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 12px', textDecoration: 'none' }}>
                          <span style={{ fontSize: 20 }}>🔗</span>
                          <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>Expensify receipt</span>
                          <span style={{ fontSize: 12, color: '#166534', fontWeight: 600 }}>View</span>
                        </a>
                      )}
                      {(item.receipts ?? []).map(r => (
                        <ReceiptPreviewMobile key={r.id} receipt={r} reportId={id} />
                      ))}
                    </div>
                  )}

                  {/* Comments toggle */}
                  <button
                    onClick={() => setExpandedComments(prev => { const n = new Set(prev); n.has(item.id) ? n.delete(item.id) : n.add(item.id); return n })}
                    style={{ marginTop: 10, background: 'none', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: unresolvedCount > 0 ? '#92400e' : '#6b7280' }}
                  >
                    💬 {itemComments.length === 0 ? 'Add comment' : `${itemComments.length} comment${itemComments.length !== 1 ? 's' : ''}${unresolvedCount > 0 ? ` (${unresolvedCount} open)` : ''}`}
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: 10 }}>
                      {itemComments.map(c => (
                        <LineItemCommentThread key={c.id} comment={c} reportId={id} isReviewer={isReviewer} onRefresh={load} />
                      ))}
                      {newCommentFor === item.id ? (
                        <div>
                          <textarea value={newCommentBody} onChange={e => setNewCommentBody(e.target.value)} placeholder="Add a comment…" rows={2} style={{ width: '100%', border: '1.5px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box', resize: 'none' }} autoFocus />
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button onClick={() => postLineItemComment(item.id)} disabled={postingComment || !newCommentBody.trim()} style={{ background: '#7c3aed', color: '#fff', border: 'none', padding: '7px 14px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (postingComment || !newCommentBody.trim()) ? 0.6 : 1 }}>
                              {postingComment ? 'Sending…' : 'Comment'}
                            </button>
                            <button onClick={() => { setNewCommentFor(null); setNewCommentBody('') }} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setNewCommentFor(item.id); setNewCommentBody('') }} style={{ marginTop: 6, background: 'none', border: '1.5px solid #d1d5db', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: '#6b7280' }}>
                          + Add comment
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Mobile FAB */}
      {canEdit && (
        <button className="btn-fab" onClick={openAdd} aria-label="Add expense">+</button>
      )}

      {/* Add/Edit dialog */}
      {dialogOpen && editingItem && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setDialogOpen(false); setEditingItem(null) } }}>
          <div className="modal">
            <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>
              {editingItem.id ? 'Edit Expense' : 'Add Expense'}
            </h2>
            {itemError && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: 14, marginBottom: 14 }}>
                {itemError}
              </div>
            )}
            <RowDialog initial={editingItem} onSave={saveItem} onCancel={() => { setDialogOpen(false); setEditingItem(null) }} saving={savingItem} />
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#1e1b4b' }}>Delete this expense?</h2>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>
              <strong>{deleteTarget.vendor ?? 'This item'}</strong>
              {deleteTarget.original_amount != null ? ` (${formatCurrency(deleteTarget.original_amount)})` : ''} will be permanently removed.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteTarget(null)} style={secondaryBtnStyle}>Cancel</button>
              <button onClick={deleteItem} disabled={deletingItem} style={{ flex: 2, background: '#dc2626', color: '#fff', border: 'none', padding: '11px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', opacity: deletingItem ? 0.6 : 1 }}>
                {deletingItem ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
