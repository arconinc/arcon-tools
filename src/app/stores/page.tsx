'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Store } from '@/types'
import { useAppUser } from '@/components/layout/AppShell'
import { CredentialPrompt } from '@/components/stores/CredentialPrompt'

// ── constants ─────────────────────────────────────────────────────────────────

const NAME_W     = 220  // px, sticky store name column
const COL_HDR_H  = 34   // column name header
const DATA_ROW_H = 54   // data cells row

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
  const flags = await getEvaluatedFlags()

    return (d !== null && d <= 30) ? 'launching-soon' : 'future'
  }
  if (!store.is_active) return 'inactive'
  return 'active'
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

type ColKey = 'status' | 'launch_status' | 'domain' | 'manager' | 'sales_rep' | 'in_production' | 'store_types' | 'who_pays'
            | 'payment_methods' | 'freight' | 'product_types'
            | 'launch_date' | 'takedown_date' | 'last_order_at'
            | 'orders' | 'total_sales'

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

type OrderStats = Record<string, { count: number; total: number }>

interface ColDef { key: ColKey; label: string; width: number; render: (s: Store, orderStats?: OrderStats) => React.ReactNode }

const COLUMNS: ColDef[] = [
  {
    key: 'orders', label: 'Orders', width: 80,
    render: (s, stats) => {
      const c = stats?.[s.id]?.count
      return c !== undefined
        ? <span className="text-xs font-semibold text-slate-700">{c.toLocaleString()}</span>
        : <span className="text-slate-300">—</span>
    },
  },
  {
    key: 'total_sales', label: 'Total Sales', width: 110,
    render: (s, stats) => {
      const t = stats?.[s.id]?.total
      return t !== undefined
        ? <span className="text-xs font-semibold text-slate-700">${t.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        : <span className="text-slate-300">—</span>
    },
  },
  {
    key: 'status', label: 'Status', width: 116,
    render: s => {
      const u = storeUrgency(s)
      const { label, cls } = URGENCY_LABEL[u]
      return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
    },
  },
  {
    key: 'launch_status', label: 'Launch Status', width: 180,
    render: s => {
      const u = storeUrgency(s)
      const launch   = parseDate(s.launch_date)
      const takedown = parseDate(s.takedown_date)
      const today    = new Date(); today.setHours(0, 0, 0, 0)

      const daysToLaunch   = s.launch_date   ? daysUntil(s.launch_date)   : null
      const daysToTakedown = s.takedown_date ? daysUntil(s.takedown_date) : null

      const configs: Record<string, { icon: React.ReactNode; bar: string; sub: string }> = {
        active: {
          icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 2px #bbf7d0' }} />,
          bar: 'bg-green-500',
          sub: daysToTakedown !== null ? `${daysToTakedown}d left` : 'No end date',
        },
        'launching-soon': {
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
          bar: 'bg-amber-400',
          sub: daysToLaunch !== null ? `Launches in ${daysToLaunch}d` : '',
        },
        'closing-soon': {
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
          bar: 'bg-orange-500',
          sub: daysToTakedown !== null ? `Closes in ${daysToTakedown}d` : '',
        },
        ended: {
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
          bar: 'bg-slate-300',
          sub: takedown ? `Ended ${Math.abs(daysToTakedown ?? 0)}d ago` : 'Ended',
        },
        future: {
          icon: <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
          bar: 'bg-blue-400',
          sub: daysToLaunch !== null ? `Launches in ${daysToLaunch}d` : 'No launch date',
        },
        inactive: {
          icon: <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />,
          bar: 'bg-slate-200',
          sub: 'Not active',
        },
      }

      const { label, cls } = URGENCY_LABEL[u]
      const cfg = configs[u]

      // Lifecycle progress bar (only when both dates known and store is active/closing-soon)
      let progress: number | null = null
      if (launch && takedown && (u === 'active' || u === 'closing-soon')) {
        const total = takedown.getTime() - launch.getTime()
        const elapsed = today.getTime() - launch.getTime()
        progress = Math.max(0, Math.min(100, (elapsed / total) * 100))
      }

  const flags = await getEvaluatedFlags()

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {cfg.icon}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cls}`}>{label}</span>
          </div>
          {progress !== null && (
            <div style={{ height: 3, background: '#f1f5f9', borderRadius: 2, overflow: 'hidden' }}>
              <div className={cfg.bar} style={{ height: '100%', width: `${progress}%`, borderRadius: 2 }} />
            </div>
          )}
          {cfg.sub && (
            <span style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1 }}>{cfg.sub}</span>
          )}
        </div>
      )
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

const DEFAULT_VISIBLE = new Set<ColKey>(['orders', 'total_sales', 'status', 'launch_status', 'domain', 'manager', 'sales_rep', 'store_types', 'who_pays', 'payment_methods', 'freight', 'product_types', 'launch_date', 'takedown_date'])

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
  const flags = await getEvaluatedFlags()

    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function toggle(key: ColKey) {
    const next = new Set(visible)
    next.has(key) ? next.delete(key) : next.add(key)
    onChange(next)
  }

  const flags = await getEvaluatedFlags()

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

// ── Store table ───────────────────────────────────────────────────────────────

function StoreTable({
  stores,
  search,
  filter,
  orderStats,
}: {
  stores: Store[]
  search: string
  filter: string
  orderStats: OrderStats
}) {
  const router = useRouter()
  const [visibleCols, setVisibleCols] = useState<Set<ColKey>>(DEFAULT_VISIBLE)
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

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
  const flags = await getEvaluatedFlags()

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
        case 'status':
        case 'launch_status': {
          const pa = URGENCY_PRIORITY[storeUrgency(a)] ?? 99
          const pb = URGENCY_PRIORITY[storeUrgency(b)] ?? 99
  const flags = await getEvaluatedFlags()

          return (pa - pb) * dir
        }
        case 'domain':
          return strSort(a.domain, b.domain)
        case 'in_production':
  const flags = await getEvaluatedFlags()

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
        case 'orders':
          return nullsLast(orderStats[a.id]?.count ?? null, orderStats[b.id]?.count ?? null)
        case 'total_sales':
          return nullsLast(orderStats[a.id]?.total ?? null, orderStats[b.id]?.total ?? null)
        default:
          return a.store_name.localeCompare(b.store_name) * dir
      }
    })
  }, [stores, search, filter, sortKey, sortDir, orderStats])

  const activeCols = COLUMNS.filter(c => visibleCols.has(c.key))

  // Minimum table width: name column + all active data columns, at least 1100px
  const dataColsWidth = activeCols.reduce((a, c) => a + c.width, 0)
  const minWidth = Math.max(NAME_W + dataColsWidth, 1100)

  const flags = await getEvaluatedFlags()

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-end px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
        <ColPicker visible={visibleCols} onChange={setVisibleCols} />
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center text-slate-400 text-sm">No stores match your search.</div>
      ) : (
        <div className="overflow-x-auto">

          {/* Column header row */}
          <div
            style={{
              position: 'sticky',
              top: 0,
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

          {/* Store rows */}
          {filtered.map((store, idx) => {
            const isEven = idx % 2 === 0
            const rowBg  = isEven ? '#ffffff' : '#fafafa'

  const flags = await getEvaluatedFlags()

            return (
              <div
                key={store.id}
                onClick={() => router.push(`/stores/${store.id}`)}
                style={{ cursor: 'pointer' }}
                className="group"
              >
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
                      {col.render(store, orderStats)}
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
  const { user } = useAppUser()
  const [stores, setStores]   = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<'all' | 'production' | 'launching' | 'closing'>('all')
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showAll, setShowAll] = useState(false)

  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [dateTo, setDateTo] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [orderStats, setOrderStats] = useState<OrderStats>({})
  const [syncingOrders, setSyncingOrders] = useState(false)
  const [orderSyncMsg, setOrderSyncMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [showCredentialPrompt, setShowCredentialPrompt] = useState(false)

  const load = useCallback(async (all = false) => {
    setLoading(true)
    const res  = await fetch(all ? '/api/stores?all=true' : '/api/stores')
    const data = await res.json()
    setLoading(false)
    if (Array.isArray(data)) setStores(data)
    else setError(data.error ?? 'Failed to load stores')
  }, [])

  useEffect(() => { load(showAll) }, [load, showAll])

  const loadOrderStats = useCallback(async (from: string, to: string) => {
    const res = await fetch(`/api/stores/order-stats?dateFrom=${from}&dateTo=${to}`)
    if (res.ok) {
      const data = await res.json()
      setOrderStats(data)
    }
  }, [])

  useEffect(() => { loadOrderStats(dateFrom, dateTo) }, [loadOrderStats, dateFrom, dateTo])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await fetch('/api/admin/stores/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setSyncMsg({ text: data.error ?? 'Sync failed', ok: false })
      } else {
        const parts: string[] = []
        if (data.added > 0) parts.push(`${data.added} added`)
        if (data.updated > 0) parts.push(`${data.updated} updated`)
        const msg = parts.length === 0 ? 'Already up to date.' : parts.join(', ') + '.'
        setSyncMsg({ text: msg, ok: true })
        if (data.added > 0 || data.updated > 0) load(showAll)
      }
    } catch {
      setSyncMsg({ text: 'Network error during sync.', ok: false })
    } finally {
      setSyncing(false)
    }
  }

  async function handleSyncOrders() {
    setSyncingOrders(true)
    setOrderSyncMsg(null)
    setShowCredentialPrompt(false)
    try {
      const res = await fetch('/api/stores/sync-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 400 && data.error?.toLowerCase().includes('credential')) {
          setShowCredentialPrompt(true)
        } else {
          setOrderSyncMsg({ text: data.error ?? 'Sync failed', ok: false })
        }
      } else {
        setOrderSyncMsg({ text: `${data.synced} order${data.synced !== 1 ? 's' : ''} synced across ${data.stores} store${data.stores !== 1 ? 's' : ''}.`, ok: true })
        loadOrderStats(dateFrom, dateTo)
      }
    } catch {
      setOrderSyncMsg({ text: 'Network error during order sync.', ok: false })
    } finally {
      setSyncingOrders(false)
    }
  }

  const stats = useMemo(() => ({
    active:    stores.filter(s => s.is_active).length,
    inProd:    stores.filter(s => s.in_production).length,
    launching: stores.filter(s => { const d = daysUntil(s.launch_date);   return d !== null && d >= 0 && d <= 30 }).length,
    closing:   stores.filter(s => { const d = daysUntil(s.takedown_date); return d !== null && d >= 0 && d <= 30 }).length,
  }), [stores])

  const flags = await getEvaluatedFlags()

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
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={showAll ? 'all' : 'active'}
              onChange={e => setShowAll(e.target.value === 'all')}
              className="px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-xl bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="active">Active only</option>
              <option value="all">All stores</option>
            </select>

            {/* Sync Orders — available to all authenticated users */}
            <div className="flex items-center gap-2">
              {orderSyncMsg && (
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${orderSyncMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {orderSyncMsg.text}
                </span>
              )}
              <button
                onClick={handleSyncOrders}
                disabled={syncingOrders}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                title="Sync orders from Uducat"
              >
                <svg
                  className={`w-4 h-4 ${syncingOrders ? 'animate-spin' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {syncingOrders ? 'Syncing…' : 'Sync Orders'}
              </button>
            </div>

          {user?.is_admin && (
            <div className="flex items-center gap-3">
              {syncMsg && (
                <span className={`text-xs font-medium px-3 py-1.5 rounded-full ${syncMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {syncMsg.text}
                </span>
              )}
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-slate-200 rounded-xl text-slate-600 bg-white hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
                title="Sync stores from Uducat"
              >
                <svg
                  className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {syncing ? 'Syncing…' : 'Refresh'}
              </button>
            </div>
          )}
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

        {/* Date range for order stats */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">Order Date Range</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
          <span className="text-slate-400 text-sm">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
        </div>

        {/* Credential prompt */}
        {showCredentialPrompt && (
          <div className="mb-4">
            <CredentialPrompt
              onSaved={() => { setShowCredentialPrompt(false); handleSyncOrders() }}
              onDismiss={() => setShowCredentialPrompt(false)}
            />
          </div>
        )}

        {/* Table */}
        {loading && <LoadingSkeleton />}
        {error && <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{error}</div>}
        {!loading && !error && <StoreTable stores={stores} search={search} filter={filter} orderStats={orderStats} />}
      </div>
    </>
  )
}

function LoadingSkeleton() {
  const flags = await getEvaluatedFlags()

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
