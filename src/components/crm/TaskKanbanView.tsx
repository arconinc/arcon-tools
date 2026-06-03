'use client'

import { useState, useRef } from 'react'
import { DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type KanbanStatus =
  | 'not_started'
  | 'in_progress'
  | 'waiting_on_approval'
  | 'waiting_on_client_approval'
  | 'need_changes'
  | 'completed'

export type KanbanPriority = 'low' | 'medium' | 'high'

export type KanbanTask = {
  id: string
  title: string
  department: string | null
  category: string | null
  priority: KanbanPriority
  status: KanbanStatus
  due_date: string | null
  progress: number
  sort_order: number
  assigned_to: string | null
  assigned_user_name: string | null
  linked_to_name: string | null
  linked_to_type: 'opportunity' | 'customer' | 'vendor' | 'contact' | null
  opportunity_id: string | null
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
  created_by: string | null
  delegators: string[]
}

type DragOverCard = { id: string; half: 'top' | 'bottom' }

// ── Constants ─────────────────────────────────────────────────────────────────

export const KANBAN_COLUMNS: { id: KanbanStatus; label: string; color: string; bg: string; dotColor: string }[] = [
  { id: 'not_started',                label: 'Not Started',         color: '#64748b', bg: '#f8fafc', dotColor: '#cbd5e1' },
  { id: 'in_progress',                label: 'In Progress',          color: '#2563eb', bg: '#eff6ff', dotColor: '#3b82f6' },
  { id: 'waiting_on_approval',        label: 'Waiting on Approval',  color: '#d97706', bg: '#fffbeb', dotColor: '#f59e0b' },
  { id: 'waiting_on_client_approval', label: 'Waiting on Client',    color: '#ea580c', bg: '#fff7ed', dotColor: '#f97316' },
  { id: 'need_changes',               label: 'Need Changes',         color: '#dc2626', bg: '#fef2f2', dotColor: '#ef4444' },
  { id: 'completed',                  label: 'Completed',            color: '#16a34a', bg: '#f0fdf4', dotColor: '#22c55e' },
]

const PRIORITY_ORDER: Record<KanbanPriority, number> = { high: 0, medium: 1, low: 2 }

const LINKED_TYPE_COLOR: Record<string, string> = {
  opportunity: '#7c3aed',
  customer: '#2563eb',
  vendor: '#ea580c',
  contact: '#0891b2',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isTaskOverdue(iso: string | null, status: KanbanStatus) {
  if (!iso || status === 'completed') return false
  return new Date(iso) < new Date()
}

function linkedHref(t: KanbanTask): string | null {
  if (t.opportunity_id) return `/marketing/opportunities/${t.opportunity_id}`
  if (t.customer_id) return `/marketing/customers/${t.customer_id}`
  if (t.vendor_id) return `/marketing/vendors/${t.vendor_id}`
  if (t.contact_id) return `/marketing/contacts/${t.contact_id}`
  return null
}

// ── PriorityIcon ──────────────────────────────────────────────────────────────

export function PriorityIcon({ priority }: { priority: KanbanPriority }) {
  if (priority === 'high') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-label="High priority" style={{ flexShrink: 0 }}>
        <path d="M12 4l8 8H4l8-8z" fill="#ef4444" />
        <path d="M12 12l8 8H4l8-8z" fill="#ef4444" opacity="0.4" />
      </svg>
    )
  }
  if (priority === 'medium') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-label="Medium priority" style={{ flexShrink: 0 }}>
        <rect x="3" y="7" width="18" height="4" rx="1.5" fill="#f59e0b" />
        <rect x="3" y="13" width="18" height="4" rx="1.5" fill="#f59e0b" opacity="0.4" />
      </svg>
    )
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-label="Low priority" style={{ flexShrink: 0 }}>
      <path d="M12 20l-8-8h16l-8 8z" fill="#3b82f6" />
      <path d="M12 12l-8-8h16l-8 8z" fill="#3b82f6" opacity="0.4" />
    </svg>
  )
}

// ── UserAvatar ────────────────────────────────────────────────────────────────

