'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Store } from '@/types'

// ── constants ─────────────────────────────────────────────────────────────────

const GANTT_MONTHS = 16   // total window width in months
const GANTT_PRE   = 3    // months before today at window start
const NAME_W      = 220  // px, sticky store name column

// Row heights (px)
const DATE_AXIS_H  = 32  // date ticks header
const COL_HDR_H    = 34  // column name header
const DATA_ROW_H   = 40  // data cells row
const BAR_ROW_H    = 6   // timeline bar strip

// ── helpers ───────────────────────────────────────────────────────────────────

function parseDate(s: string | null): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function formatDate(s: string | null, short = false): string {
  if (!s) return '—'
  const d = parseDate(s)
  if (!d) return '—'
  if (short) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(s: string | null): number | null {
  const d = parseDate(s)
  if (!d) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function storeUrgency(store: Store): 'ended' | 'closing-soon' | 'launching-soon' | 'active' | 'inactive' | 'future' {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const launch   = parseDate(store.launch_date)
  const takedown = parseDate(store.takedown_date)
  if (takedown && takedown < today) return 'ended'
  if (takedown) { const d = daysUntil(store.takedown_date); if (d !== null && d <= 30) return 'closing-soon' }
  if (launch && launch > today) {
    const d = daysUntil(store.launch_date)
    return (d !== null && d <= 30) ? 'launching-soon' : 'future'
  }
  if (!store.is_active) return 'inactive'
  return 'active'
}

const URGENCY_COLOR: Record<string, string> = {
  active:           '#ddd6fe',   // very faded purple — unobtrusive for normal active stores
  'launching-soon': '#f59e0b',
  'closing-soon':   '#f97316',
  ended:            '#94a3b8',
  future:           '#60a5fa',
  inactive:         '#e2e8f0',
}

const URGENCY_LABEL: Record<string, { label: string; cls: string }> = {
  active:           { label: 'Active',          cls: 'bg-purple-100 text-purple-700' },
  'launching-soon': { label: 'Launching Soon',  cls: 'bg-amber-100 text-amber-700' },
  'closing-soon':   { label: 'Closing Soon',    cls: 'bg-orange-100 text-orange-700' },
  ended:            { label: 'Ended',           cls: 'bg-slate-100 text-slate-500' },
  future:           { label: 'Upcoming',        cls: 'bg-blue-100 text-blue-700' },
  inactive:         { label: 'Inactive',        cls: 'bg-slate-100 text-slate-500' },
}

// ── column definitions ────────────────────────────────────────────────────────

type ColKey = 'status' | 'domain' | 'manager' | 'sales_rep' | 'in_production' | 'store_types' | 'who_pays'
            | 'payment_methods' | 'freight' | 'product_types'
            | 'launch_date' | 'takedown_date' | 'last_order_at'

type SortKey = 'name' | ColKey

const URGENCY_PRIORITY: Record<string, number> = {
  'launching-soon': 0,
  'closing-soon':   1,
  active:           2,
  future:           3,
  inactive:         4,
  ended:            5,
}

function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span style={{ opacity: 0.25, fontSize: 9, marginLeft: 3 }}>⇅</span>
  return <span style={{ fontSize: 9, color: '#7c3aed', marginLeft: 3 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

interface ColDef { key: ColKey; label: string; width: number; render: (s: Store) => React.ReactNode }

const COLUMNS: ColDef[] = [
  {
    key: 'status', label: 'Status', width: 116,
    render: s => {
      const u = storeUrgency(s)
      const { label, cls } = URGENCY_LABEL[u]
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
    },
  },
  {
    key: 'domain', label: 'Domain', width: 200,
    render: s => s.domain
      ? <span className="font-mono text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full truncate max-w-full inline-block">{s.domain}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'manager', label: 'Manager', width: 140,
    render: s => s.managers?.length
      ? <span className="text-xs text-slate-700">{s.managers.join(', ')}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'sales_rep', label: 'Sales', width: 140,
    render: s => s.sales_reps?.length
      ? <span className="text-xs text-slate-700">{s.sales_reps.join(', ')}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'in_production', label: 'In Prod', width: 78,
    render: s => s.in_production
      ? <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Yes</span>
      : <span className="text-slate-300 text-xs">—</span>,
  },
  {
    key: 'store_types', label: 'Store Type', width: 130,
    render: s => s.store_types?.length
      ? <div className="flex flex-wrap gap-1">{s.store_types.map(t => <span key={t} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{t}</span>)}</div>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'who_pays', label: 'Who Pays', width: 110,
    render: s => s.who_pays?.length
      ? <span className="text-xs text-slate-600">{s.who_pays.join(', ')}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'payment_methods', label: 'Payment', width: 140,
    render: s => s.payment_methods?.length
      ? <div className="flex flex-wrap gap-1">{s.payment_methods.map(m => <span key={m} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{m}</span>)}</div>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'freight', label: 'Freight', width: 140,
    render: s => s.freight?.length
      ? <span className="text-xs text-slate-600">{s.freight.join(', ')}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'product_types', label: 'Products', width: 120,
    render: s => s.product_types?.length
      ? <div className="flex flex-wrap gap-1">{s.product_types.map(t => <span key={t} className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{t}</span>)}</div>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'launch_date', label: 'Launch', width: 96,
    render: s => s.launch_date
      ? <span className="text-xs text-slate-600">{formatDate(s.launch_date, true)}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'takedown_date', label: 'Takedown', width: 96,
    render: s => s.takedown_date
      ? <span className="text-xs text-slate-600">{formatDate(s.takedown_date, true)}</span>
      : <span className="text-slate-300">—</span>,
  },
  {
    key: 'last_order_at', label: 'Last Order', width: 100,
    render: s => s.last_order_at
      ? <span className="text-xs text-slate-600">{formatDate(s.last_order_at, true)}</span>
      : <span className="text-slate-300">—</span>,
  },
]

const DEFAULT_VISIBLE = new Set<ColKey>(['status', 'domain', 'manager', 'sales_rep', 'store_types', 'who_pays', 'payment_methods', 'freight', 'product_types', 'launch_date', 'takedown_date'])

// ── Column picker ─────────────────────────────────────────────────────────────

function ColPicker({
  visible, onChange,
}: {
  visible: Set<ColKey>
  onChange: (s: Set<ColKey>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(key: ColKey) {
    const next = new Set(visible)
    next.has(key) ? next.delete(key) : next.add(key)
    onChange(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors bg-white"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Columns
        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-semibold">{visible.size}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-2xl shadow-lg z-30 py-2">
          <p className="px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Toggle columns</p>
          {COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2.5 px-4 py-1.5 hover:bg-slate-50 cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={visible.has(col.key)}
                onChange={() => toggle(col.key)}
                className="w-3.5 h-3.5 rounded accent-purple-600"
              />
              <span className="text-sm text-slate-700">{col.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Gantt helpers ─────────────────────────────────────────────────────────────

function useTimeline() {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const windowStart = useMemo(() => {
    const d = new Date(today)
    d.setMonth(d.getMonth() - GANTT_PRE)
    d.setDate(1)
    return d
  }, [today])

  const windowEnd = useMemo(() => {
    const d = new Date(windowStart)
    d.setMonth(d.getMonth() + GANTT_MONTHS)
    return d
  }, [windowStart])

  const windowMs = windowEnd.getTime() - windowStart.getTime()

  const pct = useCallback((date: Date) =>
    Math.max(0, Math.min(100, ((date.getTime() - windowStart.getTime()) / windowMs) * 100)),
    [windowStart, windowMs])

  const todayPct = pct(today)

  const ticks = useMemo(() => {
    const arr: { label: string; pct: number; isCurrentMonth: boolean }[] = []
    const d = new Date(windowStart)
    const now = new Date()
    while (d < windowEnd) {
      arr.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        pct: ((d.getTime() - windowStart.getTime()) / windowMs) * 100,
        isCurrentMonth: d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(),
      })
      d.setMonth(d.getMonth() + 1)
    }
    return arr
  }, [windowStart, windowEnd, windowMs])

  return { today, windowStart, windowEnd, pct, todayPct, ticks }
}

function barGeometry(store: Store, pct: (d: Date) => number, windowStart: Date, windowEnd: Date) {
  const launch   = parseDate(store.launch_date)
  const takedown = parseDate(store.takedown_date)

  if (!launch && !takedown) return null

  const start = launch   ?? windowStart
  const end   = takedown ?? new Date(windowEnd.getTime() + 30 * 86400000 * 6)

  const left  = pct(start)
  const right = pct(end)
  const width = Math.max(right - left, 0.4)
  if (right < 0 || left > 100) return null

  const color = URGENCY_COLOR[storeUrgency(store)] ?? '#7c3aed'
  const openRight = !takedown

  return { left, width, color, openRight }
}

// ── Unified table: combined data + full-width timeline ────────────────────────

function StoreTable({
  stores,
  search,
  filter,
}: {
  stores: Store[]
  search: string
  filter: string
}) {
  const router = useRouter()
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_VISIBLE)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { pct, todayPct, ticks, windowStart, windowEnd } = useTimeline()

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const filtered = useMemo(() => {
    let list = stores
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(s => s.store_name.toLowerCase().includes(q) || (s.domain ?? '').toLowerCase().includes(q))
    }
    if (filter === 'production') list = list.filter(s => s.in_production)
    if (filter === 'launching') list = list.filter(s => { const d = daysUntil(s.launch_date); return d !== null && d >= 0 && d <= 30 })
    if (filter === 'closing')   list = list.filter(s => { const d = daysUntil(s.takedown_date); return d !== null && d >= 0 && d <= 30 })

    const dir = sortDir === 'asc' ? 1 : -1

    function nullsLast(a: number | null, b: number | null): number {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return (a - b) * dir
    }

    function strSort(a: string | null, b: string | null): number {
      if (!a && !b) return 0
      if (!a) return 1
      if (!b) return -1
      return a.localeCompare(b) * dir
    }

    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.store_name.localeCompare(b.store_name) * dir
        case 'status': {
          const pa = URGENCY_PRIORITY[storeUrgency(a)] ?? 99
          const pb = URGENCY_PRIORITY[storeUrgency(b)] ?? 99
          return (pa - pb) * dir
        }
        case 'domain':
          return strSort(a.domain, b.domain)
        case 'in_production':
          return ((a.in_production ? 0 : 1) - (b.in_production ? 0 : 1)) * dir
        case 'store_types':
          return strSort(a.store_types?.join(', ') || null, b.store_types?.join(', ') || null)
        case 'who_pays':
          return strSort(a.who_pays?.join(', ') || null, b.who_pays?.join(', ') || null)
        case 'payment_methods':
          return strSort(a.payment_methods?.join(', ') || null, b.payment_methods?.join(', ') || null)
        case 'freight':
          return strSort(a.freight?.join(', ') || null, b.freight?.join(', ') || null)
        case 'product_types':
          return strSort(a.product_types?.join(', ') || null, b.product_types?.join(', ') || null)
        case 'launch_date':
          return nullsLast(parseDate(a.launch_date)?.getTime() ?? null, parseDate(b.launch_date)?.getTime() ?? null)
        case 'takedown_date':
          return nullsLast(parseDate(a.takedown_date)?.getTime() ?? null, parseDate(b.takedown_date)?.getTime() ?? null)
        case 'last_order_at':
          return nullsLast(parseDate(a.last_order_at)?.getTime() ?? null, parseDate(b.last_order_at)?.getTime() ?? null)
        default:
          return a.store_name.localeCompare(b.store_name) * dir
      }
    })
  }, [stores, search, filter, sortKey, sortDir])

  const activeCols = COLUMNS.filter(c => visibleCols.has(c.key))

  // Minimum table width: name column + all active data columns, at least 1100px
  const dataColsWidth = activeCols.reduce((a, c) => a + c.width, 0)
  const minWidth = Math.max(NAME_W + dataColsWidth, 1100)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Toolbar: legend + column picker */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium flex-wrap">
          {Object.entries(URGENCY_COLOR).map(([key, color]) => (
            <span key={key} className="flex items-center gap-1">
              <span className="w-6 h-1.5 rounded-full inline-block" style={{ background: color }} />
              {URGENCY_LABEL[key].label}
            </span>
          ))}
        </div>
        <ColPicker visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-400 text-sm">No stores match your search.</div>
      ) : (
        <div className="overflow-x-auto">

          {/*
           * ── DATE AXIS ROW ──
           * Sticky to the top. Spans the full table width.
           * Month tick labels + vertical grid lines + today marker.
           */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 22,
              height: DATE_AXIS_H,
              minWidth,
              background: '#f0eff7',
              borderBottom: '2px solid #e2e8f0',
            }}
          >
            {/* Tick marks */}
            {ticks.map((t, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${t.pct}%`,
                  top: 0,
                  bottom: 0,
                  pointerEvents: 'none',
                }}
              >
                <div style={{ position: 'absolute', top: 0, bottom: 0, width: 1, background: '#ddd6fe' }} />
                <span style={{
                  position: 'absolute',
                  bottom: 5,
                  left: 5,
                  fontSize: 10,
                  fontWeight: t.isCurrentMonth ? 700 : 500,
                  color: t.isCurrentMonth ? '#7c3aed' : '#94a3b8',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                  userSelect: 'none',
                }}>
                  {t.label}
                </span>
              </div>
            ))}

            {/* Today marker */}
            <div
              style={{
                position: 'absolute',
                left: `${todayPct}%`,
                top: 0,
                bottom: 0,
                width: 2,
                background: '#7c3aed',
                zIndex: 2,
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3,
                left: 4,
                fontSize: 9,
                fontWeight: 700,
                color: '#7c3aed',
                whiteSpace: 'nowrap',
                userSelect: 'none',
                letterSpacing: '0.04em',
              }}>
                TODAY
              </span>
            </div>
          </div>

          {/*
           * ── COLUMN HEADER ROW ──
           * Sticky below the date axis. Shows column names for the data cells.
           */}
          <div
            style={{
              position: 'sticky',
              top: DATE_AXIS_H,
              zIndex: 21,
              minWidth,
              display: 'flex',
              alignItems: 'stretch',
              height: COL_HDR_H,
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            {/* Store name column header — also sticky-left */}
            <div
              onClick={() => handleSort('name')}
              style={{
                width: NAME_W,
                minWidth: NAME_W,
                flexShrink: 0,
                position: 'sticky',
                left: 0,
                zIndex: 22,
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 16,
                borderRight: '1px solid #e2e8f0',
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: sortKey === 'name' ? '#7c3aed' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Store
              </span>
              <SortIcon active={sortKey === 'name'} dir={sortDir} />
            </div>

            {/* Data column headers */}
            {activeCols.map(col => (
              <div
                key={col.key}
                onClick={() => handleSort(col.key)}
                style={{
                  width: col.width,
                  minWidth: col.width,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  borderRight: '1px solid #f1f5f9',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 600, color: sortKey === col.key ? '#7c3aed' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {col.label}
                </span>
                <SortIcon active={sortKey === col.key} dir={sortDir} />
              </div>
            ))}

            {/* Spacer to fill remaining width */}
            <div style={{ flex: 1 }} />
          </div>

          {/*
           * ── STORE ROWS ──
           * Each store = two visual lines:
           *   1. Data row  — name + column cells
           *   2. Bar row   — thin full-width timeline strip
           */}
          {filtered.map((store, idx) => {
            const bar = barGeometry(store, pct, windowStart, windowEnd)
            const isEven = idx % 2 === 0
            const rowBg  = isEven ? '#ffffff' : '#fafafa'

            return (
              <div
                key={store.id}
                onClick={() => router.push(`/stores/${store.id}`)}
                style={{ cursor: 'pointer' }}
                className="group"
              >
                {/* — Data row — */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    minWidth,
                    height: DATA_ROW_H,
                    background: rowBg,
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background 0.1s',
                  }}
                  className="group-hover:bg-purple-50/50"
                >
                  {/* Store name — sticky left */}
                  <div
                    style={{
                      width: NAME_W,
                      minWidth: NAME_W,
                      flexShrink: 0,
                      position: 'sticky',
                      left: 0,
                      zIndex: 10,
                      background: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '0 16px',
                      borderRight: '1px solid #f1f5f9',
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      className="group-hover:text-purple-800"
                    >
                      {store.store_name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: 10, color: '#94a3b8', fontFamily: 'ui-monospace, monospace' }}>
                        {store.store_id}
                      </span>
                      <a
                        href={`https://manage.promobullitstores.com/admin/v3/index.html#/store/dashboard/${store.store_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in Uducat"
                        style={{ color: '#94a3b8', lineHeight: 0, display: 'inline-flex' }}
                        className="hover:text-purple-600 transition-colors"
                      >
                        <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </a>
                      {store.domain && (
                        <a
                          href={`https://${store.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open storefront"
                          style={{ color: '#94a3b8', lineHeight: 0, display: 'inline-flex' }}
                          className="hover:text-purple-600 transition-colors"
                        >
                          <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Data column cells */}
                  {activeCols.map(col => (
                    <div
                      key={col.key}
                      style={{
                        width: col.width,
                        minWidth: col.width,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 12px',
                        borderRight: '1px solid #f8fafc',
                        overflow: 'hidden',
                      }}
                    >
                      {col.render(store)}
                    </div>
                  ))}

                  {/* Spacer + arrow */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 12 }}>
                    <svg
                      className="w-3.5 h-3.5 text-purple-300 opacity-0 group-hover:opacity-100 transition-opacity"
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* — Timeline bar row — full table width — */}
                <div
                  style={{
                    position: 'relative',
                    height: BAR_ROW_H,
                    minWidth,
                    background: rowBg,
                    borderBottom: idx < filtered.length - 1 ? '1px solid #f1f5f9' : 'none',
                  }}
                >
                  {/* Month grid lines */}
                  {ticks.map((t, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        left: `${t.pct}%`,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: '#ede9fe',
                        pointerEvents: 'none',
                      }}
                    />
                  ))}

                  {/* Today line */}
                  <div
                    style={{
                      position: 'absolute',
                      left: `${todayPct}%`,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      background: '#c4b5fd',
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Store's timeline bar */}
                  {bar ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${bar.left}%`,
                        width: `${bar.width}%`,
                        top: 2,
                        height: 2,
                        background: bar.color,
                        borderRadius: bar.openRight ? '3px 0 0 3px' : 3,
                        opacity: 0.85,
                        zIndex: 3,
                        pointerEvents: 'none',
                      }}
                      title={`${store.store_name}: ${formatDate(store.launch_date)} → ${formatDate(store.takedown_date)}`}
                    />
                  ) : (
                    /* No dates: faint dotted line */
                    <div
                      style={{
                        position: 'absolute',
                        left: '3%',
                        right: '3%',
                        top: '50%',
                        height: 1,
                        borderTop: '1px dashed #e2e8f0',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function StoresDashboardPage() {
  const [stores, setStores]   = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'production' | 'launching' | 'closing'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch('/api/stores')
    const data = await res.json()
    setLoading(false)
    if (Array.isArray(data)) setStores(data)
    else setError(data.error ?? 'Failed to load stores')
  }, [])

  useEffect(() => { load() }, [load])

  const stats = useMemo(() => ({
    active:    stores.filter(s => s.is_active).length,
    inProd:    stores.filter(s => s.in_production).length,
    launching: stores.filter(s => { const d = daysUntil(s.launch_date);   return d !== null && d >= 0 && d <= 30 }).length,
    closing:   stores.filter(s => { const d = daysUntil(s.takedown_date); return d !== null && d >= 0 && d <= 30 }).length,
  }), [stores])

  return (
    <>
      <style>{`
        .stores-page { padding: 22px 28px 28px; }
        .stat-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 20px; cursor: pointer; text-align: left; transition: all 0.15s; }
        .stat-card:hover { border-color: #cbd5e1; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
        .stat-val { font-size: 26px; font-weight: 700; color: #1e293b; line-height: 1; }
        .stat-lbl { font-size: 11px; color: #94a3b8; margin-top: 4px; font-weight: 500; }
      `}</style>

      <div className="stores-page">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stores</h1>
            <p className="text-sm text-slate-500 mt-0.5">{stores.length} stores</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {([
            { key: 'all',        val: stats.active,    label: 'Active Stores',       color: '' },
            { key: 'production', val: stats.inProd,    label: 'In Production',       color: 'text-purple-700' },
            { key: 'launching',  val: stats.launching, label: 'Launching ≤ 30 days', color: 'text-amber-600' },
            { key: 'closing',    val: stats.closing,   label: 'Closing ≤ 30 days',   color: 'text-orange-500' },
          ] as const).map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(f => f === s.key ? 'all' : s.key)}
              className={`stat-card ${filter === s.key ? 'ring-2 ring-purple-500' : ''}`}
            >
              <div className={`stat-val ${s.color}`}>{s.val}</div>
              <div className="stat-lbl">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search stores…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
        </div>

        {/* Table */}
        {loading && <LoadingSkeleton />}
        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{error}</div>}
        {!loading && !error && <StoreTable stores={stores} search={search} filter={filter} />}
      </div>
    </>
  )
}

function LoadingSkeleton() {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} className="px-5 py-3.5 animate-pulse flex items-center gap-4">
          <div className="shrink-0" style={{ width: NAME_W }}>
            <div className="h-4 bg-slate-100 rounded w-3/4 mb-1" />
            <div className="h-3 bg-slate-100 rounded w-1/3" />
          </div>
          <div className="flex-1 h-2 bg-slate-100 rounded-full" />
        </div>
      ))}
    </div>
  )
}
