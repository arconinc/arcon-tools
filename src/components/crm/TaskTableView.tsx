'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import type { KanbanTask } from './TaskKanbanView'
import { DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

const PAGE_SIZE = 50

const STATUSES = [
  { value: 'not_started', label: 'Not Started', cls: 'bg-slate-100 text-slate-600' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', cls: 'bg-green-100 text-green-700' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval', cls: 'bg-yellow-100 text-yellow-700' },
  { value: 'waiting_on_client_approval', label: 'Waiting on Client', cls: 'bg-orange-100 text-orange-700' },
  { value: 'need_changes', label: 'Need Changes', cls: 'bg-red-100 text-red-600' },
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

const LINKED_TYPE_BADGE: Record<string, string> = {
  opportunity: 'bg-purple-100 text-purple-700',
  customer: 'bg-blue-100 text-blue-700',
  vendor: 'bg-orange-100 text-orange-700',
  contact: 'bg-teal-100 text-teal-700',
}

function statusBadge(status: string) {
  const s = STATUSES.find((x) => x.value === status)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${s?.cls ?? 'bg-slate-100 text-slate-600'}`}>
      {s?.label ?? status}
    </span>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(iso: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function linkedToHref(t: KanbanTask): string | null {
  if (t.opportunity_id) return `/marketing/opportunities/${t.opportunity_id}`
  if (t.customer_id) return `/marketing/customers/${t.customer_id}`
  if (t.vendor_id) return `/marketing/vendors/${t.vendor_id}`
  if (t.contact_id) return `/marketing/contacts/${t.contact_id}`
  return null
}

// ── ConfirmIconButton ─────────────────────────────────────────────────────────
// Two-click confirm pattern: first click enters "pending confirm" state and
// shows a confirm icon with a tooltip; second click (within timeout) fires
// onConfirm. Clicking elsewhere or waiting resets. No modal.
//
// Use this component anywhere in a table that needs destructive / significant
// single-row actions without a modal confirmation.

interface ConfirmIconButtonProps {
  /** Icon shown in idle state */
  idleIcon: React.ReactNode
  /** Icon shown in pending-confirm state */
  confirmIcon: React.ReactNode
  /** Tooltip shown in idle state */
  idleLabel: string
  /** Tooltip shown while waiting for second click */
  confirmLabel: string
  /** Called on the second (confirming) click */
  onConfirm: () => void
  /** ms before confirm state resets automatically (default 3000) */
  resetDelay?: number
  /** Extra classes for the button */
  className?: string
  /** Disabled when task is already in the target state */
  disabled?: boolean
  /** Color theme for the confirm state ring */
  confirmColor?: 'yellow' | 'green'
}

function ConfirmIconButton({
  idleIcon,
  confirmIcon,
  idleLabel,
  confirmLabel,
  onConfirm,
  resetDelay = 3000,
  className = '',
  disabled = false,
  confirmColor = 'yellow',
}: ConfirmIconButtonProps) {
  const [pending, setPending] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})
  const btnRef = useRef<HTMLButtonElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setPending(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function handleMouseEnter() {
    if (!btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    setTooltipStyle({
      position: 'fixed',
      top: rect.top - 6,
      left: rect.left + rect.width / 2,
      transform: 'translate(-50%, -100%)',
      zIndex: 9999,
    })
    setHovered(true)
  }

  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    if (disabled) return
    if (!pending) {
      setPending(true)
      timerRef.current = setTimeout(reset, resetDelay)
    } else {
      reset()
      onConfirm()
    }
  }

  const confirmRing =
    confirmColor === 'green'
      ? 'ring-2 ring-green-400 bg-green-50 text-green-600'
      : 'ring-2 ring-yellow-400 bg-yellow-50 text-yellow-600'

  const tooltipText = pending ? confirmLabel : idleLabel

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={tooltipText}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        className={[
          'flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150',
          disabled
            ? 'opacity-30 cursor-not-allowed text-slate-300'
            : pending
              ? confirmRing
              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100',
          className,
        ].join(' ')}
      >
        {pending ? confirmIcon : idleIcon}
      </button>
      {hovered && typeof document !== 'undefined' && createPortal(
        <span
          style={tooltipStyle}
          className="pointer-events-none whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-[11px] font-medium text-white"
        >
          {tooltipText}
        </span>,
        document.body
      )}
    </>
  )
}

// ── Icons (inline SVG, no extra dependency) ───────────────────────────────────

/** Clock / send-for-approval icon */
function IconApproval() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

/** Checkmark / complete icon */
function IconComplete() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

/** Question mark — confirm state */
function IconConfirm() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

// ── TaskTableView ─────────────────────────────────────────────────────────────

export type TableRowAction = 'send_for_approval' | 'mark_completed'

type SortColumn = 'title' | 'department' | 'priority' | 'status' | 'due_date' | 'assigned_to' | 'created_by' | 'linked_to'
type SortDirection = 'asc' | 'desc'

interface TaskTableViewProps {
  tasks: KanbanTask[]
  loading: boolean
  total: number
  page: number
  search: string
  onPageChange: (p: number) => void
  onRowClick: (taskId: string) => void
  onRowContextMenu: (e: MouseEvent, taskId: string) => void
  /** Called when a row action icon is confirmed. Return a promise; the row
   *  will show a loading state until it resolves. */
  onRowAction?: (taskId: string, action: TableRowAction) => Promise<void>
}

export function TaskTableView({ tasks, loading, total, page, search, onPageChange, onRowClick, onRowContextMenu, onRowAction }: TaskTableViewProps) {
  const [actionLoading, setActionLoading] = useState<Record<string, TableRowAction | null>>({})
  const [sortColumn, setSortColumn] = useState<SortColumn>('title')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')

  // Handle sort column toggle: click same column to toggle direction, click different to change column
  function handleSortClick(col: SortColumn) {
    if (sortColumn === col) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(col)
      setSortDirection('asc')
    }
  }

  // Apply search filter first
  const filtered = (() => {
    if (!search) return tasks
    const q = search.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.assigned_user_name ?? '').toLowerCase().includes(q) ||
        (t.linked_to_name ?? '').toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        (t.department ?? '').toLowerCase().includes(q)
    )
  })()

  // Apply sorting
  const displayed = (() => {
    const sorted = [...filtered]
    sorted.sort((a, b) => {
      let aVal: string | number | null | undefined
      let bVal: string | number | null | undefined

      switch (sortColumn) {
        case 'title':
          aVal = a.title.toLowerCase()
          bVal = b.title.toLowerCase()
          break
        case 'department':
          aVal = (a.department ?? '').toLowerCase()
          bVal = (b.department ?? '').toLowerCase()
          break
        case 'priority':
          // priority order: low < medium < high
          const priorityOrder = { low: 0, medium: 1, high: 2 }
          aVal = priorityOrder[a.priority as keyof typeof priorityOrder] ?? -1
          bVal = priorityOrder[b.priority as keyof typeof priorityOrder] ?? -1
          break
        case 'status':
          aVal = (a.status ?? '').toLowerCase()
          bVal = (b.status ?? '').toLowerCase()
          break
        case 'due_date':
          // sort by due date, nulls last
          aVal = a.due_date ? new Date(a.due_date).getTime() : Infinity
          bVal = b.due_date ? new Date(b.due_date).getTime() : Infinity
          break
        case 'assigned_to':
          aVal = (a.assigned_user_name ?? '').toLowerCase()
          bVal = (b.assigned_user_name ?? '').toLowerCase()
          break
        case 'created_by':
          aVal = (a.created_by_name ?? '').toLowerCase()
          bVal = (b.created_by_name ?? '').toLowerCase()
          break
        case 'linked_to':
          aVal = (a.linked_to_name ?? '').toLowerCase()
          bVal = (b.linked_to_name ?? '').toLowerCase()
          break
        default:
          aVal = ''
          bVal = ''
      }

      if (aVal === bVal) return 0
      if (aVal === null || aVal === undefined) return 1
      if (bVal === null || bVal === undefined) return -1

      const result = aVal < bVal ? -1 : 1
      return sortDirection === 'asc' ? result : -result
    })
    return sorted
  })()

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, taskId: string) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onRowClick(taskId)
  }

  async function handleAction(taskId: string, action: TableRowAction) {
    if (!onRowAction) return
    setActionLoading((prev) => ({ ...prev, [taskId]: action }))
    try {
      await onRowAction(taskId, action)
    } finally {
      setActionLoading((prev) => ({ ...prev, [taskId]: null }))
    }
  }

  return (
    <div className="px-6 pb-8">
      <div className="overflow-hidden rounded-[10px] border border-purple-100 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed" style={{ minWidth: '760px' }}>
             <thead className="border-b border-purple-100 bg-purple-50/70">
              <tr>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('title')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('title') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Task
                    {sortColumn === 'title' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide hidden md:table-cell w-[160px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('department')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('department') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Dept / Category
                    {sortColumn === 'department' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide hidden md:table-cell w-[90px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('priority')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('priority') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Priority
                    {sortColumn === 'priority' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide w-[150px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('status')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('status') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Status
                    {sortColumn === 'status' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide hidden md:table-cell w-[110px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('due_date')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('due_date') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Due Date
                    {sortColumn === 'due_date' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide hidden xl:table-cell w-[130px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('assigned_to')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('assigned_to') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Assigned To
                    {sortColumn === 'assigned_to' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide hidden xl:table-cell w-[130px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('created_by')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('created_by') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Assigned By
                    {sortColumn === 'created_by' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th 
                  className="text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide hidden xl:table-cell w-[160px] cursor-pointer hover:bg-purple-100/40 transition-colors select-none"
                  onClick={() => handleSortClick('linked_to')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSortClick('linked_to') } }}
                >
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    Linked To
                    {sortColumn === 'linked_to' && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        {sortDirection === 'asc' 
                          ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                          : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        }
                      </svg>
                    )}
                  </div>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-50">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {[...Array(9)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-4 bg-purple-50 rounded animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && displayed.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-sm text-slate-500">
                  {search ? 'No tasks match your search.' : 'No tasks match the current filters.'}
                </td>
              </tr>
            )}
            {!loading && displayed.map((t) => {
              const href = linkedToHref(t)
              const rowActionLoading = actionLoading[t.id]
              const isCompleted = t.status === 'completed'
              const isWaitingApproval = t.status === 'waiting_on_approval'
              const isSelfAssigned = t.assigned_to === t.created_by
              return (
                <tr
                  key={t.id}
                  onClick={() => onRowClick(t.id)}
                  onKeyDown={(e) => handleRowKeyDown(e, t.id)}
                  onContextMenu={(e) => onRowContextMenu(e, t.id)}
                  className="cursor-pointer transition-colors hover:bg-purple-50/40 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-inset"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open task ${t.title}`}
                >
                  <td className="px-5 py-3.5 max-w-0">
                    <div className="font-medium text-slate-900 truncate">{t.title}</div>
                    {t.progress > 0 && t.progress < 100 && (
                      <div className="mt-1 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${t.progress}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell whitespace-nowrap">
                    <div className="flex gap-1">
                      {t.department && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold w-fit">{DEPARTMENT_DISPLAY_NAMES[t.department as CrmTaskDepartment] ?? t.department}</span>
                      )}
                      {t.category && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{t.category}</span>
                      )}
                      {!t.department && !t.category && <span className="text-slate-300">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">{statusBadge(t.status)}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell whitespace-nowrap">
                    <span className={
                      isOverdue(t.due_date) && t.status !== 'completed'
                        ? 'text-red-600 font-medium text-xs'
                        : 'text-slate-500 text-xs'
                    }>
                      {fmtDate(t.due_date)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs hidden xl:table-cell whitespace-nowrap">
                    {t.assigned_user_name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs hidden xl:table-cell whitespace-nowrap">
                    {t.created_by_name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell whitespace-nowrap" onClick={(e) => { if (href) e.stopPropagation() }}>
                    {t.linked_to_name && t.linked_to_type ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${LINKED_TYPE_BADGE[t.linked_to_type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {t.linked_to_type.slice(0, 3)}
                        </span>
                        {href ? (
                          <a href={href} className="text-xs text-purple-700 hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                            {t.linked_to_name}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600 truncate">{t.linked_to_name}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  {/* ── Actions column ── */}
                  <td
                    className="px-4 py-3.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      {rowActionLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-purple-500 rounded-full animate-spin" />
                      ) : (
                        <>
                          <ConfirmIconButton
                            idleIcon={<IconApproval />}
                            confirmIcon={<IconConfirm />}
                            idleLabel="Send for Approval"
                            confirmLabel="Confirm approval?"
                            onConfirm={() => handleAction(t.id, 'send_for_approval')}
                            disabled={isWaitingApproval || isCompleted || isSelfAssigned}
                            confirmColor="yellow"
                          />
                          <ConfirmIconButton
                            idleIcon={<IconComplete />}
                            confirmIcon={<IconConfirm />}
                            idleLabel="Mark as Completed"
                            confirmLabel="Confirm complete?"
                            onConfirm={() => handleAction(t.id, 'mark_completed')}
                            disabled={isCompleted}
                            confirmColor="green"
                          />
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            </tbody>
          </table>
        </div>
        {!loading && total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-purple-50 px-5 py-3">
            <span className="text-xs text-slate-500">
              Showing {rangeFrom}–{rangeTo} of {total} task{total !== 1 ? 's' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
                  className="rounded-lg border border-purple-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Previous
                </button>
                <span className="px-1 text-xs text-slate-500">Page {page} of {totalPages}</span>
                <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="rounded-lg border border-purple-100 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-40">
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
