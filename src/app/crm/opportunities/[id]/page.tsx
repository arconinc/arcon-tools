'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type DropdownUser = { id: string; display_name: string; email: string }
type DropdownCustomer = { id: string; name: string }

type OppStatus = 'open' | 'won' | 'lost' | 'stalled'
type PipelineStage = 'Send Quote' | 'Follow Up on Quote' | 'Quote Accepted' | 'Send Thank You Email'
type OppCategory = 'Apparel' | 'Packaging Product' | 'Print Product' | 'Promotional Product' | 'Signage' | 'Store/Ecommerce Build'

type OppDetail = {
  id: string
  name: string
  customer_id: string
  assigned_to: string | null
  pipeline_stage: PipelineStage | null
  value: number | null
  probability: number | null
  status: OppStatus
  status_reason: string | null
  category: OppCategory | null
  forecast_close_date: string | null
  description: string | null
  closed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  customer: { id: string; name: string } | null
  assigned_user: { id: string; display_name: string; email: string } | null
  tasks: {
    id: string; title: string; status: string; priority: string
    due_date: string | null; category: string | null
  }[]
  stage_history: {
    id: string
    pipeline_stage: string | null
    status: string | null
    value: number | null
    probability: number | null
    forecast_close_date: string | null
    changed_by: string
    changed_by_name: string | null
    changed_at: string
  }[]
  files: { id: string; label: string; url: string; created_at: string }[]
}

type CreateForm = {
  name: string
  customer_id: string
  customer_name: string
  assigned_to: string
  pipeline_stage: string
  value: string
  probability: string
  status: string
  category: string
  forecast_close_date: string
  description: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES: PipelineStage[] = [
  'Send Quote',
  'Follow Up on Quote',
  'Quote Accepted',
  'Send Thank You Email',
]

const CATEGORIES: OppCategory[] = [
  'Apparel', 'Packaging Product', 'Print Product',
  'Promotional Product', 'Signage', 'Store/Ecommerce Build',
]

const STATUS_BADGE: Record<OppStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-700',
  stalled: 'bg-slate-100 text-slate-600',
}

const TASK_STATUS_BADGE: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  waiting_on_approval: 'bg-yellow-100 text-yellow-700',
  waiting_on_client_approval: 'bg-orange-100 text-orange-700',
  need_changes: 'bg-red-100 text-red-600',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(val: number | null) {
  if (val == null) return '—'
  return '$' + val.toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

function FieldInput({
  label, name, value, onChange, type = 'text', textarea = false, children,
}: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void
  type?: string; textarea?: boolean; children?: React.ReactNode
}) {
  const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {children ?? (
        textarea
          ? <textarea rows={3} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls + ' resize-none'} />
          : <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls} />
      )}
    </div>
  )
}

// ── Pipeline Bar ──────────────────────────────────────────────────────────────

