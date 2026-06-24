'use client'

import { useMemo, useState, useEffect } from 'react'
import { PtoRequest, PTO_REASON_LABELS } from '@/types'
import { DataTable, type DataTableColumn, FilterPillGroup, type FilterPillOption } from '@/components/ui'

type Filter = 'all' | PtoRequest['status']
type RequestWithUser = PtoRequest & { users?: { display_name: string; email: string; avatar_url: string | null } }

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(day))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dayCount(request: Pick<PtoRequest, 'start_date' | 'end_date' | 'start_half_day' | 'end_half_day'>) {
  const start = new Date(`${request.start_date}T00:00:00`)
  const end = new Date(`${request.end_date}T00:00:00`)
  const raw = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  return Math.max(raw - (request.start_half_day ? 0.5 : 0) - (request.end_half_day && request.end_date !== request.start_date ? 0.5 : 0), 0.5)
}

function formatDays(days: number) {
  return Number.isInteger(days) ? `${days}` : days.toFixed(1)
}

function Icon({ type, className = 'h-5 w-5' }: {
  type: 'clock' | 'check' | 'x' | 'people' | 'search' | 'circles'
  className?: string
}) {
  const props = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, 'aria-hidden': true as const }
  if (type === 'check')   return <svg {...props}><path d="M20 6 9 17l-5-5" /></svg>
  if (type === 'x')       return <svg {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>
  if (type === 'search')  return <svg {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
  if (type === 'circles') return <svg {...props}><circle cx="8" cy="12" r="4" /><circle cx="16" cy="12" r="4" /></svg>
  if (type === 'people')  return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
}

function Avatar({ user }: { user?: { display_name: string; avatar_url?: string | null } }) {
  if (user?.avatar_url) {
    return <img src={user.avatar_url} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full object-cover" />
  }
  const initials = (user?.display_name ?? '?').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-700 text-xs font-bold text-white">
      {initials}
    </div>
  )
}

