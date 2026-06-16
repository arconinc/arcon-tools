'use client'

import { useState } from 'react'

type ContactForm = {
  first_name: string
  last_name: string
  email: string
  phone: string
  title: string
  department: string
}

const EMPTY_FORM: ContactForm = { first_name: '', last_name: '', email: '', phone: '', title: '', department: '' }

type Props = {
  open: boolean
  customerId: string
  onClose: () => void
  onContactAdded: (contact: unknown) => void
}

export function AddContactModal({ open, customerId, onClose, onContactAdded }: Props) {
  const [form, setForm] = useState<ContactForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  function handleClose() {
    setForm(EMPTY_FORM)
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, customer_id: customerId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to create contact'); return }
      onContactAdded(data)
      setForm(EMPTY_FORM)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400'
  const labelCls = 'block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-slate-800 mb-4">Add Contact</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>First Name *</label>
              <input value={form.first_name} onChange={(e) => setForm(p => ({ ...p, first_name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name *</label>
              <input value={form.last_name} onChange={(e) => setForm(p => ({ ...p, last_name: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Email</label>
            <input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phone</label>
              <input value={form.phone} onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Title</label>
              <input value={form.title} onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Department</label>
            <select value={form.department} onChange={(e) => setForm(p => ({ ...p, department: e.target.value }))}
              className={`${inputCls} bg-white`}>
              <option value="">— None —</option>
              {['Accounting','C-Suite','Customer Service','Finance','HR','IT','Legal','Management','Marketing','Operations','Purchasing','Sales','Other'].map(d => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          {error && <div className="text-xs text-red-600">{error}</div>}
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-sm font-semibold bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl transition-colors">
              {saving ? 'Adding…' : 'Add Contact'}
            </button>
            <button type="button" onClick={handleClose}
              className="flex-1 py-2 text-sm font-semibold border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