function PipelineBar({
  currentStage,
  status,
  onStageClick,
  onClose,
  disabled,
}: {
  currentStage: PipelineStage | null
  status: OppStatus
  onStageClick: (stage: PipelineStage) => void
  onClose: (result: 'won' | 'lost') => void
  disabled: boolean
}) {
  const isClosed = status === 'won' || status === 'lost'
  const currentIdx = currentStage ? STAGES.indexOf(currentStage) : -1

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-slate-700">Pipeline Stage</span>
        {isClosed && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[status]}`}>
            {status === 'won' ? '🏆 Won' : '❌ Lost'}
          </span>
        )}
      </div>

      {/* Stage steps */}
      <div className="flex items-center gap-0 mb-4">
        {STAGES.map((stage, idx) => {
          const isActive = stage === currentStage
          const isPast = currentIdx > idx
          const isClickable = !disabled && !isClosed

          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => isClickable && onStageClick(stage)}
                disabled={!isClickable}
                title={stage}
                className={[
                  'flex-1 px-2 py-2 text-xs font-medium text-center transition-colors rounded-none first:rounded-l-xl last:rounded-r-xl border',
                  isActive
                    ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                    : isPast
                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200',
                  isClickable && !isActive ? 'hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 cursor-pointer' : '',
                  disabled ? 'cursor-default' : '',
                ].join(' ')}
              >
                <span className="block truncate">{stage}</span>
              </button>
              {idx < STAGES.length - 1 && (
                <div className={`w-0 h-0 border-t-[16px] border-b-[16px] border-l-[10px] border-t-transparent border-b-transparent z-10 -mx-0.5 flex-shrink-0 ${
                  isPast || isActive ? 'border-l-purple-200' : 'border-l-slate-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Close Won / Close Lost */}
      {!isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => !disabled && onClose('won')}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            🏆 Close Won
          </button>
          <button
            onClick={() => !disabled && onClose('lost')}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            ❌ Close Lost
          </button>
        </div>
      )}
      {isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => !disabled && onClose('won')}
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Re-open as Open
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OpportunityDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params.id
  const isNew = id === 'new'

  const [opp, setOpp] = useState<OppDetail | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)

  // Dropdown data
  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [customers, setCustomers] = useState<DropdownCustomer[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/users').then((r) => r.json()),
      fetch('/api/crm/customers').then((r) => r.json()),
    ]).then(([users, custs]) => {
      if (Array.isArray(users)) setCrmUsers(users)
      if (Array.isArray(custs)) setCustomers(custs)
    })
  }, [])
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'activity'>('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<OppDetail>>({})
  const [saving, setSaving] = useState(false)
  const [stageSaving, setStageSaving] = useState(false)

  // Create form
  const prefillCustomerId = searchParams.get('customer_id') ?? ''
  const prefillCustomerName = searchParams.get('customer_name') ?? ''
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: '',
    customer_id: prefillCustomerId,
    customer_name: prefillCustomerName,
    assigned_to: '',
    pipeline_stage: '',
    value: '',
    probability: '',
    status: 'open',
    category: '',
    forecast_close_date: '',
    description: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/crm/opportunities/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return }
        setOpp(data)
      })
      .catch(() => setError('Failed to load opportunity'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  function startEdit() {
    if (!opp) return
    setEditForm({ ...opp })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditForm({})
  }

  function handleEditChange(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value === '' ? null : value }))
  }

  async function saveEdit() {
    if (!opp) return
    setSaving(true)
    try {
      const payload = { ...editForm }
      // Convert numeric strings to numbers
      if (typeof payload.value === 'string') payload.value = payload.value ? Number(payload.value) : null as any
      if (typeof payload.probability === 'string') payload.probability = payload.probability ? Number(payload.probability) : null as any
      const res = await fetch(`/api/crm/opportunities/${opp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      setOpp((prev) => prev ? { ...prev, ...data } : prev)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleStageClick(stage: PipelineStage) {
    if (!opp || stageSaving) return
    setStageSaving(true)
    try {
      const res = await fetch(`/api/crm/opportunities/${opp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pipeline_stage: stage }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Update failed'); return }
      // Refresh full detail to get new history
      const full = await fetch(`/api/crm/opportunities/${opp.id}`).then((r) => r.json())
      if (!full.error) setOpp(full)
    } finally {
      setStageSaving(false)
    }
  }

  async function handleClose(result: 'won' | 'lost') {
    if (!opp || stageSaving) return
    const newStatus = opp.status === 'won' || opp.status === 'lost' ? 'open' : result
    setStageSaving(true)
    try {
      const res = await fetch(`/api/crm/opportunities/${opp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Update failed'); return }
      const full = await fetch(`/api/crm/opportunities/${opp.id}`).then((r) => r.json())
      if (!full.error) setOpp(full)
    } finally {
      setStageSaving(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.name.trim()) { setCreateError('Name is required'); return }
    if (!createForm.customer_id.trim()) { setCreateError('Customer is required'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/crm/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          customer_id: createForm.customer_id.trim(),
          assigned_to: createForm.assigned_to || null,
          pipeline_stage: createForm.pipeline_stage || null,
          value: createForm.value ? Number(createForm.value) : null,
          probability: createForm.probability ? Number(createForm.probability) : null,
          status: createForm.status || 'open',
          category: createForm.category || null,
          forecast_close_date: createForm.forecast_close_date || null,
          description: createForm.description || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      router.push(`/crm/opportunities/${data.id}`)
    } finally {
      setCreating(false)
    }
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (isNew) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/crm/opportunities" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Opportunities
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">New Opportunity</h1>
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Opportunity Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={createForm.name} required
              onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select value={createForm.customer_id} required
              onChange={(e) => setCreateForm((p) => ({ ...p, customer_id: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">— Select Customer —</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pipeline Stage</label>
              <select value={createForm.pipeline_stage}
                onChange={(e) => setCreateForm((p) => ({ ...p, pipeline_stage: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="">— Select —</option>
                {STAGES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</label>
              <select value={createForm.category}
                onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="">— Select —</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Value ($)</label>
              <input type="number" min="0" step="0.01" value={createForm.value}
                onChange={(e) => setCreateForm((p) => ({ ...p, value: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Probability (%)</label>
              <input type="number" min="0" max="100" value={createForm.probability}
                onChange={(e) => setCreateForm((p) => ({ ...p, probability: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Forecast Close Date</label>
            <input type="date" value={createForm.forecast_close_date}
              onChange={(e) => setCreateForm((p) => ({ ...p, forecast_close_date: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
            <select value={createForm.assigned_to ?? ''}
              onChange={(e) => setCreateForm((p) => ({ ...p, assigned_to: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">— Unassigned —</option>
              {crmUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
            <textarea rows={3} value={createForm.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Opportunity'}
            </button>
            <Link href="/crm/opportunities" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-100 rounded w-32" />
          <div className="h-20 bg-slate-100 rounded-2xl" />
          <div className="h-32 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !opp) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/crm/opportunities" className="text-sm text-slate-500 hover:text-slate-700">← Opportunities</Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error ?? 'Opportunity not found'}
        </div>
      </div>
    )
  }

  const isClosed = opp.status === 'won' || opp.status === 'lost'
  const ef = editForm as Partial<OppDetail>

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href="/crm/opportunities" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Opportunities
      </Link>

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{opp.name}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[opp.status]}`}>
                {opp.status}
              </span>
              {opp.customer && (
                <Link href={`/crm/customers/${opp.customer.id}`} className="text-sm text-purple-700 hover:underline font-medium">
                  {opp.customer.name}
                </Link>
              )}
              {opp.value != null && (
                <span className="text-sm font-bold text-slate-800">{fmt$(opp.value)}</span>
              )}
              {opp.probability != null && (
                <span className="text-sm text-slate-500">{opp.probability}% probability</span>
              )}
              {opp.assigned_user && (
                <span className="text-sm text-slate-500">
                  Owner: <span className="font-medium text-slate-700">{opp.assigned_user.display_name}</span>
                </span>
              )}
            </div>
            {opp.forecast_close_date && (
              <div className="mt-2 text-sm text-slate-500">
                Forecast close: <span className={isClosed ? 'text-slate-700' : new Date(opp.forecast_close_date) < new Date() ? 'text-red-600 font-medium' : 'text-slate-700'}>
                  {fmtDate(opp.forecast_close_date)}
                </span>
                {opp.closed_at && <span className="ml-3 text-slate-400">Closed: {fmtDate(opp.closed_at)}</span>}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pipeline bar */}
      <PipelineBar
        currentStage={opp.pipeline_stage}
        status={opp.status}
        onStageClick={handleStageClick}
        onClose={handleClose}
        disabled={stageSaving}
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {(['details', 'related', 'activity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
            {tab === 'related' && (opp.tasks.length + opp.files.length + opp.stage_history.length) > 0 && (
              <span className="ml-1.5 text-xs opacity-70">
                {opp.tasks.length + opp.files.length + opp.stage_history.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Opportunity Details</h2>
            {!editing ? (
              <button onClick={startEdit}
                className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={saving}
                  className="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={cancelEdit}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="p-6 grid grid-cols-2 gap-5">
            {editing ? (
              <>
                <FieldInput label="Name" name="name" value={(ef.name as string) ?? ''} onChange={handleEditChange} />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Customer</label>
                  <select value={(ef.customer_id as string) ?? ''}
                    onChange={(e) => handleEditChange('customer_id', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Select Customer —</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Pipeline Stage</label>
                  <select value={(ef.pipeline_stage as string) ?? ''}
                    onChange={(e) => handleEditChange('pipeline_stage', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Select —</option>
                    {STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</label>
                  <select value={(ef.category as string) ?? ''}
                    onChange={(e) => handleEditChange('category', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Select —</option>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <FieldInput label="Value ($)" name="value" value={String(ef.value ?? '')} onChange={handleEditChange} type="number" />
                <FieldInput label="Probability (%)" name="probability" value={String(ef.probability ?? '')} onChange={handleEditChange} type="number" />
                <FieldInput label="Forecast Close Date" name="forecast_close_date" value={(ef.forecast_close_date as string)?.slice(0, 10) ?? ''} onChange={handleEditChange} type="date" />
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                  <select value={(ef.status as string) ?? 'open'}
                    onChange={(e) => handleEditChange('status', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="open">Open</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="stalled">Stalled</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <FieldInput label="Status Reason" name="status_reason" value={(ef.status_reason as string) ?? ''} onChange={handleEditChange} />
                </div>
                <div className="col-span-2">
                  <FieldInput label="Description" name="description" value={(ef.description as string) ?? ''} onChange={handleEditChange} textarea />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
                  <select value={(ef.assigned_to as string) ?? ''}
                    onChange={(e) => handleEditChange('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— Unassigned —</option>
                    {crmUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.display_name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <Field label="Customer" value={opp.customer?.name ?? opp.customer_id} />
                <Field label="Category" value={opp.category} />
                <Field label="Pipeline Stage" value={opp.pipeline_stage} />
                <Field label="Status" value={opp.status} />
                <Field label="Value" value={opp.value != null ? fmt$(opp.value) : null} />
                <Field label="Probability" value={opp.probability != null ? `${opp.probability}%` : null} />
                <Field label="Forecast Close" value={fmtDate(opp.forecast_close_date)} />
                <Field label="Closed At" value={opp.closed_at ? fmtDateTime(opp.closed_at) : null} />
                {opp.status_reason && (
                  <div className="col-span-2">
                    <Field label="Status Reason" value={opp.status_reason} />
                  </div>
                )}
                {opp.description && (
                  <div className="col-span-2">
                    <Field label="Description" value={opp.description} />
                  </div>
                )}
                <Field label="Owner" value={opp.assigned_user?.display_name ?? null} />
              </>
            )}
          </div>

          <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex gap-6 text-xs text-slate-400">
            <span>Created {fmtDate(opp.created_at)}</span>
            <span>Updated {fmtDate(opp.updated_at)}</span>
          </div>
        </div>
      )}

      {/* ── Related Tab ── */}
      {activeTab === 'related' && (
        <div className="space-y-5">
          {/* Stage History */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Stage History ({opp.stage_history.length})</h2>
            </div>
            {opp.stage_history.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">No stage changes recorded yet.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Stage</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Value</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Changed By</th>
                    <th className="text-left px-5 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {opp.stage_history.map((h) => (
                    <tr key={h.id}>
                      <td className="px-5 py-3 text-slate-700">
                        {h.pipeline_stage ? (
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium">{h.pipeline_stage}</span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-5 py-3 capitalize hidden md:table-cell">
                        {h.status && (
                          <span className={`inline-flex px-2 py-0.5 rounded font-semibold capitalize ${STATUS_BADGE[h.status as OppStatus] ?? 'bg-slate-100 text-slate-600'}`}>
                            {h.status}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-slate-600 hidden lg:table-cell">{fmt$(h.value)}</td>
                      <td className="px-5 py-3 text-slate-600">{h.changed_by_name ?? '—'}</td>
                      <td className="px-5 py-3 text-slate-400">{fmtDateTime(h.changed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Tasks */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Open Tasks ({opp.tasks.length})</h2>
              <button onClick={() => router.push(`/crm/tasks/new?opportunity_id=${opp.id}`)}
                className="text-xs font-semibold text-purple-700 hover:text-purple-900">
                + Add Task
              </button>
            </div>
            {opp.tasks.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">No open tasks linked to this opportunity.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {opp.tasks.map((t) => (
                  <div key={t.id} onClick={() => router.push(`/crm/tasks/${t.id}`)}
                    className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{t.title}</div>
                      {t.category && <div className="text-xs text-slate-400">{t.category}</div>}
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${TASK_STATUS_BADGE[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                    {t.due_date && (
                      <span className={`text-xs whitespace-nowrap ${new Date(t.due_date) < new Date() ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                        {fmtDate(t.due_date)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Files ({opp.files.length})</h2>
            </div>
            {opp.files.length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">No files attached.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {opp.files.map((f) => (
                  <a key={f.id} href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span className="text-sm text-purple-700 hover:underline">{f.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Activity Tab ── */}
      {activeTab === 'activity' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">All Tasks</h2>
            {opp.tasks.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-4">
                No tasks linked to this opportunity.{' '}
                <button onClick={() => router.push(`/crm/tasks/new?opportunity_id=${opp.id}`)}
                  className="text-purple-700 hover:underline">
                  Create one →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {opp.tasks.map((t) => (
                  <div key={t.id} onClick={() => router.push(`/crm/tasks/${t.id}`)}
                    className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-purple-200 hover:bg-purple-50 cursor-pointer transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800">{t.title}</div>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TASK_STATUS_BADGE[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
