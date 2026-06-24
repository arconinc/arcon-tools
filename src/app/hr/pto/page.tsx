'use client'

import { useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PtoRequest, PTO_REASON_LABELS } from '@/types'
import { DataTable, type DataTableColumn, FilterPillGroup, type FilterPillOption } from '@/components/ui'

type PtoFilter = 'all' | PtoRequest['status']
type PtoRequestWithReviewer = PtoRequest & { reviewer?: { display_name: string } | null }

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(day))
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function dayCount(request: Pick<PtoRequest, 'start_date' | 'end_date' | 'start_half_day' | 'end_half_day'>) {
  const start = new Date(`${request.start_date}T00:00:00`)
  const end = new Date(`${request.end_date}T00:00:00`)
  const raw = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
  const startHalf = request.start_half_day ? 0.5 : 0
  const endHalf = request.end_half_day ? 0.5 : 0
  return Math.max(raw - startHalf - (request.end_date === request.start_date ? 0 : endHalf), 0.5)
}

function formatDays(days: number) {
  return Number.isInteger(days) ? `${days}` : days.toFixed(1)
}

function Icon({ type, className = 'h-5 w-5' }: {
  type: 'calendar' | 'clock' | 'check' | 'plane' | 'x' | 'search' | 'circles'
  className?: string
}) {
  const props = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, 'aria-hidden': true as const }
  if (type === 'clock')   return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
  if (type === 'check')   return <svg {...props}><path d="M20 6 9 17l-5-5" /></svg>
  if (type === 'plane')   return <svg {...props}><path d="M21 16 3 21l5-9-5-9 18 5-8 4 8 4Z" /><path d="m8 12 5 0" /></svg>
  if (type === 'x')       return <svg {...props}><path d="M18 6 6 18M6 6l12 12" /></svg>
  if (type === 'search')  return <svg {...props}><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
  if (type === 'circles') return <svg {...props}><circle cx="8" cy="12" r="4" /><circle cx="16" cy="12" r="4" /></svg>
  return <svg {...props}><path d="M8 2v4M16 2v4" /><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /></svg>
}

function StatusBadge({ status }: { status: PtoRequest['status'] }) {
  const cfg: Record<PtoRequest['status'], { cls: string; label: string }> = {
    pending:  { cls: 'bg-amber-50 text-amber-700 border-amber-200',  label: 'Pending' },
    approved: { cls: 'bg-green-50  text-green-700  border-green-200', label: 'Approved' },
    denied:   { cls: 'bg-red-50    text-red-700    border-red-200',   label: 'Denied' },
  }
  const { cls, label } = cfg[status]
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  )
}

