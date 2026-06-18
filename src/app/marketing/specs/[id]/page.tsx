'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { SpecSampleStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type SpecDetail = {
  id: string
  item_name: string
  item_number: string | null
  item_image_url: string | null
  vendor: string | null
  vendor_link: string | null
  po_number: string | null
  status: SpecSampleStatus
  order_date: string | null
  date_sent: string | null
  ship_date: string | null
  tracking_number: string | null
  follow_up_date: string | null
  follow_up_notes: string | null
  notes: string | null
  created_at: string
  updated_at: string
  customer: { id: string; name: string; logo_url: string | null; billing_city: string | null; billing_state: string | null } | null
  contact: { id: string; first_name: string; last_name: string; email: string | null } | null
  assigned_csr: { id: string; display_name: string; avatar_url: string | null; profile_image_url: string | null } | null
  sales_rep: { id: string; display_name: string; avatar_url: string | null; profile_image_url: string | null } | null
  linked_task: { id: string; title: string; status: string; due_date: string | null } | null
  artwork_task: { id: string; title: string; status: string; due_date: string | null } | null
  spec_idea: { id: string; item_name: string; vendor: string; image_url: string | null; ordering_instructions_html: string | null } | null
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_ORDER: SpecSampleStatus[] = [
  'not_contacted', 'artwork', 'ordered', 'in_production', 'shipped', 'delivered', 'approved',
]
const TERMINAL_STATUSES: SpecSampleStatus[] = ['declined', 'no_response']

const STATUS_LABEL: Record<SpecSampleStatus, string> = {
  not_contacted: 'Prospect Contacted',
  artwork: 'Artwork',
  ordered: 'Ordered',
  in_production: 'In Production',
  shipped: 'Shipped',
  delivered: 'Delivered',
  approved: 'Approved',
  declined: 'Declined',
  no_response: 'No Response',
}

