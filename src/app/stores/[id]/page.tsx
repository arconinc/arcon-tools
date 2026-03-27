'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { StoreDetail, StoreAssignment, CrmTask } from '@/types'

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(s: string | null): string {
  if (!s) return '—'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
      {label}
    </span>
  )
}

// ── Multi-select chip component ───────────────────────────────────────────────

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

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: CrmTask }) {
  const priorityColor: Record<string, string> = { high: 'text-red-600 bg-red-50', medium: 'text-amber-600 bg-amber-50', low: 'text-slate-500 bg-slate-100' }
  const statusLabel: Record<string, string> = {
    not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed',
    waiting_on_approval: 'Pending Approval', waiting_on_client_approval: 'Client Approval', need_changes: 'Needs Changes',
  }
  return (
    <Link href={`/crm/tasks/${task.id}`} className="flex items-center px-4 py-3 hover:bg-slate-50 gap-3 border-b border-slate-50 last:border-0 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
        {task.due_date && <p className="text-xs text-slate-400 mt-0.5">Due {formatDate(task.due_date)}</p>}
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityColor[task.priority]}`}>{task.priority}</span>
      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">{statusLabel[task.status] ?? task.status}</span>
    </Link>
  )
}

// ── New Task Form ─────────────────────────────────────────────────────────────

function NewTaskForm({ storeId, onCreated }: { storeId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    const res = await fetch(`/api/stores/${storeId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, due_date: dueDate || null }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setErr(d.error); return }
    setOpen(false); setTitle(''); setDueDate(''); onCreated()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium px-4 py-2.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Task
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
      {err && <p className="text-xs text-red-600">{err}</p>}
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
        placeholder="Task title…"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
      />
      <div className="flex gap-2">
        <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </form>
  )
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ store, onSaved }: { store: StoreDetail; onSaved: () => void }) {
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

// ── Team Tab ──────────────────────────────────────────────────────────────────

interface AppUserSummary { id: string; display_name: string; email: string; avatar_url: string | null; profile_image_url: string | null }

function TeamTab({ store }: { store: StoreDetail }) {
  const [assignments, setAssignments] = useState<StoreAssignment[]>(store.assignments)
  const [allUsers, setAllUsers] = useState<AppUserSummary[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'manager' | 'sales'>('sales')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAllUsers(d)
    })
  }, [])

  async function addAssignment() {
    if (!selectedUserId) return
    setSaving(true); setErr(null)
    const res = await fetch(`/api/stores/${store.id}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setErr(d.error); return }
    const newAssignment = await res.json()
    setAssignments(a => [...a.filter(x => x.user_id !== selectedUserId), newAssignment])
    setSelectedUserId('')
  }

  async function removeAssignment(userId: string) {
    const res = await fetch(`/api/stores/${store.id}/assignments?user_id=${userId}`, { method: 'DELETE' })
    if (res.ok) setAssignments(a => a.filter(x => x.user_id !== userId))
  }

  const unassigned = allUsers.filter(u => !assignments.find(a => a.user_id === u.id))

  const roleColor: Record<string, string> = {
    manager: 'bg-purple-100 text-purple-700',
    sales: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="space-y-4">
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>}

      {assignments.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-6">No team members assigned yet.</p>
      ) : (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-sm shrink-0 overflow-hidden">
                {a.user?.profile_image_url
                  ? <img src={a.user.profile_image_url} alt="" className="w-full h-full object-cover" />
                  : (a.user?.display_name?.[0] ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.user?.display_name}</p>
                <p className="text-xs text-slate-400">{a.user?.email}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${roleColor[a.role]}`}>{a.role}</span>
              <button onClick={() => removeAssignment(a.user_id)}
                className="text-slate-300 hover:text-red-500 transition-colors p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add member */}
      {unassigned.length > 0 && (
        <div className="flex gap-2 items-center pt-2 border-t border-slate-100">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Select a team member…</option>
            {unassigned.map(u => (
              <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
            ))}
          </select>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value as 'manager' | 'sales')}
            className="w-28 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="manager">Manager</option>
            <option value="sales">Sales</option>
          </select>
          <button onClick={addAssignment} disabled={!selectedUserId || saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── CRM Links Tab ─────────────────────────────────────────────────────────────

function CrmLinksTab({ store, onSaved }: { store: StoreDetail; onSaved: () => void }) {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([])
  const [contacts, setContacts] = useState<{ id: string; first_name: string; last_name: string; email: string | null }[]>([])
  const [linkedCustomer, setLinkedCustomer] = useState(store.customer)
  const [linkedContacts, setLinkedContacts] = useState(store.contacts)
  const [customerSearch, setCustomerSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crm/customers?limit=200').then(r => r.json()).then(d => { if (d?.customers) setCustomers(d.customers) })
  }, [])

  // Fetch contacts scoped to the linked customer whenever it changes
  useEffect(() => {
    if (!linkedCustomer) { setContacts([]); return }
    fetch(`/api/crm/contacts?customer_id=${linkedCustomer.id}&limit=200`)
      .then(r => r.json())
      .then(d => { if (d?.contacts) setContacts(d.contacts) })
  }, [linkedCustomer?.id])

  async function setCustomer(customerId: string | null) {
    setSaving(true); setErr(null)
    if (customerId) {
      await fetch(`/api/stores/${store.id}/customer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_id: customerId }),
      })
      const found = customers.find(c => c.id === customerId)
      setLinkedCustomer(found ?? null)
    } else {
      await fetch(`/api/stores/${store.id}/customer`, { method: 'DELETE' })
      setLinkedCustomer(null)
      setLinkedContacts([])
    }
    setSaving(false)
    onSaved()
  }

  async function addContact(contactId: string) {
    const res = await fetch(`/api/stores/${store.id}/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: contactId }),
    })
    if (res.ok) {
      const c = contacts.find(x => x.id === contactId)
      if (c) setLinkedContacts(lc => [...lc, c])
    }
  }

  async function removeContact(contactId: string) {
    const res = await fetch(`/api/stores/${store.id}/contacts?contact_id=${contactId}`, { method: 'DELETE' })
    if (res.ok) setLinkedContacts(lc => lc.filter(c => c.id !== contactId))
  }

  const filteredCustomers = customers.filter(c =>
    !customerSearch || c.name.toLowerCase().includes(customerSearch.toLowerCase())
  )
  const unlinkedContacts = contacts.filter(c => !linkedContacts.find(lc => lc.id === c.id))

  return (
    <div className="space-y-6">
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>}

      {/* Customer */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">CRM Customer</h3>
        {linkedCustomer ? (
          <div className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0">
              {linkedCustomer.name[0]}
            </div>
            <Link href={`/crm/customers/${linkedCustomer.id}`} className="flex-1 text-sm font-medium text-slate-800 hover:text-purple-700 transition-colors">
              {linkedCustomer.name}
            </Link>
            <button onClick={() => setCustomer(null)} disabled={saving}
              className="text-slate-300 hover:text-red-500 transition-colors p-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <input type="text" value={customerSearch} onChange={e => setCustomerSearch(e.target.value)}
              placeholder="Search customers…"
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
            {customerSearch && (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto bg-white">
                {filteredCustomers.slice(0, 10).map(c => (
                  <button key={c.id} type="button" onClick={() => { setCustomer(c.id); setCustomerSearch('') }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 hover:text-purple-700 transition-colors border-b border-slate-50 last:border-0">
                    {c.name}
                  </button>
                ))}
                {filteredCustomers.length === 0 && <p className="px-4 py-2.5 text-sm text-slate-400">No customers found</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contacts — only available once a customer is linked */}
      {linkedCustomer && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Contacts</h3>
          {linkedContacts.length > 0 && (
            <div className="space-y-2 mb-3">
              {linkedContacts.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-semibold text-sm shrink-0">
                    {c.first_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/crm/contacts/${c.id}`} className="text-sm font-medium text-slate-800 hover:text-purple-700 transition-colors">
                      {c.first_name} {c.last_name}
                    </Link>
                    {c.email && <p className="text-xs text-slate-400">{c.email}</p>}
                  </div>
                  <button onClick={() => removeContact(c.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-400">No contacts found for this customer.</p>
          ) : unlinkedContacts.length > 0 ? (
            <select
              defaultValue=""
              onChange={e => { if (e.target.value) { addContact(e.target.value); e.target.value = '' } }}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              <option value="" disabled>Add a contact…</option>
              {unlinkedContacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}{c.email ? ` — ${c.email}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-sm text-slate-400">All contacts for this customer have been added.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({ storeId }: { storeId: string }) {
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/stores/${storeId}/tasks`)
    const d = await res.json()
    setLoading(false)
    if (Array.isArray(d)) setTasks(d)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const open = tasks.filter(t => t.status !== 'completed')
  const done = tasks.filter(t => t.status === 'completed')

  return (
    <div>
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(n => <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No tasks yet.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
          {open.map(t => <TaskRow key={t.id} task={t} />)}
          {done.length > 0 && open.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">Completed</div>
          )}
          {done.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
      <NewTaskForm storeId={storeId} onCreated={load} />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'tasks' | 'team' | 'crm'

export default function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [store, setStore] = useState<StoreDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('overview')

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${id}`)
    if (!res.ok) { setError('Store not found'); setLoading(false); return }
    const d = await res.json()
    setStore(d)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-1/3" />
        <div className="h-4 bg-slate-100 rounded w-1/4" />
        <div className="h-64 bg-slate-100 rounded-2xl" />
      </div>
    )
  }

  if (error || !store) {
    return (
      <div className="max-w-4xl mx-auto">
        <p className="text-red-600">{error ?? 'Store not found'}</p>
        <Link href="/stores" className="text-sm text-purple-600 hover:underline mt-2 inline-block">← Back to Stores</Link>
      </div>
    )
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: 'Tasks', count: store.open_task_count || undefined },
    { key: 'team', label: 'Team', count: store.assignments.length || undefined },
    { key: 'crm', label: 'CRM Links' },
  ]

  return (
    <>
      <style>{`
        .store-detail { max-width: 900px; margin: 0 auto; }
        .tab-bar { display: flex; gap: 4px; border-bottom: 1px solid #e2e8f0; margin-bottom: 24px; }
        .tab-btn { padding: 8px 16px 10px; font-size: 14px; font-weight: 500; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; white-space: nowrap; }
        .tab-btn:hover { color: #7c3aed; }
        .tab-btn.active { color: #7c3aed; border-bottom-color: #7c3aed; }
        .tab-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; background: #f3e8ff; color: #7c3aed; border-radius: 999px; font-size: 10px; font-weight: 700; margin-left: 6px; padding: 0 4px; }
      `}</style>

      <div className="store-detail">
        {/* Back */}
        <Link href="/stores" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-purple-700 mb-4 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Stores
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{store.store_name}</h1>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {store.domain && (
                <span className="font-mono text-xs text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">{store.domain}</span>
              )}
              <StatusPill active={store.is_active} label={store.status} />
              {store.in_production && (
                <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">In Production</span>
              )}
              {store.store_id && (
                <span className="font-mono text-xs text-slate-400">ID: {store.store_id}</span>
              )}
            </div>
            {(store.launch_date || store.takedown_date) && (
              <p className="text-xs text-slate-400 mt-1.5">
                {store.launch_date && <span>Launch: {formatDate(store.launch_date)}</span>}
                {store.launch_date && store.takedown_date && <span className="mx-1.5">·</span>}
                {store.takedown_date && <span>Ends: {formatDate(store.takedown_date)}</span>}
              </p>
            )}
          </div>
          <button onClick={() => router.push('/stores')}
            className="shrink-0 px-4 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
            ← Stores
          </button>
        </div>

        {/* Tab bar */}
        <div className="tab-bar">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? 'active' : ''}`}>
              {t.label}
              {t.count !== undefined && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          {tab === 'overview' && <OverviewTab store={store} onSaved={load} />}
          {tab === 'tasks' && <TasksTab storeId={store.id} />}
          {tab === 'team' && <TeamTab store={store} />}
          {tab === 'crm' && <CrmLinksTab store={store} onSaved={load} />}
        </div>
      </div>
    </>
  )
}