export default function PtoRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<PtoRequestWithReviewer[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [filter, setFilter] = useState<PtoFilter>('all')
  const [query, setQuery] = useState('')
  const [year, setYear] = useState(String(new Date().getFullYear()))

  useEffect(() => {
    fetch('/api/hr/pto')
      .then(r => r.json())
      .then(d => setRequests(d.requests ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const years = useMemo(() => {
    const requestYears = requests.flatMap(r => [r.start_date.slice(0, 4), r.end_date.slice(0, 4)])
    return Array.from(new Set([String(new Date().getFullYear()), ...requestYears])).sort((a, b) => Number(b) - Number(a))
  }, [requests])

  const filteredRequests = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return requests.filter(r => {
      const matchesFilter = filter === 'all' || r.status === filter
      const matchesYear = r.start_date.startsWith(year) || r.end_date.startsWith(year)
      const haystack = [PTO_REASON_LABELS[r.reason], r.notes ?? '', r.reviewer?.display_name ?? '', r.status, r.reviewer_comment ?? ''].join(' ').toLowerCase()
      return matchesFilter && matchesYear && (!normalized || haystack.includes(normalized))
    })
  }, [filter, query, requests, year])

  const summary = useMemo(() => {
    const currentYear = String(new Date().getFullYear())
    const today = new Date().toISOString().slice(0, 10)
    const pending = requests.filter(r => r.status === 'pending').length
    const approvedYtd = requests
      .filter(r => r.status === 'approved' && r.start_date.startsWith(currentYear))
      .reduce((sum, r) => sum + dayCount(r), 0)
    const next = requests
      .filter(r => r.status === 'approved' && r.start_date >= today)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
    return { pending, approvedYtd, next }
  }, [requests])

  const counts = useMemo(() => {
    const inYear = requests.filter(r => r.start_date.startsWith(year) || r.end_date.startsWith(year))
    return {
      all:      inYear.length,
      pending:  inYear.filter(r => r.status === 'pending').length,
      approved: inYear.filter(r => r.status === 'approved').length,
      denied:   inYear.filter(r => r.status === 'denied').length,
    }
  }, [requests, year])

  const filterOptions: FilterPillOption<PtoFilter>[] = useMemo(() => [
    { value: 'all',      label: 'All',      icon: <Icon type="circles" />, color: 'purple', count: counts.all },
    { value: 'pending',  label: 'Pending',  icon: <Icon type="clock" />,   color: 'amber',  count: counts.pending },
    { value: 'approved', label: 'Approved', icon: <Icon type="check" />,   color: 'green',  count: counts.approved },
    { value: 'denied',   label: 'Denied',   icon: <Icon type="x" />,       color: 'red',    count: counts.denied },
  ], [counts])

  async function handleDelete(request: PtoRequestWithReviewer) {
    const message = request.status === 'approved'
      ? 'Cancel this approved PTO request? This will remove the approved time off.'
      : 'Delete this PTO request?'
    if (!confirm(message)) return
    setDeletingId(request.id)
    try {
      const res = await fetch(`/api/hr/pto/${request.id}`, { method: 'DELETE' })
      if (res.ok) {
        setRequests(prev => prev.filter(r => r.id !== request.id))
      } else {
        const data = await res.json()
        alert(data.error ?? 'Failed to delete')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const columns: DataTableColumn<PtoRequestWithReviewer>[] = [
    {
      key: 'dates',
      header: 'Dates',
      sortValue: (r) => r.start_date,
      render: (r) => (
        <div className="flex items-center gap-3">
          <Icon type="calendar" className="h-5 w-5 shrink-0 text-purple-400" />
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
        </div>
      ),
      skeletonWidth: '70%',
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
          {r.status === 'denied' && r.reviewer_comment && (
            <div className="mt-1 text-xs text-red-600">{r.reviewer_comment}</div>
          )}
        </div>
      ),
    },
    {
      key: 'reviewer',
      header: 'Reviewed By',
      sortValue: (r) => r.reviewer?.display_name ?? '',
      render: (r) => r.reviewer?.display_name ? (
        <div>
          <div className="font-semibold text-slate-900">{r.reviewer.display_name}</div>
          {r.reviewed_at && <div className="mt-0.5 text-xs text-slate-500">{formatDate(r.reviewed_at.slice(0, 10))}</div>}
        </div>
      ) : (
        <span className="text-xs text-slate-400">Not reviewed yet</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center gap-2 flex-wrap">
          {r.status === 'denied' && (
            <button
              type="button"
              onClick={() => router.push(`/hr/pto/edit/${r.id}`)}
              className="inline-flex items-center rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-xs font-bold text-purple-700 transition-colors hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              Edit &amp; Resubmit
            </button>
          )}
          <button
            type="button"
            disabled={deletingId === r.id}
            onClick={() => handleDelete(r)}
            title={r.status === 'approved' ? 'Cancel this approved time off request' : 'Delete this PTO request'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon type="x" className="h-3 w-3" />
            {deletingId === r.id ? 'Deleting…' : r.status === 'approved' ? 'Cancel' : 'Delete'}
          </button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-[1440px] px-8 py-9">

      {/* Header */}
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-slate-900" style={{ textWrap: 'balance' }}>
            My PTO Requests
          </h1>
          <p className="mt-2 text-sm text-slate-500">View and manage your time off requests and approval status.</p>
        </div>
        <Link
          href="/hr/pto/new"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-purple-800 bg-gradient-to-b from-purple-600 to-purple-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-1 sm:self-start"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span>
          Request Time Off
        </Link>
      </header>

      {/* Stat cards */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="PTO request summary">
        {[
          {
            icon: 'calendar' as const,
            label: 'Total Requests',
            value: requests.length,
            note: 'Across your request history',
          },
          {
            icon: 'clock' as const,
            label: 'Pending Requests',
            value: summary.pending,
            note: summary.pending === 0 ? 'No requests pending approval' : 'Awaiting HR review',
          },
          {
            icon: 'check' as const,
            label: 'Approved YTD',
            value: `${formatDays(summary.approvedYtd)}`,
            valueSuffix: 'days',
            note: 'Approved requests this year',
          },
          {
            icon: 'plane' as const,
            label: 'Next Time Off',
            value: summary.next ? formatDate(summary.next.start_date).replace(`, ${new Date().getFullYear()}`, '') : 'None',
            note: summary.next ? PTO_REASON_LABELS[summary.next.reason] : 'No approved upcoming PTO',
            smallValue: !!summary.next,
          },
        ].map(({ icon, label, value, valueSuffix, note, smallValue }) => (
          <div key={label} className="flex min-h-[112px] items-center gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-50 to-purple-100 text-purple-700">
              <Icon type={icon} className="h-[26px] w-[26px]" />
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
              <div className={`mt-2 font-extrabold leading-none text-purple-700 ${smallValue ? 'text-[1.35rem]' : 'text-[1.55rem]'}`}>
                {value}
                {valueSuffix && <span className="ml-1 text-[0.82rem] font-medium text-slate-900">{valueSuffix}</span>}
              </div>
              <div className="mt-2 text-xs leading-snug text-slate-500">{note}</div>
            </div>
          </div>
        ))}
      </section>

      {/* Table section */}
      <section aria-label="PTO requests">

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
                placeholder="Search requests…"
                aria-label="Search PTO requests"
                className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
          </div>
        </div>

        {/* No requests at all — elaborate empty with CTA */}
        {!loading && requests.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-purple-200 bg-purple-50/30 px-6 py-16 text-center">
            <p className="text-base font-bold text-slate-900">No PTO requests yet</p>
            <p className="mx-auto mt-2 mb-6 max-w-[48ch] text-sm leading-relaxed text-slate-500">
              When you submit a request, it will appear here with review status and any HR notes.
            </p>
            <Link
              href="/hr/pto/new"
              className="inline-flex items-center gap-2 rounded-lg border border-purple-800 bg-gradient-to-b from-purple-600 to-purple-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:from-purple-700 hover:to-purple-800"
            >
              <span aria-hidden="true" className="text-lg leading-none">+</span>
              Request Time Off
            </Link>
          </div>
        ) : (
          <DataTable
            rows={filteredRequests}
            columns={columns}
            loading={loading}
            emptyMessage="No requests match these filters. Try a different status, year, or search term."
            getRowKey={r => r.id}
            minWidth="860px"
          />
        )}

        {!loading && requests.length > 0 && (
          <p className="mt-2 text-right text-xs text-slate-400">
            Showing {filteredRequests.length} of {requests.length} requests · {year}
          </p>
        )}
      </section>
    </div>
  )
}
