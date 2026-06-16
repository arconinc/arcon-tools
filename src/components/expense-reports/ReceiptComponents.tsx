'use client'

import { useState, useEffect } from 'react'
import type { ExpenseReportReceipt } from '@/types'

export function ExternalReceiptLink({ url, compact }: { url: string; compact?: boolean }) {
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

export function ExistingReceipt({ receipt, reportId, compact }: { receipt: ExpenseReportReceipt; reportId: string; compact?: boolean }) {
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

export function ReceiptPreviewMobile({ receipt, reportId }: { receipt: ExpenseReportReceipt; reportId: string }) {
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
