'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { KeyboardEvent, MouseEvent } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type SortingState,
} from '@tanstack/react-table'
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
  if (t.opportunity_id) return `/sales/opportunities/${t.opportunity_id}`
  if (t.customer_id) return `/sales/customers/${t.customer_id}`
  if (t.vendor_id) return `/sales/suppliers/${t.vendor_id}`
  if (t.contact_id) return `/sales/contacts/${t.contact_id}`
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

export type TaskColumnFilters = {
  title: string
  assignment: string
  priorities: string[]
  statuses: string[]
  dueFrom: string
  dueTo: string
  assignedTo: string[]
  createdBy: string[]
  linkedTypes: string[]
  linkedSearch: string
}

export type TaskFilterUserOption = {
  id: string
  display_name: string
}

type TaskTableColumnMeta = {
  className?: string
  headerClassName?: string
}

interface TaskTableViewProps {
  tasks: KanbanTask[]
  loading: boolean
  total: number
  page: number
  search: string
  onPageChange: (p: number) => void
  onRowClick: (taskId: string) => void
  onRowContextMenu: (e: MouseEvent, taskId: string) => void
  columnFilters: TaskColumnFilters
  filterUsers: TaskFilterUserOption[]
  onColumnFiltersChange: (filters: TaskColumnFilters) => void
  /** Called when a row action icon is confirmed. Return a promise; the row
   *  will show a loading state until it resolves. */
  onRowAction?: (taskId: string, action: TableRowAction) => Promise<void>
}

