'use client'

import { useEffect, useState, useCallback } from 'react'

interface HrLink {
  id: string
  title: string
  description: string | null
  url: string
  sort_order: number
  is_active: boolean
  created_at: string
}

interface LinkFormState {
  title: string
  description: string
  url: string
  sort_order: string
}

const EMPTY_FORM: LinkFormState = { title: '', description: '', url: '', sort_order: '0' }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db',
  borderRadius: '0.375rem', fontSize: '0.875rem', boxSizing: 'border-box',
}

function LinkForm({ form, formError, saving, editingId, onChange, onSave, onCancel }: {
  form: LinkFormState
  formError: string | null
  saving: boolean
  editingId: string | null
  onChange: (field: keyof LinkFormState, value: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.25rem', marginBottom: '1rem' }}>
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#374151' }}>Title *</label>
          <input style={inputStyle} value={form.title} onChange={e => onChange('title', e.target.value)} placeholder="e.g. HealthPartners" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#374151' }}>Description</label>
          <input style={inputStyle} value={form.description} onChange={e => onChange('description', e.target.value)} placeholder="Short description (optional)" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#374151' }}>URL *</label>
          <input style={inputStyle} value={form.url} onChange={e => onChange('url', e.target.value)} placeholder="https://" type="url" />
        </div>
        <div style={{ maxWidth: 120 }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: '#374151' }}>Sort Order</label>
          <input style={inputStyle} value={form.sort_order} onChange={e => onChange('sort_order', e.target.value)} type="number" min="0" />
        </div>
        {formError && <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: 0 }}>{formError}</p>}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={onSave}
            disabled={saving}
            style={{ padding: '0.5rem 1.25rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Link'}
          </button>
          <button onClick={onCancel} style={{ padding: '0.5rem 1rem', background: '#fff', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontSize: '0.875rem', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminHrLinksPage() {
  const [links, setLinks] = useState<HrLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<LinkFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetch('/api/admin/hr-links')
      .then(r => r.json())
      .then(d => { setLinks(d.links ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(link: HrLink) {
    setEditingId(link.id)
    setForm({ title: link.title, description: link.description ?? '', url: link.url, sort_order: String(link.sort_order) })
    setShowAdd(false)
    setFormError(null)
  }

  function startAdd() {
    setShowAdd(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function cancel() {
    setEditingId(null)
    setShowAdd(false)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  async function save() {
    if (!form.title.trim()) { setFormError('Title is required'); return }
    if (!form.url.trim()) { setFormError('URL is required'); return }
    setSaving(true)
    setFormError(null)
    const body = { title: form.title, description: form.description || null, url: form.url, sort_order: Number(form.sort_order) || 0 }
    try {
      const res = await fetch(editingId ? `/api/admin/hr-links/${editingId}` : '/api/admin/hr-links', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? 'Save failed'); setSaving(false); return }
      cancel()
      load()
    } catch { setFormError('Save failed') }
    setSaving(false)
  }

  function handleFormChange(field: keyof LinkFormState, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function toggleActive(link: HrLink) {
    await fetch(`/api/admin/hr-links/${link.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !link.is_active }),
    })
    load()
  }

  async function deleteLink(id: string) {
    if (!confirm('Delete this link?')) return
    await fetch(`/api/admin/hr-links/${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Employee Links</h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>Manage HR resource links visible to all employees.</p>
        </div>
        {!showAdd && !editingId && (
          <button
            onClick={startAdd}
            style={{ padding: '0.5rem 1.25rem', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
          >
            + Add Link
          </button>
        )}
      </div>

      {showAdd && <LinkForm form={form} formError={formError} saving={saving} editingId={editingId} onChange={handleFormChange} onSave={save} onCancel={cancel} />}

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && links.length === 0 && !showAdd && (
        <p style={{ color: '#6b7280' }}>No links yet. Add one above.</p>
      )}

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {links.map(link => (
          <div key={link.id}>
            {editingId === link.id ? (
              <LinkForm form={form} formError={formError} saving={saving} editingId={editingId} onChange={handleFormChange} onSave={save} onCancel={cancel} />
            ) : (
              <div style={{
                padding: '1rem 1.25rem',
                background: link.is_active ? '#fff' : '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                opacity: link.is_active ? 1 : 0.6,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#111827' }}>{link.title}</div>
                  {link.description && <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>{link.description}</div>}
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link.url}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '0.7rem', color: link.is_active ? '#059669' : '#9ca3af', fontWeight: 600 }}>
                    {link.is_active ? 'Active' : 'Hidden'}
                  </span>
                  <button onClick={() => toggleActive(link)} title={link.is_active ? 'Hide' : 'Show'} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' }}>
                    {link.is_active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => startEdit(link)} style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#374151' }}>
                    Edit
                  </button>
                  <button onClick={() => deleteLink(link.id)} style={{ background: 'none', border: '1px solid #fca5a5', borderRadius: '0.25rem', padding: '0.25rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', color: '#dc2626' }}>
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