export function UserAvatar({ name, avatarUrl, size = 20 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: '#e9d5ff', color: '#6b21a8',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.floor(size * 0.42), fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  )
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  isUpdating,
  insertIndicator,
  showAssignee,
  assigneePhoto,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onClick,
  onContextMenu,
  onAssignToMe,
  showAssignToMe,
}: {
  task: KanbanTask
  isUpdating: boolean
  insertIndicator: 'top' | 'bottom' | null
  showAssignee: boolean
  assigneePhoto: string | null
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, cardId: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onClick: (id: string) => void
  onContextMenu: (e: React.MouseEvent, taskId: string) => void
  onAssignToMe?: (taskId: string) => void
  showAssignToMe?: boolean
}) {
  const [isDragging, setIsDragging] = useState(false)
  const overdue = isTaskOverdue(task.due_date, task.status)
  const dateStr = fmtDate(task.due_date)
  const href = linkedHref(task)

  const insertClass = insertIndicator === 'top'
    ? ' insert-before'
    : insertIndicator === 'bottom'
    ? ' insert-after'
    : ''

  return (
    <div
      draggable
      onDragStart={(e) => { setIsDragging(true); onDragStart(e, task.id) }}
      onDragEnd={() => { setIsDragging(false); onDragEnd() }}
      onDragOver={(e) => onDragOver(e, task.id)}
      onDragLeave={onDragLeave}
      onClick={() => onClick(task.id)}
      onContextMenu={(e) => onContextMenu(e, task.id)}
      className={`kanban-card priority-${task.priority}${isDragging ? ' dragging' : ''}${isUpdating ? ' updating' : ''}${insertClass}`}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 8 }}>
        <div style={{ paddingTop: 1 }}>
          <PriorityIcon priority={task.priority} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111', lineHeight: 1.4, flex: 1 }}>
          {task.title}
        </span>
      </div>

      {/* Progress bar */}
      {task.progress > 0 && task.status !== 'completed' && (
        <div style={{ marginBottom: 8, height: 3, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${task.progress}%`, background: '#7c3aed', borderRadius: 2 }} />
        </div>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        {task.department && (
          <span style={{
            fontSize: 9, fontWeight: 700,
            background: '#f3e8ff', color: '#7c3aed',
            padding: '1px 6px', borderRadius: 4,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {DEPARTMENT_DISPLAY_NAMES[task.department as CrmTaskDepartment] ?? task.department}
          </span>
        )}

        {task.category && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            background: '#f3f4f6', color: '#555',
            padding: '2px 7px', borderRadius: 5,
          }}>
            {task.category}
          </span>
        )}

        {task.linked_to_name && task.linked_to_type && (
          <span
            onClick={(e) => { if (href) { e.stopPropagation(); window.open(href, '_self') } }}
            title={task.linked_to_name}
            style={{
              fontSize: 10, fontWeight: 600,
              background: (LINKED_TYPE_COLOR[task.linked_to_type] ?? '#555') + '18',
              color: LINKED_TYPE_COLOR[task.linked_to_type] ?? '#555',
              padding: '2px 7px', borderRadius: 5,
              maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              cursor: href ? 'pointer' : 'default',
            }}
          >
            {task.linked_to_type.slice(0, 3).toUpperCase()} · {task.linked_to_name}
          </span>
        )}
      </div>

      {/* Footer row: assignee, due date, assign-to-me */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
          {showAssignee && task.assigned_user_name && (
            <>
              <UserAvatar name={task.assigned_user_name} avatarUrl={assigneePhoto} size={16} />
              <span style={{ fontSize: 10, color: '#888', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {task.assigned_user_name}
              </span>
            </>
          )}
        </div>
        {dateStr && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: overdue ? '#dc2626' : '#888',
            background: overdue ? '#fef2f2' : '#f3f4f6',
            padding: '2px 7px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 3,
            marginLeft: 'auto',
            whiteSpace: 'nowrap',
          }}>
            {overdue && (
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
            {dateStr}
          </span>
        )}
        {!task.assigned_to && showAssignToMe && onAssignToMe && (
          <button
            onClick={(e) => { e.stopPropagation(); onAssignToMe(task.id) }}
            style={{
              fontSize: 10, fontWeight: 600, color: '#7c3aed',
              background: '#f3e8ff', border: 'none', borderRadius: 4,
              padding: '2px 6px', cursor: 'pointer',
              marginLeft: dateStr ? 0 : 'auto', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e9d5ff' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f3e8ff' }}
          >
            Assign to me
          </button>
        )}
      </div>
    </div>
  )
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  tasks,
  isDragOver,
  dragOverCard,
  updatingIds,
  showAssignee,
  showAssignToMe,
  userPhotoMap,
  onDragStart,
  onDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onCardDragOver,
  onCardDragLeave,
  onDrop,
  onCardClick,
  onCardContextMenu,
  onAssignToMe,
}: {
  col: { id: KanbanStatus; label: string; color: string; bg: string; dotColor: string }
  tasks: KanbanTask[]
  isDragOver: boolean
  dragOverCard: DragOverCard | null
  updatingIds: Set<string>
  showAssignee: boolean
  showAssignToMe: boolean
  userPhotoMap: Record<string, string | null>
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onColumnDragOver: (e: React.DragEvent) => void
  onColumnDragLeave: (e: React.DragEvent) => void
  onCardDragOver: (e: React.DragEvent, cardId: string) => void
  onCardDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onCardClick: (id: string) => void
  onCardContextMenu: (e: React.MouseEvent, taskId: string) => void
  onAssignToMe?: (taskId: string) => void
}) {
  return (
    <div
      onDragOver={onColumnDragOver}
      onDragLeave={onColumnDragLeave}
      onDrop={onDrop}
      style={{
        width: 272, minWidth: 272, flexShrink: 0,
        background: isDragOver ? '#faf5ff' : col.bg,
        borderRadius: 12,
        border: `1px solid ${isDragOver ? '#9333ea' : '#e5e7eb'}`,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 200px)',
        overflow: 'hidden',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{
        padding: '12px 14px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: `1px solid ${isDragOver ? '#e9d5ff' : '#ebebeb'}`,
        flexShrink: 0,
      }}>
        <div style={{ width: 9, height: 9, borderRadius: '50%', background: col.dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: col.color, flex: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {col.label}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700,
          background: tasks.length > 0 ? col.dotColor : '#e5e7eb',
          color: tasks.length > 0 ? '#fff' : '#999',
          padding: '1px 7px', borderRadius: 10,
          minWidth: 22, textAlign: 'center',
        }}>
          {tasks.length}
        </span>
      </div>

      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '10px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {tasks.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '24px 12px',
            color: '#ccc', fontSize: 12,
            border: '2px dashed #e5e7eb', borderRadius: 8,
          }}>
            Drop tasks here
          </div>
        )}
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            isUpdating={updatingIds.has(task.id)}
            showAssignee={showAssignee}
            showAssignToMe={showAssignToMe}
            assigneePhoto={task.assigned_to ? (userPhotoMap[task.assigned_to] ?? null) : null}
            insertIndicator={dragOverCard?.id === task.id ? dragOverCard.half : null}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onCardDragOver}
            onDragLeave={onCardDragLeave}
            onClick={onCardClick}
            onContextMenu={onCardContextMenu}
            onAssignToMe={onAssignToMe}
          />
        ))}
      </div>
    </div>
  )
}

// ── TaskKanbanView ────────────────────────────────────────────────────────────

interface TaskKanbanViewProps {
  tasks: KanbanTask[]
  loading: boolean
  hideCompleted: boolean
  sortBy: 'priority' | 'due_date'
  search: string
  showAssignee: boolean
  showAssignToMe: boolean
  userPhotoMap: Record<string, string | null>
  onCardClick: (id: string) => void
  onCardContextMenu: (e: React.MouseEvent, taskId: string) => void
  onReorder: (updates: { id: string; sort_order: number; status?: string }[]) => Promise<void>
  onAssignToMe?: (taskId: string) => void
}

export function TaskKanbanView({
  tasks,
  loading,
  hideCompleted,
  sortBy,
  search,
  showAssignee,
  showAssignToMe,
  userPhotoMap,
  onCardClick,
  onCardContextMenu,
  onReorder,
  onAssignToMe,
}: TaskKanbanViewProps) {
  const dragTaskId = useRef<string | null>(null)
  const dragFromColumn = useRef<KanbanStatus | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<KanbanStatus | null>(null)
  const [dragOverCard, setDragOverCard] = useState<DragOverCard | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())
  const [columnOrders, setColumnOrders] = useState<Partial<Record<KanbanStatus, string[]>>>({})

  const autoSort = (arr: KanbanTask[]) =>
    [...arr].sort((a, b) => {
      if (sortBy === 'priority') {
        const pd = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (pd !== 0) return pd
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      } else {
        if (!a.due_date && !b.due_date) return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        const dd = a.due_date.localeCompare(b.due_date)
        if (dd !== 0) return dd
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      }
    })

  const filtered = tasks.filter((t) => {
    if (hideCompleted && t.status === 'completed') return false
    if (search) {
      const q = search.toLowerCase()
      if (
        !t.title.toLowerCase().includes(q) &&
        !(t.category ?? '').toLowerCase().includes(q) &&
        !(t.linked_to_name ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  const getColumnTasks = (colId: KanbanStatus) => {
    const inCol = filtered.filter((t) => t.status === colId)
    const manual = columnOrders[colId]
    if (!manual) return autoSort(inCol)
    const idSet = new Set(manual)
    const ordered = manual.map((id) => inCol.find((t) => t.id === id)).filter(Boolean) as KanbanTask[]
    const extras = inCol.filter((t) => !idSet.has(t.id))
    return [...ordered, ...extras]
  }

  const columns = KANBAN_COLUMNS
    .filter((col) => !(hideCompleted && col.id === 'completed'))
    .map((col) => ({ ...col, tasks: getColumnTasks(col.id) }))

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, taskId: string, fromCol: KanbanStatus) {
    dragTaskId.current = taskId
    dragFromColumn.current = fromCol
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragEnd() {
    dragTaskId.current = null
    dragFromColumn.current = null
    setDragOverColumn(null)
    setDragOverCard(null)
  }

  function handleColumnDragOver(e: React.DragEvent, colId: KanbanStatus) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(colId)
  }

  function handleColumnDragLeave(e: React.DragEvent) {
    const rel = e.relatedTarget as HTMLElement | null
    if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) {
      setDragOverColumn(null)
      setDragOverCard(null)
    }
  }

  function handleCardDragOver(e: React.DragEvent, cardId: string) {
    e.preventDefault()
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom'
    if (dragOverCard?.id !== cardId || dragOverCard?.half !== half) {
      setDragOverCard({ id: cardId, half })
    }
  }

  function handleCardDragLeave(e: React.DragEvent) {
    const rel = e.relatedTarget as HTMLElement | null
    if (!rel || !(e.currentTarget as HTMLElement).contains(rel)) {
      setDragOverCard(null)
    }
  }

  async function handleDrop(e: React.DragEvent, colId: KanbanStatus) {
    e.preventDefault()
    const taskId = dragTaskId.current
    const fromCol = dragFromColumn.current
    const overCard = dragOverCard

    setDragOverColumn(null)
    setDragOverCard(null)

    if (!taskId || !fromCol) return

    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const isSameColumn = fromCol === colId
    const colTasks = getColumnTasks(colId)

    let insertIndex = colTasks.length
    if (overCard) {
      const overIdx = colTasks.findIndex((t) => t.id === overCard.id)
      if (overIdx !== -1) insertIndex = overCard.half === 'top' ? overIdx : overIdx + 1
    }

    if (isSameColumn) {
      const currentIds = colTasks.map((t) => t.id)
      const fromIdx = currentIds.indexOf(taskId)
      if (fromIdx === -1) return
      const newIds = [...currentIds]
      newIds.splice(fromIdx, 1)
      const adjustedInsert = insertIndex > fromIdx ? insertIndex - 1 : insertIndex
      newIds.splice(adjustedInsert, 0, taskId)
      setColumnOrders((prev) => ({ ...prev, [colId]: newIds }))
      await onReorder(newIds.map((id, i) => ({ id, sort_order: i * 1000 })))
    } else {
      const targetIds = [...getColumnTasks(colId).map((t) => t.id)]
      targetIds.splice(insertIndex, 0, taskId)
      const sourceIds = (columnOrders[fromCol] ?? getColumnTasks(fromCol).map((t) => t.id)).filter((id) => id !== taskId)
      setColumnOrders((prev) => ({ ...prev, [colId]: targetIds, [fromCol]: sourceIds }))
      setUpdatingIds((s) => new Set(s).add(taskId))

      const targetUpdates = targetIds.map((id, i) => ({ id, sort_order: i * 1000, ...(id === taskId ? { status: colId } : {}) }))
      const sourceUpdates = sourceIds.map((id, i) => ({ id, sort_order: i * 1000 }))
      try {
        await onReorder([...targetUpdates, ...sourceUpdates])
      } catch {
        setColumnOrders((prev) => {
          const next = { ...prev }
          delete next[colId]
          delete next[fromCol]
          return next
        })
      } finally {
        setUpdatingIds((s) => { const n = new Set(s); n.delete(taskId); return n })
      }
    }
  }

  return (
    <>
      <style>{`
        .kanban-card {
          background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
          padding: 11px 13px; cursor: pointer;
          transition: box-shadow 0.12s, border-color 0.12s, transform 0.1s;
          user-select: none; position: relative;
        }
        .kanban-card:hover { box-shadow: 0 3px 10px rgba(0,0,0,0.09); border-color: #d1d5db; }
        .kanban-card.dragging { opacity: 0.35; transform: scale(0.97); }
        .kanban-card.updating { opacity: 0.6; }
        .kanban-card.priority-high { border-left: 3px solid #fca5a5; background: #fffbfb; }
        .kanban-card.priority-low { border-left: 3px solid #93c5fd; background: #f8fbff; }
        .insert-before::before { content: ''; display: block; position: absolute; top: -5px; left: 0; right: 0; height: 2px; background: #7c3aed; border-radius: 2px; pointer-events: none; }
        .insert-before::after { content: ''; display: block; position: absolute; top: -9px; left: 0; width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; pointer-events: none; }
        .insert-after::before { content: ''; display: block; position: absolute; bottom: -5px; left: 0; right: 0; height: 2px; background: #7c3aed; border-radius: 2px; pointer-events: none; }
        .insert-after::after { content: ''; display: block; position: absolute; bottom: -9px; left: 0; width: 8px; height: 8px; border-radius: 50%; background: #7c3aed; pointer-events: none; }
      `}</style>

      <div style={{
        flex: 1, overflowX: 'auto', overflowY: 'hidden',
        padding: '0 24px 24px', display: 'flex', gap: 12, alignItems: 'flex-start',
        position: 'relative',
      }}>
        {loading ? (
          KANBAN_COLUMNS.map((col) => (
            <div key={col.id} style={{ width: 272, minWidth: 272, flexShrink: 0, background: '#f8fafc', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px' }}>
              <div style={{ height: 16, width: '60%', background: '#e5e7eb', borderRadius: 4, marginBottom: 14 }} />
              {[1, 2].map((i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 12, marginBottom: 8 }}>
                  <div style={{ height: 14, width: '80%', background: '#e5e7eb', borderRadius: 4, marginBottom: 8 }} />
                  <div style={{ height: 12, width: '50%', background: '#f1f5f9', borderRadius: 4 }} />
                </div>
              ))}
            </div>
          ))
        ) : (
          columns.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={col.tasks}
              isDragOver={dragOverColumn === col.id}
              dragOverCard={dragOverCard}
              updatingIds={updatingIds}
              showAssignee={showAssignee}
              showAssignToMe={showAssignToMe}
              userPhotoMap={userPhotoMap}
              onDragStart={(e, id) => handleDragStart(e, id, col.id)}
              onDragEnd={handleDragEnd}
              onColumnDragOver={(e) => handleColumnDragOver(e, col.id)}
              onColumnDragLeave={handleColumnDragLeave}
              onCardDragOver={handleCardDragOver}
              onCardDragLeave={handleCardDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              onCardClick={onCardClick}
              onCardContextMenu={onCardContextMenu}
              onAssignToMe={onAssignToMe}
            />
          ))
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            position: 'absolute',
            left: 24,
            right: 24,
            top: 132,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#aaa',
            pointerEvents: 'none',
          }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No tasks found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Try adjusting your filters</p>
          </div>
        )}
      </div>
    </>
  )
}
