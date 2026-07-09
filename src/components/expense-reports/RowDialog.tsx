'use client'

import { useState, useEffect } from 'react'
import { EXPENSE_CATEGORIES } from '@/lib/expense-constants'
import type { ExpenseReportLineItem } from '@/types'
import { ExternalReceiptLink, ExistingReceipt } from './ReceiptComponents'

export const EMPTY_ITEM: Partial<ExpenseReportLineItem> = {
  expense_date: '',
  vendor: '',
  category: '',
  description: '',
  original_amount: null,
  adjusted_amount: null,
  payment_type: null,
  reimbursable: true,
}

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

export function RowDialog({
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
        <div style={{ gridColumn: '1 / 2', minWidth: 0 }}>
          <label style={labelStyle}>Date</label>
          <input type="date" style={inputStyle} value={form.expense_date ?? ''} onChange={e => set('expense_date', e.target.value || null)} />
        </div>

        <div style={{ gridColumn: '2 / 3', minWidth: 0 }}>
          <label style={labelStyle}>Vendor / Merchant</label>
          <input type="text" style={inputStyle} placeholder="e.g. Amazon, Delta" value={form.vendor ?? ''} onChange={e => set('vendor', e.target.value || null)} />
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Category</label>
          <select style={inputStyle} value={form.category ?? ''} onChange={e => set('category', e.target.value || null)}>
            <option value="">Select a category…</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {form.category === 'TBD - Please describe' && (
            <div style={{ marginTop: 8, padding: 12, backgroundColor: '#fef3c7', borderRadius: 6, fontSize: 13, color: '#92400e' }}>
              ⚠️ When selecting "TBD", please provide a clear description of the expense category below.
            </div>
          )}
        </div>

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description / Notes</label>
          <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={2} placeholder="Optional details…" value={form.description ?? ''} onChange={e => set('description', e.target.value || null)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={labelStyle}>Amount ($)</label>
          <input type="number" style={inputStyle} placeholder="0.00" min="0" step="0.01" value={form.original_amount ?? ''} onChange={e => set('original_amount', e.target.value ? parseFloat(e.target.value) : null)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <label style={labelStyle}>Adjusted Amount ($) <span style={{ fontWeight: 400, color: '#9ca3af' }}>optional</span></label>
          <input type="number" style={inputStyle} placeholder="0.00" min="0" step="0.01" value={form.adjusted_amount ?? ''} onChange={e => set('adjusted_amount', e.target.value ? parseFloat(e.target.value) : null)} />
        </div>

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

        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input type="checkbox" checked={form.reimbursable ?? true} onChange={e => set('reimbursable', e.target.checked)} style={{ width: 18, height: 18, accentColor: '#7c3aed' }} />
            <span><strong>Reimbursable</strong> — I&apos;m requesting reimbursement for this expense</span>
          </label>
        </div>

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
