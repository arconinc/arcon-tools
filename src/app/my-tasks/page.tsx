'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAppUser } from '@/components/layout/AppShell'
import QuickAddTask from '@/components/crm/QuickAddTask'
import { TaskQuickEditPanel } from '@/components/crm/TaskQuickEditPanel'

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
  sort_order: number
  assigned_to: string | null
  assigned_user_name: string | null
  linked_to_name: string | null
  linked_to_type: 'opportunity' | 'customer' | 'vendor' | 'contact' | null
  opportunity_id: string | null
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
}

type UserOption = {
  id: string
  display_name: string
  team: string | null
  avatar_url: string | null
  profile_image_url: string | null
}

type UserSelection = 'all' | Set<string>

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

// ── UserAvatar ─────────────────────────────────────────────────────────────────

function UserAvatar({ name, avatarUrl, size = 20 }: { name: string; avatarUrl: string | null; size?: number }) {
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

// ── Wrapper (required for useSearchParams in Next.js App Router) ───────────────

export default function MyTasksPageWrapper() {
  return (
    <Suspense fallback={<div />}>
      <MyTasksPage />
    </Suspense>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

function MyTasksPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user: currentUser } = useAppUser()
  const isTeamView = searchParams.get('view') === 'team'

  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [hideCompleted, setHideCompleted] = useState(true)
  const [sortBy, setSortBy] = useState<'priority' | 'due_date'>('priority')
  const [columnOrders, setColumnOrders] = useState<Partial<Record<Status, string[]>>>({})

  // Filter state
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [selectedTeams, setSelectedTeams] = useState<UserSelection>('all')
  const [selectedUserIds, setSelectedUserIds] = useState<UserSelection>('all')
  const [initialized, setInitialized] = useState(false)

  // Dropdown open state
  const [teamsDropdownOpen, setTeamsDropdownOpen] = useState(false)
  const [usersDropdownOpen, setUsersDropdownOpen] = useState(false)
  const teamsDropdownRef = useRef<HTMLDivElement>(null)
  const usersDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (teamsDropdownRef.current && !teamsDropdownRef.current.contains(e.target as Node)) setTeamsDropdownOpen(false)
      if (usersDropdownRef.current && !usersDropdownRef.current.contains(e.target as Node)) setUsersDropdownOpen(false)
    }
    if (teamsDropdownOpen || usersDropdownOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [teamsDropdownOpen, usersDropdownOpen])

  // Drag state
  const dragTaskId = useRef<string | null>(null)
  const dragFromColumn = useRef<Status | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<Status | null>(null)
  const [dragOverCard, setDragOverCard] = useState<DragOverCard | null>(null)
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set())

  // Context menu state for quick-edit panel
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null)

  // Load all users for the filter bar
  useEffect(() => {
    fetch('/api/crm/users')
      .then((r) => r.json())
      .then((data: UserOption[]) => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Set initial filter once we know the current user
  useEffect(() => {
    if (currentUser && !initialized) {
      setSelectedTeams('all')
      setSelectedUserIds(isTeamView ? 'all' : new Set([currentUser.id]))
      setInitialized(true)
    }
  }, [currentUser, initialized, isTeamView])

  // Stable keys for Set-based state (safe for useEffect deps)
  const teamsKey = selectedTeams === 'all' ? 'all' : [...(selectedTeams as Set<string>)].sort().join(',')
  const usersKey = selectedUserIds === 'all' ? 'all' : [...(selectedUserIds as Set<string>)].sort().join(',')

  // Compute the effective user ID list from both filters (union)
  function getEffectiveIds(): string[] | null {
    if (selectedTeams === 'all' && selectedUserIds === 'all') return null
    const ids = new Set<string>()
    if (selectedTeams !== 'all') {
      for (const u of allUsers) {
        if (u.team && (selectedTeams as Set<string>).has(u.team)) ids.add(u.id)
      }
    }
    if (selectedUserIds !== 'all') {
      for (const id of selectedUserIds as Set<string>) ids.add(id)
    }
    return [...ids]
  }

  // Fetch tasks whenever either filter changes
  useEffect(() => {
    if (!initialized) return

    const effectiveIds = getEffectiveIds()
    let url: string
    if (!effectiveIds || effectiveIds.length === 0) {
      url = '/api/crm/tasks?assigned_to=all'
    } else {
      url = `/api/crm/tasks?assigned_to=${effectiveIds.join(',')}`
    }

    setLoading(true)
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => {
        const loaded: TaskItem[] = Array.isArray(data.tasks) ? data.tasks : []
        setTasks(loaded)
        const orders: Partial<Record<Status, string[]>> = {}
        for (const col of COLUMNS) {
          const colTasks = loaded
            .filter((t) => t.status === col.id)
            .sort((a, b) => a.sort_order - b.sort_order)
          if (colTasks.length > 0) orders[col.id] = colTasks.map((t) => t.id)
        }
        setColumnOrders(orders)
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsKey, usersKey, initialized])

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const effectiveIds = getEffectiveIds()
  const isMeOnly = effectiveIds !== null && effectiveIds.length === 1 && effectiveIds[0] === currentUser?.id
  const pageTitle = isMeOnly ? 'My Tasks' : 'Team Board'

  const teams = [...new Set(allUsers.map((u) => u.team).filter(Boolean))].sort() as string[]

  // Teams filter
  function handleToggleTeam(team: string) {
    if (selectedTeams === 'all') {
      setSelectedTeams(new Set([team]))
    } else {
      const next = new Set(selectedTeams as Set<string>)
      if (next.has(team)) {
        next.delete(team)
        setSelectedTeams(next.size === 0 ? 'all' : next)
      } else {
        next.add(team)
        setSelectedTeams(next)
      }
    }
    setColumnOrders({})
  }

  function isTeamSelected(team: string) {
    return selectedTeams !== 'all' && (selectedTeams as Set<string>).has(team)
  }

  // Users filter
  function handleSelectAllUsers() {
    setSelectedUserIds('all')
    setColumnOrders({})
  }

  function handleSelectMe() {
    if (!currentUser) return
    setSelectedUserIds(new Set([currentUser.id]))
    setColumnOrders({})
  }

  function handleToggleUser(userId: string) {
    if (selectedUserIds === 'all') {
      setSelectedUserIds(new Set([userId]))
    } else {
      const next = new Set(selectedUserIds as Set<string>)
      if (next.has(userId)) {
        next.delete(userId)
        setSelectedUserIds(next.size === 0 ? 'all' : next)
      } else {
        next.add(userId)
        setSelectedUserIds(next)
      }
    }
    setColumnOrders({})
  }

  function isUserSelected(userId: string) {
    return selectedUserIds !== 'all' && (selectedUserIds as Set<string>).has(userId)
  }

  // ── Ordering ───────────────────────────────────────────────────────────────

  function handleSortChange(mode: 'priority' | 'due_date') {
    setSortBy(mode)
    setColumnOrders({})
  }

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

  const totalOpen = tasks.filter((t) => t.status !== 'completed').length

  // Map user ID → profile photo (prefer profile_image_url, fall back to avatar_url)
  const userPhotoMap = Object.fromEntries(
    allUsers.map((u) => [u.id, u.profile_image_url ?? u.avatar_url])
  )

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

    let insertIndex = colTasks.length
    if (overCard) {
      const overIdx = colTasks.findIndex((t) => t.id === overCard.id)
      if (overIdx !== -1) {
        insertIndex = overCard.half === 'top' ? overIdx : overIdx + 1
      }
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

      const updates = newIds.map((id, i) => ({ id, sort_order: i * 1000 }))
      setTasks((prev) => prev.map((t) => {
        const u = updates.find((u) => u.id === t.id)
        return u ? { ...t, sort_order: u.sort_order } : t
      }))
      fetch('/api/crm/tasks/reorder', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      })
    } else {
      const targetIds = colTasks.map((t) => t.id)
      targetIds.splice(insertIndex, 0, taskId)
      const sourceIds = (columnOrders[fromCol] ?? getColumnTasks(fromCol, filtered).map((t) => t.id))
        .filter((id) => id !== taskId)
      setColumnOrders((prev) => ({
        ...prev,
        [colId]: targetIds,
        [fromCol]: sourceIds,
      }))

      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: colId } : t))
      setUpdatingIds((s) => new Set(s).add(taskId))

      const targetUpdates = targetIds.map((id, i) => ({
        id,
        sort_order: i * 1000,
        ...(id === taskId ? { status: colId } : {}),
      }))
      const sourceUpdates = sourceIds.map((id, i) => ({ id, sort_order: i * 1000 }))
      const allUpdates = [...targetUpdates, ...sourceUpdates]

      setTasks((prev) => prev.map((t) => {
        const u = allUpdates.find((u) => u.id === t.id)
        return u ? { ...t, sort_order: u.sort_order } : t
      }))

      try {
        const res = await fetch('/api/crm/tasks/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: allUpdates }),
        })
        if (!res.ok) throw new Error('Failed')
      } catch {
        setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t))
      } finally {
        setUpdatingIds((s) => { const n = new Set(s); n.delete(taskId); return n })
      }
    }
  }

  // ── Context Menu (Right-click) ─────────────────────────────────────────────

  function handleTaskContextMenu(e: React.MouseEvent, taskId: string) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({
      taskId,
      position: { x: e.clientX, y: e.clientY },
    })
  }

  async function handleQuickUpdate(field: string, value: any) {
    if (!contextMenu) return

    const taskId = contextMenu.taskId
    // Optimistically update local state
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId ? { ...t, [field]: value } : t
      )
    )

    try {
      const response = await fetch(`/api/crm/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })

      if (!response.ok) throw new Error('Failed to update task')

      const updated = await response.json()
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, ...updated } : t))
      )
    } catch (error) {
      console.error('Error updating task:', error)
      // Error is handled by TaskQuickEditPanel, which reverts the field
      throw error
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
        .assignee-select-box {
          display: flex;
          align-items: center;
          min-height: 36px;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 9px;
          cursor: pointer;
          transition: border-color 0.12s;
          position: relative;
          user-select: none;
        }
        .assignee-select-box:hover, .assignee-select-box.open {
          border-color: #9333ea;
        }
        .assignee-chips-area {
          flex: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          padding: 5px 8px;
          min-width: 0;
        }
        .sel-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px 2px 4px;
          background: #ede9fe;
          color: #5b21b6;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          max-width: 130px;
        }
        .sel-chip-remove {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: #7c3aed;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          font-size: 13px;
          line-height: 1;
        }
        .sel-chip-remove:hover {
          background: #c4b5fd;
        }
        .assignee-chevron {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 10px;
          color: #9ca3af;
          border-left: 1px solid #f3f4f6;
          height: 100%;
          align-self: stretch;
          flex-shrink: 0;
        }
        .assignee-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          min-width: 100%;
          width: max-content;
          max-width: 320px;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
          z-index: 50;
          overflow: hidden;
        }
        .dd-section-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #9ca3af;
          padding: 10px 12px 4px;
        }
        .dd-option {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 12px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: #222;
          transition: background 0.08s;
          border: none;
          background: transparent;
          width: 100%;
          text-align: left;
        }
        .dd-option:hover {
          background: #f5f3ff;
        }
        .dd-option.selected {
          color: #6b21a8;
        }
        .dd-check {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1.5px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.1s, border-color 0.1s;
        }
        .dd-check.checked {
          background: #6b1e98;
          border-color: #6b1e98;
        }
        .dd-divider {
          height: 1px;
          background: #f3f4f6;
          margin: 4px 0;
        }
        .dd-scroll {
          max-height: 240px;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: 0 }}>{pageTitle}</h1>
            <p style={{ fontSize: 13, color: '#888', margin: '3px 0 0' }}>
              {loading ? 'Loading…' : `${totalOpen} open · ${tasks.length} total`}
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

        {/* Filters row: Teams + Assignee dropdowns */}
        {allUsers.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>

            {/* ── Teams dropdown ── */}
            {teams.length > 0 && (
              <div ref={teamsDropdownRef} style={{ position: 'relative', flex: '0 0 auto' }}>
                <div
                  className={`assignee-select-box${teamsDropdownOpen ? ' open' : ''}`}
                  onClick={() => { setTeamsDropdownOpen((o) => !o); setUsersDropdownOpen(false) }}
                  style={{ minWidth: 140 }}
                >
                  <div className="assignee-chips-area">
                    {selectedTeams === 'all' ? (
                      <span style={{ fontSize: 13, color: '#888', padding: '1px 2px' }}>All teams</span>
                    ) : (
                      [...(selectedTeams as Set<string>)].map((team) => (
                        <span key={team} className="sel-chip">
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{team}</span>
                          <button
                            className="sel-chip-remove"
                            onClick={(e) => { e.stopPropagation(); handleToggleTeam(team) }}
                            title={`Remove ${team}`}
                          >×</button>
                        </span>
                      ))
                    )}
                  </div>
                  <div className="assignee-chevron">
                    <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      style={{ transform: teamsDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {teamsDropdownOpen && (
                  <div className="assignee-dropdown">
                    <div style={{ padding: '6px 0 2px' }}>
                      <button
                        className={`dd-option${selectedTeams === 'all' ? ' selected' : ''}`}
                        onClick={() => { setSelectedTeams('all'); setColumnOrders({}); setTeamsDropdownOpen(false) }}
                      >
                        <span className={`dd-check${selectedTeams === 'all' ? ' checked' : ''}`}>
                          {selectedTeams === 'all' && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        All teams
                      </button>
                    </div>
                    <div className="dd-divider" />
                    {teams.map((team) => {
                      const sel = isTeamSelected(team)
                      return (
                        <button key={team} className={`dd-option${sel ? ' selected' : ''}`} onClick={() => handleToggleTeam(team)}>
                          <span className={`dd-check${sel ? ' checked' : ''}`}>
                            {sel && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                          </span>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: '#9ca3af', flexShrink: 0 }}>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          {team}
                          <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>
                            {allUsers.filter((u) => u.team === team).length}
                          </span>
                        </button>
                      )
                    })}
                    <div style={{ height: 4 }} />
                  </div>
                )}
              </div>
            )}

            {/* ── Assignee dropdown ── */}
            <div ref={usersDropdownRef} style={{ position: 'relative', flex: '1', maxWidth: 480 }}>
              {(() => {
                const selectedUsers = selectedUserIds === 'all'
                  ? []
                  : allUsers.filter((u) => (selectedUserIds as Set<string>).has(u.id))
                return (
                  <>
                    <div
                      className={`assignee-select-box${usersDropdownOpen ? ' open' : ''}`}
                      onClick={() => { setUsersDropdownOpen((o) => !o); setTeamsDropdownOpen(false) }}
                    >
                      <div className="assignee-chips-area">
                        {selectedUserIds === 'all' ? (
                          <span style={{ fontSize: 13, color: '#888', padding: '1px 2px' }}>All assignees</span>
                        ) : selectedUsers.length === 0 ? (
                          <span style={{ fontSize: 13, color: '#bbb', padding: '1px 2px' }}>Select assignees…</span>
                        ) : (
                          selectedUsers.map((u) => (
                            <span key={u.id} className="sel-chip">
                              <UserAvatar name={u.display_name} avatarUrl={u.profile_image_url ?? u.avatar_url} size={14} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.display_name.split(' ')[0]}</span>
                              <button
                                className="sel-chip-remove"
                                onClick={(e) => { e.stopPropagation(); handleToggleUser(u.id) }}
                                title={`Remove ${u.display_name}`}
                              >×</button>
                            </span>
                          ))
                        )}
                      </div>
                      <div className="assignee-chevron">
                        <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          style={{ transform: usersDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    {usersDropdownOpen && (
                      <div className="assignee-dropdown">
                        <div style={{ padding: '6px 0 2px' }}>
                          <button
                            className={`dd-option${selectedUserIds === 'all' ? ' selected' : ''}`}
                            onClick={() => { handleSelectAllUsers(); setUsersDropdownOpen(false) }}
                          >
                            <span className={`dd-check${selectedUserIds === 'all' ? ' checked' : ''}`}>
                              {selectedUserIds === 'all' && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                            </span>
                            All assignees
                          </button>
                          {currentUser && (
                            <button
                              className={`dd-option${isMeOnly ? ' selected' : ''}`}
                              onClick={() => { handleSelectMe(); setUsersDropdownOpen(false) }}
                            >
                              <span className={`dd-check${isMeOnly ? ' checked' : ''}`}>
                                {isMeOnly && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </span>
                              <UserAvatar name={currentUser.display_name} avatarUrl={currentUser.avatar_url ?? null} size={18} />
                              Me ({currentUser.display_name})
                            </button>
                          )}
                        </div>
                        <div className="dd-divider" />
                        <div className="dd-scroll">
                          {allUsers.map((u) => {
                            const sel = isUserSelected(u.id)
                            return (
                              <button key={u.id} className={`dd-option${sel ? ' selected' : ''}`} onClick={() => handleToggleUser(u.id)}>
                                <span className={`dd-check${sel ? ' checked' : ''}`}>
                                  {sel && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                </span>
                                <UserAvatar name={u.display_name} avatarUrl={u.profile_image_url ?? u.avatar_url} size={22} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</span>
                                {u.team && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 'auto', paddingLeft: 8, flexShrink: 0 }}>{u.team}</span>}
                              </button>
                            )
                          })}
                        </div>
                        <div style={{ height: 4 }} />
                      </div>
                    )}
                  </>
                )
              })()}
            </div>

          </div>
        )}

        {/* Quick-add input */}
        <div style={{ marginBottom: 12 }}>
          <QuickAddTask
            onTaskCreated={(created) => {
              setTasks(prev => [...prev, {
                id: created.id,
                title: created.title,
                category: created.category,
                priority: created.priority as TaskItem['priority'],
                status: created.status as TaskItem['status'],
                due_date: created.due_date,
                progress: created.progress ?? 0,
                sort_order: (created as { sort_order?: number }).sort_order ?? 0,
                assigned_to: currentUser?.id ?? null,
                assigned_user_name: currentUser?.display_name ?? null,
                linked_to_name: null,
                linked_to_type: null,
                opportunity_id: null,
                customer_id: null,
                vendor_id: null,
                contact_id: null,
              }])
            }}
          />
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
              showAssignee={!isMeOnly}
              userPhotoMap={userPhotoMap}
              onDragStart={(e, id) => handleDragStart(e, id, col.id)}
              onDragEnd={handleDragEnd}
              onColumnDragOver={(e) => handleColumnDragOver(e, col.id)}
              onColumnDragLeave={handleColumnDragLeave}
              onCardDragOver={handleCardDragOver}
              onCardDragLeave={handleCardDragLeave}
              onDrop={(e) => handleDrop(e, col.id)}
              onCardClick={(id) => router.push(`/crm/tasks/${id}`)}
              onCardContextMenu={handleTaskContextMenu}
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
              {search ? 'Try a different search term' : 'No tasks assigned to the selected users'}
            </p>
          </div>
        )}
      </div>

      {/* Quick-edit context menu */}
      {contextMenu && (
        (() => {
          const task = tasks.find((t) => t.id === contextMenu.taskId)
          return task ? (
            <TaskQuickEditPanel
              task={task}
              position={contextMenu.position}
              onClose={() => setContextMenu(null)}
              onUpdate={handleQuickUpdate}
              allUsers={allUsers}
            />
          ) : null
        })()
      )}
    </div>
  )
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

function KanbanColumn({
  col,
  isDragOver,
  dragOverCard,
  updatingIds,
  showAssignee,
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
}: {
  col: { id: Status; label: string; color: string; bg: string; dotColor: string; tasks: TaskItem[] }
  isDragOver: boolean
  dragOverCard: DragOverCard | null
  updatingIds: Set<string>
  showAssignee: boolean
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
            showAssignee={showAssignee}
            assigneePhoto={task.assigned_to ? (userPhotoMap[task.assigned_to] ?? null) : null}
            insertIndicator={
              dragOverCard?.id === task.id ? dragOverCard.half : null
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragOver={onCardDragOver}
            onDragLeave={onCardDragLeave}
            onClick={onCardClick}
            onContextMenu={onCardContextMenu}
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
  showAssignee,
  assigneePhoto,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onClick,
  onContextMenu,
}: {
  task: TaskItem
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
      onContextMenu={(e) => onContextMenu(e, task.id)}
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

      {/* Assignee badge (shown in team view) */}
      {showAssignee && task.assigned_user_name && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <UserAvatar name={task.assigned_user_name} avatarUrl={assigneePhoto} size={16} />
          <span style={{ fontSize: 10, color: '#888', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.assigned_user_name}
          </span>
        </div>
      )}
    </div>
  )
}
