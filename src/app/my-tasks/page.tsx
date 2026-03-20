'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ────────────────────────────────────────────────────────────────────

type Priority = 'low' | 'medium' | 'high'
type Status =
  | 'not_started'
  | 'in_progress'
  | 'waiting_on_approval'
  | 'waiting_on_client_approval'
  | 'need_changes'
  | 'completed'

type TaskItem = {
  id: string
  title: string
  category: string | null
  priority: Priority
  status: Status
  due_date: string | null
  progress: number
  linked_to_name: string | null
  linked_to_type: 'opportunity' | 'customer' | 'vendor' | 'contact' | null
  opportunity_id: string | null
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
}

type DragOverCard = { id: string; half: 'top' | 'bottom' }

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: { id: Status; label: string; color: string; bg: string; dotColor: string }[] = [
  { id: 'not_started',                label: 'Not Started',         color: '#64748b', bg: '#f8fafc', dotColor: '#cbd5e1' },
  { id: 'in_progress',                label: 'In Progress',          color: '#2563eb', bg: '#eff6ff', dotColor: '#3b82f6' },
  { id: 'waiting_on_approval',        label: 'Waiting on Approval',  color: '#d97706', bg: '#fffbeb', dotColor: '#f59e0b' },
  { id: 'waiting_on_client_approval', label: 'Waiting on Client',    color: '#ea580c', bg: '#fff7ed', dotColor: '#f97316' },
  { id: 'need_changes',               label: 'Need Changes',         color: '#dc2626', bg: '#fef2f2', dotColor: '#ef4444' },
  { id: 'completed',                  label: 'Completed',            color: '#16a34a', bg: '#f0fdf4', dotColor: '#22c55e' },
]

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

// ── Priority icon (Jira-style colored arrows) ─────────────────────────────────