const STATUS_COLOR: Record<SpecSampleStatus, { bg: string; text: string; border: string }> = {
  not_contacted: { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' },
  artwork: { bg: '#fdf4ff', text: '#7e22ce', border: '#e9d5ff' },
  ordered: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  in_production: { bg: '#fefce8', text: '#a16207', border: '#fde68a' },
  shipped: { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
  delivered: { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  approved: { bg: '#f3f0ff', text: '#7c3aed', border: '#ddd6fe' },
  declined: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  no_response: { bg: '#fafafa', text: '#71717a', border: '#e4e4e7' },
}

function StatusPill({ status }: { status: SpecSampleStatus }) {
  const c = STATUS_COLOR[status]
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
      {STATUS_LABEL[status]}
    </span>
  )
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function UserAvatar({ user }: { user: { display_name: string; avatar_url: string | null; profile_image_url?: string | null } }) {
  const [imgError, setImgError] = useState(false)
  const src = user.profile_image_url || user.avatar_url
  const initials = user.display_name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {src && !imgError ? (
        <img src={src} alt="" onError={() => setImgError(true)} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
          {initials}
        </div>
      )}
      <span style={{ fontSize: 14, color: '#1e293b' }}>{user.display_name}</span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function SpecDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [spec, setSpec] = useState<SpecDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<SpecDetail>>({})
  const [deletingSpec, setDeletingSpec] = useState(false)

  useEffect(() => {
    fetch(`/api/marketing/specs/${id}`)
      .then(r => r.json())
      .then((d: SpecDetail) => { setSpec(d); setLoading(false) })
  }, [id])

  async function updateStatus(status: SpecSampleStatus) {
    if (!spec) return
    setSaving(true)
    const res = await fetch(`/api/marketing/specs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const updated = await res.json()
    setSpec(prev => prev ? { ...prev, ...updated } : null)
    setSaving(false)
  }

  async function saveEdit() {
    if (!spec) return
    setSaving(true)
    const res = await fetch(`/api/marketing/specs/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    const updated = await res.json()
    setSpec(prev => prev ? { ...prev, ...updated } : null)
    setEditing(false)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this spec? This cannot be undone.')) return
    setDeletingSpec(true)
    await fetch(`/api/marketing/specs/${id}`, { method: 'DELETE' })
    router.push('/marketing/specs')
  }

  function startEdit() {
    if (!spec) return
    setEditForm({
      po_number: spec.po_number ?? '',
      order_date: spec.order_date ?? '',
      date_sent: spec.date_sent ?? '',
      ship_date: spec.ship_date ?? '',
      tracking_number: spec.tracking_number ?? '',
      follow_up_date: spec.follow_up_date ?? '',
      follow_up_notes: spec.follow_up_notes ?? '',
      notes: spec.notes ?? '',
    })
    setEditing(true)
  }

  if (loading) {
    return (
      <div style={{ padding: 48, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
    )
  }

  if (!spec) {
    return (
      <div style={{ padding: 48 }}>
        <div style={{ color: '#ef4444', fontSize: 14 }}>Spec not found.</div>
        <Link href="/marketing/specs" style={{ color: '#7c3aed', fontSize: 13 }}>← Back to specs</Link>
      </div>
    )
  }

  const currentIdx = STATUS_ORDER.indexOf(spec.status)
  const isTerminal = TERMINAL_STATUSES.includes(spec.status)
  const nextStatus: SpecSampleStatus | null = currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1
    ? STATUS_ORDER[currentIdx + 1]
    : null

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        .sd-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: #94a3b8; margin-bottom: 5px; }
        .sd-value { font-size: 14px; color: #1e293b; }
        .sd-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; }
        .sd-input:focus { border-color: #7c3aed; }
        .progress-step { display: flex; flex-direction: column; align-items: center; flex: 1; position: relative; }
        .progress-step::after { content: ''; position: absolute; top: 13px; left: 50%; width: 100%; height: 2px; }
        .progress-step:last-child::after { display: none; }
        .step-circle { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; z-index: 1; }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: '#94a3b8' }}>
        <Link href="/marketing/specs" style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>Spec Samples</Link>
        <span>›</span>
        {spec.customer && (
          <>
            <Link href={`/marketing/customers/${spec.customer.id}`} style={{ color: '#64748b', textDecoration: 'none' }}>{spec.customer.name}</Link>
            <span>›</span>
          </>
        )}
        <span style={{ color: '#1e293b', fontWeight: 600 }}>{spec.item_name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
        {spec.item_image_url ? (
          <img src={spec.item_image_url} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 80, height: 80, borderRadius: 12, background: '#f1f5f9', border: '1px solid #e2e8f0', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>{spec.item_name}</h1>
            <StatusPill status={spec.status} />
          </div>
          <div style={{ fontSize: 14, color: '#64748b', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            {(spec.spec_idea?.vendor ?? spec.vendor) && <span>Vendor: <strong style={{ color: '#7c3aed' }}>{spec.spec_idea?.vendor ?? spec.vendor}</strong></span>}
            {spec.item_number && <span>Item #: {spec.item_number}</span>}
            {spec.po_number && <span>PO: {spec.po_number}</span>}
          </div>
          {spec.customer && (
            <div style={{ marginTop: 6, fontSize: 14, color: '#374151' }}>
              <Link href={`/marketing/customers/${spec.customer.id}`} style={{ color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>{spec.customer.name}</Link>
              {spec.contact && <span style={{ color: '#64748b' }}> · {spec.contact.first_name} {spec.contact.last_name}</span>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!editing && (
            <button onClick={startEdit} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
              Edit
            </button>
          )}
          <Link
            href={`/marketing/specs/new?customerId=${spec.customer?.id ?? ''}&ideaId=${spec.spec_idea?.id ?? ''}`}
            style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, textDecoration: 'none', color: '#374151' }}
          >
            Duplicate
          </Link>
        </div>
      </div>

      {/* Status progression bar */}
      {!isTerminal && (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative', marginBottom: 16 }}>
            {/* Track line */}
            <div style={{ position: 'absolute', top: 13, left: 14, right: 14, height: 2, background: '#e2e8f0', zIndex: 0 }} />
            <div style={{ position: 'absolute', top: 13, left: 14, height: 2, background: '#7c3aed', zIndex: 0, width: `${(currentIdx / (STATUS_ORDER.length - 1)) * (100 - 28 / STATUS_ORDER.length)}%` }} />
            {STATUS_ORDER.map((s, idx) => {
              const done = idx < currentIdx
              const active = idx === currentIdx
              return (
                <div
                  key={s}
                  className="progress-step"
                  onClick={() => !saving && !active && updateStatus(s)}
                  title={`Set status: ${STATUS_LABEL[s]}`}
                  style={{ cursor: active || saving ? 'default' : 'pointer' }}
                >
                  <div
                    className="step-circle"
                    style={{
                      background: done || active ? '#7c3aed' : 'white',
                      color: done || active ? 'white' : '#cbd5e1',
                      border: `2px solid ${done || active ? '#7c3aed' : '#e2e8f0'}`,
                      boxShadow: active ? '0 0 0 4px #ede9fe' : 'none',
                      transition: 'background .15s, border-color .15s',
                    }}
                  >
                    {done ? '✓' : idx + 1}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: active ? '#7c3aed' : done ? '#374151' : '#94a3b8', marginTop: 6, textAlign: 'center', lineHeight: 1.2 }}>
                    {STATUS_LABEL[s]}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {nextStatus && (
              <button
                onClick={() => updateStatus(nextStatus)}
                disabled={saving}
                style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}
              >
                Mark as {STATUS_LABEL[nextStatus]} →
              </button>
            )}
            <button
              onClick={() => updateStatus('declined')}
              disabled={saving}
              style={{ background: 'white', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Declined
            </button>
            <button
              onClick={() => updateStatus('no_response')}
              disabled={saving}
              style={{ background: 'white', color: '#71717a', border: '1px solid #e4e4e7', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              No Response
            </button>
          </div>
        </div>
      )}

      {isTerminal && (
        <div style={{ background: spec.status === 'approved' ? '#f3f0ff' : '#fef2f2', border: `1px solid ${spec.status === 'approved' ? '#ddd6fe' : '#fecaca'}`, borderRadius: 14, padding: '14px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <StatusPill status={spec.status} />
          <span style={{ fontSize: 14, color: '#64748b' }}>This spec is closed.</span>
          <button
            onClick={() => updateStatus('not_contacted')}
            style={{ marginLeft: 'auto', background: 'white', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#374151' }}
          >
            Reopen
          </button>
        </div>
      )}

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Main details card */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>Spec Details</h2>
              {editing ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditing(false)} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={saveEdit} disabled={saving} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              ) : null}
            </div>
            <div style={{ padding: '20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 24px' }}>
              {editing ? (
                <>
                  {[
                    { label: 'PO Number', field: 'po_number', type: 'text' },
                    { label: 'Order Date', field: 'order_date', type: 'date' },
                    { label: 'Date Sent', field: 'date_sent', type: 'date' },
                    { label: 'Ship Date', field: 'ship_date', type: 'date' },
                    { label: 'Tracking Number', field: 'tracking_number', type: 'text' },
                  ].map(({ label, field, type }) => (
                    <div key={field}>
                      <div className="sd-label">{label}</div>
                      <input
                        className="sd-input"
                        type={type}
                        value={(editForm as any)[field] ?? ''}
                        onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: '1/-1' }}>
                    <div className="sd-label">Notes</div>
                    <textarea className="sd-input" rows={3} value={editForm.notes ?? ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                </>
              ) : (
                <>
                  {[
                    { label: 'PO Number', value: spec.po_number },
                    { label: 'Order Date', value: fmtDate(spec.order_date) },
                    { label: 'Date Sent', value: fmtDate(spec.date_sent) },
                    { label: 'Ship Date', value: fmtDate(spec.ship_date) },
                    { label: 'Tracking #', value: spec.tracking_number },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div className="sd-label">{label}</div>
                      <div className="sd-value">{value ?? '—'}</div>
                    </div>
                  ))}
                  {spec.vendor_link && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="sd-label">Vendor Link</div>
                      <a href={spec.vendor_link} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', fontSize: 14, wordBreak: 'break-all' }}>
                        {spec.vendor_link}
                      </a>
                    </div>
                  )}
                  {spec.notes && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="sd-label">Notes</div>
                      <div className="sd-value" style={{ whiteSpace: 'pre-wrap' }}>{spec.notes}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Follow-up card */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>Follow-up</h2>
            </div>
            <div style={{ padding: '20px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 24px' }}>
              {editing ? (
                <>
                  <div>
                    <div className="sd-label">Follow-up Date</div>
                    <input className="sd-input" type="date" value={editForm.follow_up_date ?? ''} onChange={e => setEditForm(p => ({ ...p, follow_up_date: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: '1/-1' }}>
                    <div className="sd-label">Follow-up Notes</div>
                    <textarea className="sd-input" rows={3} value={editForm.follow_up_notes ?? ''} onChange={e => setEditForm(p => ({ ...p, follow_up_notes: e.target.value }))} style={{ resize: 'vertical' }} />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="sd-label">Follow-up Date</div>
                    <div className="sd-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {spec.follow_up_date ? (
                        <>
                          {fmtDate(spec.follow_up_date)}
                          {spec.follow_up_date < new Date().toISOString().slice(0, 10) && !['approved', 'declined'].includes(spec.status) && (
                            <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 10, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>Overdue</span>
                          )}
                        </>
                      ) : '—'}
                    </div>
                  </div>
                  {spec.follow_up_notes && (
                    <div style={{ gridColumn: '1/-1' }}>
                      <div className="sd-label">Notes</div>
                      <div className="sd-value" style={{ whiteSpace: 'pre-wrap' }}>{spec.follow_up_notes}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Ordering instructions (from spec_idea) */}
          {spec.spec_idea?.ordering_instructions_html && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>Ordering Instructions</h2>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>From the spec idea catalog</p>
              </div>
              <div
                style={{ padding: '20px 20px' }}
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: spec.spec_idea.ordering_instructions_html }}
              />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* People */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8', marginBottom: 12 }}>Team</div>
            {spec.assigned_csr && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>CSR</div>
                <UserAvatar user={spec.assigned_csr} />
              </div>
            )}
            {spec.sales_rep && (
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Sales Rep</div>
                <UserAvatar user={spec.sales_rep} />
              </div>
            )}
            {!spec.assigned_csr && !spec.sales_rep && (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No team assigned</div>
            )}
          </div>

          {/* Linked CRM tasks */}
          {(spec.linked_task || spec.artwork_task) && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8', marginBottom: 10 }}>Linked Tasks</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  spec.linked_task ? { task: spec.linked_task, label: 'Follow-up' } : null,
                  spec.artwork_task ? { task: spec.artwork_task, label: 'Artwork' } : null,
                ].filter((x) => x !== null).map(({ task, label }) => (
                  <div key={task!.id} style={{ borderLeft: '3px solid #e2e8f0', paddingLeft: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', marginBottom: 2 }}>{label}</div>
                    <Link href={`/tasks/${task!.id}`} style={{ fontSize: 13, fontWeight: 600, color: '#7c3aed', textDecoration: 'none', display: 'block', marginBottom: 4 }}>{task!.title}</Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        background: task!.status === 'complete' ? '#dcfce7' : '#eff6ff',
                        color: task!.status === 'complete' ? '#16a34a' : '#1d4ed8',
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                      }}>
                        {task!.status}
                      </span>
                      {task!.due_date && <span style={{ fontSize: 12, color: '#64748b' }}>Due {fmtDate(task!.due_date)}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Spec idea link */}
          {spec.spec_idea && (
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8' }}>From Spec Idea</div>
              </div>
              <div style={{ display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
                {spec.spec_idea.image_url && (
                  <img src={spec.spec_idea.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{spec.spec_idea.item_name}</div>
                  <div style={{ fontSize: 12, color: '#7c3aed' }}>{spec.spec_idea.vendor}</div>
                </div>
              </div>
              <div style={{ padding: '0 16px 12px' }}>
                <Link href={`/marketing/specs/ideas`} style={{ fontSize: 12, color: '#7c3aed', fontWeight: 600, textDecoration: 'none' }}>View in Ideas Library →</Link>
              </div>
            </div>
          )}

          {/* Meta */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#94a3b8', marginBottom: 10 }}>Record Info</div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div>Created {new Date(spec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div>Updated {new Date(spec.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>

          {/* Danger zone */}
          <div style={{ background: 'white', border: '1px solid #fecaca', borderRadius: 14, padding: '14px 18px' }}>
            <button
              onClick={handleDelete}
              disabled={deletingSpec}
              style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              {deletingSpec ? 'Deleting…' : 'Delete Spec'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