function StatusBadge({ status }: { status: PtoRequest['status'] }) {
  const cfg: Record<PtoRequest['status'], { cls: string; label: string }> = {
    pending:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'Pending' },
    approved: { cls: 'bg-green-50  text-green-700  border-green-200', label: 'Approved' },
    denied:   { cls: 'bg-red-50    text-red-700    border-red-200',   label: 'Denied' },
  }
  const { cls, label } = cfg[status]
  return <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${cls}`}>{label}</span>
}

export default function HrPtoRequestsPage() {
  const [requests, setRequests] = useState<RequestWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('pending')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const [modal, setModal] = useState<{ id: string; action: 'approve' | 'deny'; title: string } | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hr/pto/review')
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const years = useMemo(() => {
    const requestYears = requests.flatMap(r => [r.start_date.slice(0, 4), r.end_date.slice(0, 4)])
    return Array.from(new Set([String(new Date().getFullYear()), ...requestYears])).sort((a, b) => Number(b) - Number(a))
  }, [requests])

  const counts = useMemo(() => ({
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    denied:   requests.filter(r => r.status === 'denied').length,
  }), [requests])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return requests.filter(r => {
      const user = r.users
      const haystack = [user?.display_name ?? '', user?.email ?? '', PTO_REASON_LABELS[r.reason], r.notes ?? '', r.status, r.reviewer_comment ?? ''].join(' ').toLowerCase()
      return (filter === 'all' || r.status === filter)
        && (r.start_date.startsWith(year) || r.end_date.startsWith(year))
        && (!normalized || haystack.includes(normalized))
    })
  }, [filter, query, requests, year])

  const filterOptions: FilterPillOption<Filter>[] = useMemo(() => [
    { value: 'pending',  label: 'Pending',  icon: <Icon type="clock" />,   color: 'amber',  count: counts.pending },
    { value: 'all',      label: 'All',      icon: <Icon type="circles" />, color: 'purple', count: counts.all },
    { value: 'approved', label: 'Approved', icon: <Icon type="check" />,   color: 'green',  count: counts.approved },
    { value: 'denied',   label: 'Denied',   icon: <Icon type="x" />,       color: 'red',    count: counts.denied },
  ], [counts])

  function openModal(id: string, action: 'approve' | 'deny', name: string) {
    setModal({ id, action, title: name })
    setComment('')
    setModalError(null)
  }

  async function submitReview() {
    if (!modal) return
    if (modal.action === 'deny' && !comment.trim()) {
      setModalError('A comment is required when denying a request.')
      return
    }
    setSubmitting(true)
    setModalError(null)
    try {
      const res = await fetch(`/api/hr/pto/review/${modal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: modal.action, reviewer_comment: comment.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setModalError(data.error ?? 'Failed to save review'); return }
      setRequests(prev => prev.map(r => r.id === modal.id ? { ...r, ...data.request } : r))
      setModal(null)
    } finally {
      setSubmitting(false)
    }
  }

  const columns: DataTableColumn<RequestWithUser>[] = [
    {
      key: 'employee',
      header: 'Employee',
      sortValue: (r) => r.users?.display_name ?? '',
      render: (r) => (
        <div className="flex items-center gap-3">
          <Avatar user={r.users} />
          <div>
            <div className="font-semibold text-slate-900">{r.users?.display_name ?? 'Unknown Employee'}</div>
            <div className="mt-0.5 text-xs text-slate-500">{r.users?.email ?? 'No email available'}</div>
          </div>
        </div>
      ),
      skeletonWidth: '70%',
    },
    {
      key: 'dates',
      header: 'Dates',
      sortValue: (r) => r.start_date,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">
            {formatDate(r.start_date)}{r.start_date !== r.end_date ? ` – ${formatDate(r.end_date)}` : ''}
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {formatDays(dayCount(r))} {dayCount(r) === 1 ? 'day' : 'days'}
            {r.start_half_day && ' · half day start'}
            {r.end_half_day && r.end_date !== r.start_date && ' · half day end'}
          </div>
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      sortValue: (r) => PTO_REASON_LABELS[r.reason],
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900">{PTO_REASON_LABELS[r.reason]}</div>
          {r.notes && <div className="mt-0.5 text-xs text-slate-500">{r.notes}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      render: (r) => (
        <div>
          <StatusBadge status={r.status} />
          {r.reviewer_comment && <div className="mt-1 text-xs text-slate-500">{r.reviewer_comment}</div>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => r.status === 'pending' ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openModal(r.id, 'approve', r.users?.display_name ?? 'this employee')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-bold text-green-700 transition-colors hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-300"
          >
            <Icon type="check" className="h-3 w-3" />
            Approve
          </button>
          <button
            type="button"
            onClick={() => openModal(r.id, 'deny', r.users?.display_name ?? 'this employee')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            <Icon type="x" className="h-3 w-3" />
            Deny
          </button>
        </div>
      ) : (
        <span className="text-xs text-slate-400">No action needed</span>
      ),
    },
  ]

  return (
    <>
      <div className="mx-auto max-w-[1440px] px-8 py-9">

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>
            Review PTO Requests
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Review employee time off requests, approve clean submissions, and leave clear denial notes when needed.
          </p>
        </header>

        {/* Stat cards */}
        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="PTO review summary">
          {[
            { icon: 'clock'   as const, label: 'Pending Requests', value: counts.pending,  note: 'Awaiting HR review' },
            { icon: 'check'   as const, label: 'Approved',          value: counts.approved, note: 'Approved request history' },
            { icon: 'x'       as const, label: 'Denied',            value: counts.denied,   note: 'Returned with comments' },
            { icon: 'people'  as const, label: 'Total Requests',    value: counts.all,      note: 'All visible PTO requests' },
          ].map(({ icon, label, value, note }) => (
            <div key={label} className="flex min-h-[112px] items-center gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-50 to-purple-100 text-purple-700">
                <Icon type={icon} className="h-[26px] w-[26px]" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
                <div className="mt-2 text-[1.55rem] font-extrabold leading-none text-purple-700">{value}</div>
                <div className="mt-2 text-xs leading-snug text-slate-500">{note}</div>
              </div>
            </div>
          ))}
        </section>

        {/* Table section */}
        <section aria-label="PTO requests for review">
          {/* Toolbar */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterPillGroup
              options={filterOptions}
              value={filter}
              onChange={setFilter}
              label="Filter by status"
            />
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={year}
                onChange={e => setYear(e.target.value)}
                aria-label="Filter by year"
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <div className="relative">
                <Icon type="search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search employees or requests…"
                  aria-label="Search PTO requests"
                  className="h-[34px] min-w-[240px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
            </div>
          </div>

          <DataTable
            rows={filtered}
            columns={columns}
            loading={loading}
            emptyMessage={requests.length === 0 ? 'No PTO requests have been submitted yet.' : 'No requests match these filters.'}
            getRowKey={r => r.id}
            minWidth="980px"
          />

          {!loading && requests.length > 0 && (
            <p className="mt-2 text-right text-xs text-slate-400">
              Showing {filtered.length} of {requests.length} requests · {year}
            </p>
          )}
        </section>
      </div>

      {/* Review modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-5"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-[440px] rounded-[10px] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-base font-extrabold text-slate-900">
              {modal.action === 'approve' ? 'Approve PTO Request' : 'Deny PTO Request'}
            </h2>
            <p className="mt-2 mb-4 text-sm leading-relaxed text-slate-500">
              {modal.action === 'approve'
                ? `Approve the PTO request for ${modal.title}? They will be notified.`
                : `Deny the PTO request for ${modal.title}. A comment is required and will be visible to the employee.`}
            </p>
            <textarea
              className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              style={{ minHeight: 96 }}
              placeholder={modal.action === 'approve' ? 'Optional comment…' : 'Reason for denial (required)…'}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
            {modalError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-700">
                {modalError}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitReview}
                className={`rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
                  modal.action === 'approve'
                    ? 'bg-green-700 hover:bg-green-800 focus:ring-green-400'
                    : 'bg-red-600 hover:bg-red-700 focus:ring-red-400'
                }`}
              >
                {submitting ? 'Saving…' : modal.action === 'approve' ? 'Approve' : 'Deny'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