function PriorityIcon({ priority }: { priority: Priority }) {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function isOverdue(iso: string | null, status: Status) {
  if (!iso || status === 'completed') return false
  return new Date(iso) < new Date()
}

function linkedHref(t: TaskItem): string | null {
  if (t.opportunity_id) return `/crm/opportunities/${t.opportunity_id}`
  if (t.customer_id) return `/crm/customers/${t.customer_id}`
  if (t.vendor_id) return `/crm/vendors/${t.vendor_id}`
  if (t.contact_id) return `/crm/contacts/${t.contact_id}`
  return null
}

const LINKED_TYPE_COLOR: Record<string, string> = {
  opportunity: '#7c3aed',
  customer: '#2563eb',
  vendor: '#ea580c',
  contact: '#0891b2',
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hideCompleted, setHideCompleted] = useState(false)
  const [sortBy, setSortBy] = useState<'priority' | 'due_date'>('priority')

  // columnOrders: manual ordering per column (overrides auto-sort when set)
  const [columnOrders, setColumnOrders] = useState<Partial<Record<Status, string[]>>>({})

  // Drag state
  const dragTaskId = useRef<string | null>(null)
  const dragFromColumn = useRef<Status | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [dragOverCard, setDragOverCard] = useState<DragOverCard | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/crm/tasks?assigned_to=me')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setTasks(Array.isArray(data) ? data : [])
    } catch {
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Reset manual order when sort mode changes
  function handleSortChange(mode: 'priority' | 'due_date') {
    setSortBy(mode)
    setColumnOrders({})
  }

  // ── Ordering ───────────────────────────────────────────────────────────────

  const autoSort = (arr: TaskItem[]) =>
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

  const getColumnTasks = (colId: Status, allFiltered: TaskItem[]) => {
    const inCol = allFiltered.filter((t) => t.status === colId)
    const manual = columnOrders[colId]
    if (!manual) return autoSort(inCol)
    // Apply manual order; append newly added tasks not yet in manual order
    const idSet = new Set(manual)
    const ordered = manual.map((id) => inCol.find((t) => t.id === id)).filter(Boolean) as TaskItem[]
    const extras = inCol.filter((t) => !idSet.has(t.id))
    return [...ordered, ...extras]
  }

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

  const columns = COLUMNS
    .filter((col) => !(hideCompleted && col.id === 'completed'))
    .map((col) => ({ ...col, tasks: getColumnTasks(col.id, filtered) }))

  const totalMine = tasks.length
  const totalOpen = tasks.filter((t) => t.status !== 'completed').length

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, taskId: string, fromCol: Status) {
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

  function handleColumnDragOver(e: React.DragEvent, colId: Status) {
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

  async function handleDrop(e: React.DragEvent, colId: Status) {
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
    const colTasks = getColumnTasks(colId, filtered)

    // Compute insert index based on dragOverCard
    let insertIndex = colTasks.length // default: end
    if (overCard) {
      const overIdx = colTasks.findIndex((t) => t.id === overCard.id)
      if (overIdx !== -1) {
        insertIndex = overCard.half === 'top' ? overIdx : overIdx + 1
      }
    }

    if (isSameColumn) {
      // Reorder within column
      const currentIds = colTasks.map((t) => t.id)
      const fromIdx = currentIds.indexOf(taskId)
      if (fromIdx === -1) return
      const newIds = [...currentIds]
      newIds.splice(fromIdx, 1)
      // Adjust insertIndex after removal
      const adjustedInsert = insertIndex > fromIdx ? insertIndex - 1 : insertIndex
      newIds.splice(adjustedInsert, 0, taskId)
      setColumnOrders((prev) => ({ ...prev, [colId]: newIds }))
    } else {
      // Moving between columns: update status + position
      const targetIds = colTasks.map((t) => t.id)
      targetIds.splice(insertIndex, 0, taskId)
      setColumnOrders((prev) => ({
        ...prev,
        [colId]: targetIds,
        // Remove from source column order if manual
        ...(prev[fromCol] ? { [fromCol]: (prev[fromCol] as string[]).filter((id) => id !== taskId) } : {}),
      }))

      // Optimistic status update
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: colId } : t))
      setUpdatingIds((s) => new Set(s).add(taskId))

      try {
        const res = await fetch(`/api/crm/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: colId }),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t))
      } finally {
        setUpdatingIds((s) => { const n = new Set(s); n.delete(taskId); return n })
      }
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .kanban-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 11px 13px;
          cursor: pointer;
          transition: box-shadow 0.12s, border-color 0.12s, transform 0.1s;
          user-select: none;
          position: relative;
        }
        .kanban-card:hover {
          box-shadow: 0 3px 10px rgba(0,0,0,0.09);
          border-color: #d1d5db;
        }
        .kanban-card.dragging {
          opacity: 0.35;
          transform: scale(0.97);
        }
        .kanban-card.updating {
          opacity: 0.6;
        }
        .insert-before::before {
          content: '';
          display: block;
          position: absolute;
          top: -5px;
          left: 0; right: 0;
          height: 2px;
          background: #7c3aed;
          border-radius: 2px;
          pointer-events: none;
        }
        .insert-before::after {
          content: '';
          display: block;
          position: absolute;
          top: -9px;
          left: 0;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #7c3aed;
          pointer-events: none;
        }
        .insert-after::before {
          content: '';
          display: block;
          position: absolute;
          bottom: -5px;
          left: 0; right: 0;
          height: 2px;
          background: #7c3aed;
          border-radius: 2px;
          pointer-events: none;
        }
        .insert-after::after {
          content: '';
          display: block;
          position: absolute;
          bottom: -9px;
          left: 0;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: #7c3aed;
          pointer-events: none;
        }
        .kanban-col-drop {
          border-color: #9333ea !important;
          background: #faf5ff !important;
        }
        .priority-sort-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 5px 11px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          background: transparent;
          color: #666;
          transition: background 0.1s, color 0.1s;
        }
        .priority-sort-btn.active {
          background: #fff;
          color: #111;
          box-shadow: 0 1px 3px rgba(0,0,0,0.12);
        }
        .priority-sort-btn:not(.active):hover {
          color: #333;
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>My Tasks</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
              {loading ? 'Loading…' : `${totalOpen} open · ${totalMine} total`}
            </p>
          </div>
          <button
            onClick={() => router.push('/crm/tasks/new')}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 16px',
              background: '#6b1e98', color: '#fff',
              border: 'none', borderRadius: 9,
              fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#581c87' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#6b1e98' }}
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: 180, maxWidth: 320 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={{
                width: '100%', boxSizing: 'border-box',
                paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7,
                border: '1px solid #e5e7eb', borderRadius: 8,
                fontSize: 13, color: '#333', background: '#fff',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = '#9333ea' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb' }}
            />
          </div>

          {/* Sort by */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f0f0f0', borderRadius: 8, padding: '3px' }}>
            <span style={{ fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 6px' }}>Sort</span>
            <button
              className={`priority-sort-btn${sortBy === 'priority' ? ' active' : ''}`}
              onClick={() => handleSortChange('priority')}
            >
              <PriorityIcon priority="high" />
              Priority
            </button>
            <button
              className={`priority-sort-btn${sortBy === 'due_date' ? ' active' : ''}`}
              onClick={() => handleSortChange('due_date')}
            >
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Due Date
            </button>
          </div>

          {/* Hide completed toggle */}
          <div
            onClick={() => setHideCompleted(h => !h)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}
          >
            <div style={{
              width: 36, height: 20, borderRadius: 10,
              background: hideCompleted ? '#6b1e98' : '#d1d5db',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute',
                top: 2, left: hideCompleted ? 18 : 2,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Hide completed</span>
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'hidden',
        padding: '0 24px 24px',
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}>
        {loading ? (
          COLUMNS.map((col) => (
            <div key={col.id} style={{
              width: 272, minWidth: 272, flexShrink: 0,
              background: '#f8fafc', borderRadius: 12,
              border: '1px solid #e5e7eb',
              padding: '12px',
            }}>
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
              isDragOver={dragOverColumn === col.id}
              dragOverCard={dragOverCard}
              updatingIds={updatingIds}
              onDragStart={(e, id) => handleDragStart(e, id, col.id)}
              onDragEnd={handleDragEnd}
              onColumnDragOver={(e) => handleColumnDragOver(e, col.id)}
              onColumnDragLeave={handleColumnDragLeave}
              onCardDragOver={handleCardDragOver}
              onCardDragLeave={handleCardDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              onCardClick={(id) => router.push(`/crm/tasks/${id}`)}
            />
          ))
        )}

        {!loading && filtered.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: '#aaa', paddingTop: 60,
          }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600 }}>No tasks found</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              {search ? 'Try a different search term' : 'You have no tasks assigned to you'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  isDragOver,
  dragOverCard,
  updatingIds,
  onDragStart,
  onDragEnd,
  onColumnDragOver,
  onColumnDragLeave,
  onCardDragOver,
  onCardDragLeave,
  onDrop,
  onCardClick,
}: {
  col: { id: Status; label: string; color: string; bg: string; dotColor: string; tasks: TaskItem[] }
  isDragOver: boolean
  dragOverCard: DragOverCard | null
  updatingIds: Set<string>
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onColumnDragOver: (e: React.DragEvent) => void
  onColumnDragLeave: (e: React.DragEvent) => void
  onCardDragOver: (e: React.DragEvent, cardId: string) => void
  onCardDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onCardClick: (id: string) => void
}) {
  return (
    <div
      onDragOver={onColumnDragOver}
      onDragLeave={onColumnDragLeave}
      onDrop={onDrop}
      className={isDragOver ? 'kanban-col-drop' : ''}
      style={{
        width: 272, minWidth: 272, flexShrink: 0,
        background: isDragOver ? '#faf5ff' : col.bg,
        borderRadius: 12,
        border: `1px solid ${isDragOver ? '#9333ea' : '#e5e7eb'}`,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 200px)',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      {/* Column header */}
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
          background: col.tasks.length > 0 ? col.dotColor : '#e5e7eb',
          color: col.tasks.length > 0 ? '#fff' : '#999',
          padding: '1px 7px',
          borderRadius: 10,
          minWidth: 22,
          textAlign: 'center',
        }}>
          {col.tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {col.tasks.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '24px 12px',
            color: '#ccc', fontSize: 12,
            border: '2px dashed #e5e7eb',
            borderRadius: 8,
          }}>
            Drop tasks here
          </div>
        )}
        {col.tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            isUpdating={updatingIds.has(task.id)}
            insertIndicator={
              dragOverCard?.id === task.id ? dragOverCard.half : null
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onCardDragOver}
            onDragLeave={onCardDragLeave}
            onClick={onCardClick}
          />
        ))}
      </div>
    </div>
  )
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({
  task,
  isUpdating,
  insertIndicator,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onClick,
}: {
  task: TaskItem
  isUpdating: boolean
  insertIndicator: 'top' | 'bottom' | null
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, cardId: string) => void
  onDragLeave: (e: React.DragEvent) => void
  onClick: (id: string) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const overdue = isOverdue(task.due_date, task.status)
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
      className={`kanban-card${isDragging ? ' dragging' : ''}${isUpdating ? ' updating' : ''}${insertClass}`}
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

        {dateStr && (
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: overdue ? '#dc2626' : '#888',
            background: overdue ? '#fef2f2' : '#f3f4f6',
            padding: '2px 7px', borderRadius: 5,
            display: 'flex', alignItems: 'center', gap: 3,
            marginLeft: 'auto',
          }}>
            {overdue && (
              <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            )}
            {dateStr}
          </span>
        )}
      </div>
    </div>
  )
}