export function TaskTableView({ tasks, loading, total, page, search, onPageChange, onRowClick, onRowContextMenu, columnFilters, filterUsers, onColumnFiltersChange, onRowAction }: TaskTableViewProps) {
  const [actionLoading, setActionLoading] = useState<Record<string, TableRowAction | null>>({})
  const [sorting, setSorting] = useState<SortingState>([{ id: 'title', desc: false }])
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [openFilterColumn, setOpenFilterColumn] = useState<string | null>(null)
  const filterPopoverRef = useRef<HTMLDivElement>(null)

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  function handleRowKeyDown(e: KeyboardEvent<HTMLTableRowElement>, taskId: string) {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    onRowClick(taskId)
  }

  useEffect(() => {
    if (!openFilterColumn) return

    function handlePointerDown(e: PointerEvent) {
      if (filterPopoverRef.current?.contains(e.target as Node)) return
      setOpenFilterColumn(null)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [openFilterColumn])

  function updateColumnFilters(patch: Partial<TaskColumnFilters>) {
    onColumnFiltersChange({ ...columnFilters, ...patch })
  }

  function isColumnFiltered(columnId: string) {
    if (columnId === 'title') return Boolean(columnFilters.title)
    if (columnId === 'department') return Boolean(columnFilters.assignment)
    if (columnId === 'priority') return columnFilters.priorities.length > 0
    if (columnId === 'status') return columnFilters.statuses.length > 0
    if (columnId === 'due_date') return Boolean(columnFilters.dueFrom || columnFilters.dueTo)
    if (columnId === 'assigned_to') return columnFilters.assignedTo.length > 0
    if (columnId === 'created_by') return columnFilters.createdBy.length > 0
    if (columnId === 'linked_to') return Boolean(columnFilters.linkedTypes.length || columnFilters.linkedSearch)
    return false
  }

  function renderFilterIcon(columnId: string) {
    if (columnId === 'actions') return null
    const active = isColumnFiltered(columnId)
    return (
      <button
        type="button"
        aria-label={`Filter ${columnId.replace(/_/g, ' ')}`}
        onClick={(e) => {
          e.stopPropagation()
          setOpenFilterColumn((current) => current === columnId ? null : columnId)
        }}
        className={`ml-auto flex h-6 w-6 items-center justify-center rounded-md transition-all ${active ? 'bg-purple-100 text-purple-700 opacity-100' : 'text-purple-950/35 opacity-0 hover:bg-purple-100 hover:text-purple-700 group-hover:opacity-100'}`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
        </svg>
      </button>
    )
  }

  function renderColumnFilter(columnId: string) {
    const baseClass = 'mt-2 h-7 w-full rounded-md border border-purple-100 bg-white px-2 text-[11px] normal-case tracking-normal text-slate-700 outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200'
    if (columnId === 'title') {
      return <input className={baseClass} value={columnFilters.title} onChange={(e) => updateColumnFilters({ title: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Filter task" />
    }
    if (columnId === 'department') {
      return <input className={baseClass} value={columnFilters.assignment} onChange={(e) => updateColumnFilters({ assignment: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Dept/category" />
    }
    if (columnId === 'priority') {
      return (
        <select className={baseClass} value={columnFilters.priorities[0] ?? ''} onChange={(e) => updateColumnFilters({ priorities: e.target.value ? [e.target.value] : [] })} onClick={(e) => e.stopPropagation()}>
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      )
    }
    if (columnId === 'status') {
      return (
        <select className={baseClass} value={columnFilters.statuses[0] ?? ''} onChange={(e) => updateColumnFilters({ statuses: e.target.value ? [e.target.value] : [] })} onClick={(e) => e.stopPropagation()}>
          <option value="">All</option>
          {STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
      )
    }
    if (columnId === 'due_date') {
      return (
        <div className="mt-2 grid gap-1" onClick={(e) => e.stopPropagation()}>
          <input className={baseClass.replace('mt-2 ', '')} type="date" value={columnFilters.dueFrom} onChange={(e) => updateColumnFilters({ dueFrom: e.target.value })} aria-label="Due from" />
          <input className={baseClass.replace('mt-2 ', '')} type="date" value={columnFilters.dueTo} onChange={(e) => updateColumnFilters({ dueTo: e.target.value })} aria-label="Due to" />
        </div>
      )
    }
    if (columnId === 'assigned_to' || columnId === 'created_by') {
      const value = columnId === 'assigned_to' ? columnFilters.assignedTo[0] ?? '' : columnFilters.createdBy[0] ?? ''
      return (
        <select className={baseClass} value={value} onChange={(e) => updateColumnFilters(columnId === 'assigned_to' ? { assignedTo: e.target.value ? [e.target.value] : [] } : { createdBy: e.target.value ? [e.target.value] : [] })} onClick={(e) => e.stopPropagation()}>
          <option value="">All</option>
          {filterUsers.map((user) => <option key={user.id} value={user.id}>{user.display_name}</option>)}
        </select>
      )
    }
    if (columnId === 'linked_to') {
      return (
        <div className="grid gap-2">
          <select className={baseClass.replace('mt-2 ', '')} value={columnFilters.linkedTypes[0] ?? ''} onChange={(e) => updateColumnFilters({ linkedTypes: e.target.value ? [e.target.value] : [] })} onClick={(e) => e.stopPropagation()}>
            <option value="">Any type</option>
            <option value="opportunity">Opportunity</option>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
            <option value="contact">Contact</option>
          </select>
          <input className={baseClass.replace('mt-2 ', '')} value={columnFilters.linkedSearch} onChange={(e) => updateColumnFilters({ linkedSearch: e.target.value })} onClick={(e) => e.stopPropagation()} placeholder="Linked name" />
        </div>
      )
    }
    return null
  }

  function renderFilterPopover(columnId: string) {
    if (openFilterColumn !== columnId) return null
    const filter = renderColumnFilter(columnId)
    if (!filter) return null
    return (
      <div
        ref={filterPopoverRef}
        className="absolute left-4 top-full z-30 -mt-1 w-64 rounded-xl border border-purple-100 bg-white p-3 shadow-xl shadow-purple-950/10"
        onClick={(e) => e.stopPropagation()}
      >
        {filter}
        {isColumnFiltered(columnId) && (
          <button
            type="button"
            className="mt-2 text-[11px] font-semibold normal-case tracking-normal text-purple-700 hover:text-purple-900"
            onClick={(e) => {
              e.stopPropagation()
              if (columnId === 'title') updateColumnFilters({ title: '' })
              if (columnId === 'department') updateColumnFilters({ assignment: '' })
              if (columnId === 'priority') updateColumnFilters({ priorities: [] })
              if (columnId === 'status') updateColumnFilters({ statuses: [] })
              if (columnId === 'due_date') updateColumnFilters({ dueFrom: '', dueTo: '' })
              if (columnId === 'assigned_to') updateColumnFilters({ assignedTo: [] })
              if (columnId === 'created_by') updateColumnFilters({ createdBy: [] })
              if (columnId === 'linked_to') updateColumnFilters({ linkedTypes: [], linkedSearch: '' })
            }}
          >
            Clear filter
          </button>
        )}
      </div>
    )
  }

  const handleAction = useCallback(async (taskId: string, action: TableRowAction) => {
    if (!onRowAction) return
    setActionLoading((prev) => ({ ...prev, [taskId]: action }))
    try {
      await onRowAction(taskId, action)
    } finally {
      setActionLoading((prev) => ({ ...prev, [taskId]: null }))
    }
  }, [onRowAction])

  const columns = useMemo<ColumnDef<KanbanTask>[]>(() => [
    {
      id: 'title',
      accessorKey: 'title',
      header: 'Task',
      size: 260,
      minSize: 180,
      cell: ({ row }) => {
        const task = row.original
        return (
          <>
            <div className="font-medium text-slate-900 truncate">{task.title}</div>
            {task.progress > 0 && task.progress < 100 && (
              <div className="mt-1 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${task.progress}%` }} />
              </div>
            )}
          </>
        )
      },
    },
    {
      id: 'department',
      accessorFn: (task) => `${task.department ?? ''} ${task.category ?? ''}`,
      header: 'Dept / Category',
      size: 170,
      minSize: 140,
      meta: { className: 'hidden md:table-cell whitespace-nowrap', headerClassName: 'hidden md:table-cell' },
      cell: ({ row }) => {
        const task = row.original
        return (
          <div className="flex gap-1">
            {task.department && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold w-fit">{DEPARTMENT_DISPLAY_NAMES[task.department as CrmTaskDepartment] ?? task.department}</span>
            )}
            {task.category && (
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{task.category}</span>
            )}
            {!task.department && !task.category && <span className="text-slate-300">—</span>}
          </div>
        )
      },
    },
    {
      id: 'priority',
      accessorFn: (task) => ({ low: 0, medium: 1, high: 2 })[task.priority as 'low' | 'medium' | 'high'] ?? -1,
      header: 'Priority',
      size: 100,
      minSize: 90,
      meta: { className: 'hidden md:table-cell whitespace-nowrap', headerClassName: 'hidden md:table-cell' },
      cell: ({ row }) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[row.original.priority] ?? 'bg-slate-100 text-slate-600'}`}>
          {row.original.priority}
        </span>
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      size: 160,
      minSize: 140,
      meta: { className: 'whitespace-nowrap' },
      cell: ({ row }) => statusBadge(row.original.status),
    },
    {
      id: 'due_date',
      accessorFn: (task) => task.due_date ? new Date(task.due_date).getTime() : Infinity,
      header: 'Due Date',
      size: 120,
      minSize: 110,
      meta: { className: 'hidden md:table-cell whitespace-nowrap', headerClassName: 'hidden md:table-cell' },
      cell: ({ row }) => {
        const task = row.original
        return (
          <span className={
            isOverdue(task.due_date) && task.status !== 'completed'
              ? 'text-red-600 font-medium text-xs'
              : 'text-slate-500 text-xs'
          }>
            {fmtDate(task.due_date)}
          </span>
        )
      },
    },
    {
      id: 'assigned_to',
      accessorKey: 'assigned_user_name',
      header: 'Assigned To',
      size: 140,
      minSize: 120,
      meta: { className: 'text-slate-500 text-xs hidden xl:table-cell whitespace-nowrap', headerClassName: 'hidden xl:table-cell' },
      cell: ({ row }) => row.original.assigned_user_name ?? '—',
    },
    {
      id: 'created_by',
      accessorKey: 'created_by_name',
      header: 'Assigned By',
      size: 140,
      minSize: 120,
      meta: { className: 'text-slate-500 text-xs hidden xl:table-cell whitespace-nowrap', headerClassName: 'hidden xl:table-cell' },
      cell: ({ row }) => row.original.created_by_name ?? '—',
    },
    {
      id: 'linked_to',
      accessorKey: 'linked_to_name',
      header: 'Linked To',
      size: 170,
      minSize: 140,
      meta: { className: 'hidden xl:table-cell whitespace-nowrap', headerClassName: 'hidden xl:table-cell' },
      cell: ({ row }) => {
        const task = row.original
        const href = linkedToHref(task)
        if (!task.linked_to_name || !task.linked_to_type) return <span className="text-slate-300">—</span>
        return (
          <div className="flex items-center gap-1.5">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${LINKED_TYPE_BADGE[task.linked_to_type] ?? 'bg-slate-100 text-slate-600'}`}>
              {task.linked_to_type.slice(0, 3)}
            </span>
            {href ? (
              <a href={href} className="text-xs text-purple-700 hover:underline truncate" onClick={(e) => e.stopPropagation()}>
                {task.linked_to_name}
              </a>
            ) : (
              <span className="text-xs text-slate-600 truncate">{task.linked_to_name}</span>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 90,
      minSize: 80,
      enableSorting: false,
      enableResizing: false,
      meta: { className: 'whitespace-nowrap', headerClassName: 'text-right' },
      cell: ({ row }) => {
        const task = row.original
        const rowActionLoading = actionLoading[task.id]
        const isCompleted = task.status === 'completed'
        const isWaitingApproval = task.status === 'waiting_on_approval'
        const isSelfAssigned = task.assigned_to === task.created_by
        return (
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
                  onConfirm={() => handleAction(task.id, 'send_for_approval')}
                  disabled={isWaitingApproval || isCompleted || isSelfAssigned}
                  confirmColor="yellow"
                />
                <ConfirmIconButton
                  idleIcon={<IconComplete />}
                  confirmIcon={<IconConfirm />}
                  idleLabel="Mark as Completed"
                  confirmLabel="Confirm complete?"
                  onConfirm={() => handleAction(task.id, 'mark_completed')}
                  disabled={isCompleted}
                  confirmColor="green"
                />
              </>
            )}
          </div>
        )
      },
    },
  ], [actionLoading, handleAction])

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      globalFilter: search,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: 'onEnd',
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? '').toLowerCase()
      if (!q) return true
      const task = row.original
      return (
        task.title.toLowerCase().includes(q) ||
        (task.assigned_user_name ?? '').toLowerCase().includes(q) ||
        (task.linked_to_name ?? '').toLowerCase().includes(q) ||
        (task.category ?? '').toLowerCase().includes(q) ||
        (task.department ?? '').toLowerCase().includes(q)
      )
    },
  })

  const displayed = table.getRowModel().rows

  return (
    <div className="h-full overflow-auto px-6 pb-8">
      <div className="rounded-[10px] border border-purple-100 bg-white">
        <div>
          <table className="w-full text-sm table-fixed" style={{ minWidth: Math.max(760, table.getTotalSize()), width: table.getTotalSize() }}>
            <thead className="border-b border-purple-100 bg-purple-50/70">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as TaskTableColumnMeta | undefined
                    const canSort = header.column.getCanSort()
                    const sorted = header.column.getIsSorted()
                    return (
                      <th
                        key={header.id}
                        className={`group sticky top-0 z-10 text-left px-5 py-3 text-xs font-semibold text-purple-950/70 uppercase tracking-wide bg-purple-50/95 backdrop-blur relative ${canSort ? 'cursor-pointer hover:bg-purple-100 transition-colors select-none' : ''} ${meta?.headerClassName ?? ''}`}
                        style={{ width: header.getSize() }}
                        aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
                      >
                        {header.isPlaceholder ? null : (
                          <div
                            className={`flex items-center gap-2 whitespace-nowrap ${meta?.headerClassName === 'text-right' ? 'justify-end' : ''}`}
                            role={canSort ? 'button' : undefined}
                            tabIndex={canSort ? 0 : undefined}
                            onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                            onKeyDown={canSort ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                header.column.toggleSorting()
                              }
                            } : undefined}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {sorted && (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                {sorted === 'asc'
                                  ? <path d="M7 14l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                                  : <path d="M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                                }
                              </svg>
                            )}
                            {renderFilterIcon(header.column.id)}
                          </div>
                        )}
                        {renderFilterPopover(header.column.id)}
                        {header.column.getCanResize() && (
                          <button
                            type="button"
                            aria-label={`Resize ${String(header.column.columnDef.header)} column`}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute right-0 top-1/2 h-5 w-2 -translate-y-1/2 cursor-col-resize touch-none rounded-full ${header.column.getIsResizing() ? 'bg-purple-500' : 'bg-transparent hover:bg-purple-300'}`}
                          />
                        )}
                      </th>
                    )
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-purple-50">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {table.getAllLeafColumns().map((column, j) => {
                  const meta = column.columnDef.meta as TaskTableColumnMeta | undefined
                  return (
                  <td key={column.id} className={`px-5 py-3.5 ${meta?.className ?? ''}`} style={{ width: column.getSize() }}>
                    <div className="h-4 bg-purple-50 rounded animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
                  </td>
                )})}
              </tr>
            ))}
            {!loading && displayed.length === 0 && (
              <tr>
                <td colSpan={table.getAllLeafColumns().length} className="px-5 py-12 text-center text-sm text-slate-500">
                  {search ? 'No tasks match your search.' : 'No tasks match the current filters.'}
                </td>
              </tr>
            )}
            {!loading && displayed.map((row) => {
              const task = row.original
              return (
                <tr
                  key={row.id}
                  onClick={() => onRowClick(task.id)}
                  onKeyDown={(e) => handleRowKeyDown(e, task.id)}
                  onContextMenu={(e) => onRowContextMenu(e, task.id)}
                  className="cursor-pointer transition-colors hover:bg-purple-50/40 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-inset"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open task ${task.title}`}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as TaskTableColumnMeta | undefined
                    const isActionCell = cell.column.id === 'actions'
                    return (
                      <td
                        key={cell.id}
                        className={`${isActionCell ? 'px-4' : 'px-5'} py-3.5 ${cell.column.id === 'title' ? 'max-w-0' : ''} ${meta?.className ?? ''}`}
                        style={{ width: cell.column.getSize() }}
                        onClick={isActionCell ? (e) => e.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    )
                  })}
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
