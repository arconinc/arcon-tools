'use client'

import { useState } from 'react'
import { StoreDetail } from '@/types'

// ── Multi-select chip ─────────────────────────────────────────────────────────

const OPTIONS: Record<string, string[]> = {
  store_types: ['Corporate', 'Employee'],
  who_pays: ['Corporate', 'User'],
  payment_methods: ['Credit Card', 'Bill Corp', 'Budget'],
  freight: ['Corporate Covers', 'User Pays', 'Split'],
  product_types: ['On Demand', 'Stock'],
}

function MultiSelect({
  field, label, value, onChange,
}: {
  field: string; label: string; value: string[]; onChange: (v: string[]) => void
}) {
  const opts = OPTIONS[field] ?? []
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {opts.map(opt => {
          const active = value.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(active ? value.filter(v => v !== opt) : [...value, opt])}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-purple-600 border-purple-600 text-white'
                  : 'border-slate-200 text-slate-600 hover:border-purple-300 hover:text-purple-700'
              }`}
            >
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tag editor ────────────────────────────────────────────────────────────────

function TagEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('')

  function add() {
    const v = input.trim()
    if (v && !value.includes(v)) onChange([...value, v])
    setInput('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-xs font-medium">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter(t => t !== tag))}
              className="w-3.5 h-3.5 rounded-full bg-slate-300 hover:bg-red-300 flex items-center justify-center text-slate-600 hover:text-red-700 transition-colors"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add field…"
          className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button type="button" onClick={add} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors">Add</button>
      </div>
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

export function OverviewTab({ store, onSaved }: { store: StoreDetail; onSaved: () => void }) {
  const [form, setForm] = useState({
    store_name: store.store_name,
    domain: store.domain ?? '',
    status: store.status,
    in_production: store.in_production,
    launch_date: store.launch_date ?? '',
    takedown_date: store.takedown_date ?? '',
    store_types: store.store_types,
    who_pays: store.who_pays,
    payment_methods: store.payment_methods,
    freight: store.freight,
    unique_incentives: store.unique_incentives ?? '',
    product_types: store.product_types,
    allowances: store.allowances ?? '',
    mandatory_notes: store.mandatory_notes,
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    const res = await fetch(`/api/stores/${store.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        launch_date: form.launch_date || null,
        takedown_date: form.takedown_date || null,
        unique_incentives: form.unique_incentives || null,
        allowances: form.allowances || null,
      }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setErr(d.error); return }
    setSaved(true); setTimeout(() => setSaved(false), 2000)
    onSaved()
  }

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  return (
    <form onSubmit={save} className="space-y-6">
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>}

      {/* Core info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Site Name</label>
          <input type="text" value={form.store_name} onChange={e => set('store_name', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Domain</label>
          <input type="text" value={form.domain} onChange={e => set('domain', e.target.value)}
            placeholder="xxx.shop-arcon.com"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Launch Date</label>
          <input type="date" value={form.launch_date} onChange={e => set('launch_date', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Take Down Date</label>
          <input type="date" value={form.takedown_date} onChange={e => set('takedown_date', e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value as 'Active' | 'Inactive')}
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.in_production} onChange={e => set('in_production', e.target.checked)}
              className="w-4 h-4 rounded accent-purple-600" />
            <span className="text-sm font-medium text-slate-700">In Production</span>
          </label>
        </div>
      </div>

      {/* Multi-selects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
        <MultiSelect field="store_types" label="Store Type" value={form.store_types} onChange={v => set('store_types', v)} />
        <MultiSelect field="who_pays" label="Who is Paying" value={form.who_pays} onChange={v => set('who_pays', v)} />
        <MultiSelect field="payment_methods" label="Payment Methods" value={form.payment_methods} onChange={v => set('payment_methods', v)} />
        <MultiSelect field="freight" label="Freight" value={form.freight} onChange={v => set('freight', v)} />
        <MultiSelect field="product_types" label="Product Types" value={form.product_types} onChange={v => set('product_types', v)} />
      </div>

      {/* Free-text */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Unique Incentives or Discounts</label>
          <textarea value={form.unique_incentives} onChange={e => set('unique_incentives', e.target.value)} rows={3}
            placeholder="Describe any unique incentives…"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Allowances / Budgets / Gift Codes</label>
          <textarea value={form.allowances} onChange={e => set('allowances', e.target.value)} rows={3}
            placeholder="Describe allowances, budgets, or gift codes…"
            className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
        </div>
      </div>

      {/* Mandatory notes tags */}
      <div className="pt-2 border-t border-slate-100">
        <label className="block text-xs font-medium text-slate-500 mb-2">Mandatory Fields in Notes</label>
        <TagEditor value={form.mandatory_notes} onChange={v => set('mandatory_notes', v)} />
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
        <button type="submit" disabled={saving}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors">
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Saved!</span>}
      </div>
    </form>
  )
}
