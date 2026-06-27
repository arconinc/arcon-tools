'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAppUser } from '@/components/layout/AppShell'
import { MultiSelect, type MultiSelectOption } from '@/components/ui/MultiSelect'
import { TaskKanbanView, PriorityIcon, type KanbanTask } from './TaskKanbanView'
import { TaskTableView, type TableRowAction } from './TaskTableView'
import { TaskQuickEditPanel } from './TaskQuickEditPanel'
import QuickAddTask from './QuickAddTask'
import { CreateTaskModal } from './CreateTaskModal'
import { TaskCreatedToast } from './TaskCreatedToast'
import { TaskDetailModal } from './TaskDetailModal'
import { DEPARTMENTS, DEPARTMENT_CATEGORIES, DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'
import { SavedFiltersMenu } from '@/components/ui/SavedFiltersMenu'

// ── Types ─────────────────────────────────────────────────────────────────────

type UserOption = {
  id: string
  display_name: string
  department: string[] | null
  avatar_url: string | null
  profile_image_url: string | null
}

type UserSelection = 'all' | Set<string>

// ── TaskBoard (inner) ─────────────────────────────────────────────────────────

interface TaskBoardProps {
  defaultDepartment?: CrmTaskDepartment
  defaultAssignee?: 'me' | 'all'
}

function TaskBoardInner({ defaultDepartment, defaultAssignee = 'all' }: TaskBoardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { user: currentUser } = useAppUser()

  // View: kanban | table — from URL param, falling back to localStorage preference
  const [view, setView] = useState<'kanban' | 'table'>(() => {
    if (searchParams.get('view') === 'table') return 'table'
    if (searchParams.get('view') === 'kanban') return 'kanban'
    try {
      const stored = localStorage.getItem('taskboard:view')
      if (stored === 'table' || stored === 'kanban') return stored
    } catch {}
    return 'kanban'
  })

  // Filters — initialized from URL params, with prop defaults as fallback
  const [department, setDepartment] = useState<CrmTaskDepartment | ''>(
    () => (searchParams.get('department') as CrmTaskDepartment | null) ?? defaultDepartment ?? ''
  )
  const [category, setCategory] = useState(searchParams.get('category') ?? '')
  const [selectedUserIds, setSelectedUserIds] = useState<UserSelection>(() => {
    const p = searchParams.get('assignees')
    if (p === 'all') return 'all'
    if (p) return new Set(p.split(','))
    return 'all'
  })
  const [showDelegated, setShowDelegated] = useState(searchParams.get('delegated') === 'true')
  const [hideCompleted, setHideCompleted] = useState(searchParams.get('hide_completed') !== 'false')
  const [sortBy, setSortBy] = useState<'priority' | 'due_date'>(
    searchParams.get('sort') === 'due_date' ? 'due_date' : 'priority'
  )
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [page, setPage] = useState(1)

  // State
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [allUsers, setAllUsers] = useState<UserOption[]>([])
  const [initialized, setInitialized] = useState(false)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [taskCreatedToastOpen, setTaskCreatedToastOpen] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const pageKey = pathname.replace(/^\//, '') || 'task-board'
  const [activeFilterId, setActiveFilterId] = useState<string | null>(() => {
    try { return localStorage.getItem(`taskboard:activeFilter:${pageKey}`) ?? null } catch { return null }
  })

  // Persist activeFilterId to localStorage whenever it changes
  useEffect(() => {
    try {
      if (activeFilterId) {
        localStorage.setItem(`taskboard:activeFilter:${pageKey}`, activeFilterId)
      } else {
        localStorage.removeItem(`taskboard:activeFilter:${pageKey}`)
      }
    } catch {}
  }, [activeFilterId, pageKey])

  // (dept and assignee dropdowns managed by MultiSelect component)

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ taskId: string; position: { x: number; y: number } } | null>(null)

  const isDepartmentLocked = !!defaultDepartment

  // Sync URL params on filter changes
  const syncUrl = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [pathname, router, searchParams])



  // Load all users
  useEffect(() => {
    fetch('/api/marketing/users')
      .then((r) => r.json())
      .then((data: UserOption[]) => setAllUsers(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Set initial filter from props once user is loaded
  useEffect(() => {
    if (currentUser && !initialized) {
      const assigneesParam = searchParams.get('assignees')
      if (!assigneesParam) {
        if (defaultAssignee === 'me') {
          setSelectedUserIds(new Set([currentUser.id]))
        }
      }
      setInitialized(true)
    }
  }, [currentUser, initialized, defaultAssignee, searchParams])

  // Stable keys for effect deps
  const usersKey = selectedUserIds === 'all' ? 'all' : [...(selectedUserIds as Set<string>)].sort().join(',')

  // Fetch tasks
  useEffect(() => {
    if (!initialized) return

    const params = new URLSearchParams()

    if (showDelegated) {
      params.set('delegated_by_me', 'true')
      // Also apply assigned_to filter when delegated is true
      if (selectedUserIds !== 'all') {
        params.set('assigned_to', [...(selectedUserIds as Set<string>)].join(','))
      } else {
        params.set('assigned_to', 'all')
      }
    } else if (selectedUserIds !== 'all') {
      params.set('assigned_to', [...(selectedUserIds as Set<string>)].join(','))
    } else {
      params.set('assigned_to', 'all')
    }

    if (hideCompleted) params.set('hide_completed', 'true')
    if (department) params.set('department', department)
    if (category) params.set('category', category)
    if (view === 'table') {
      params.set('page', String(page))
      params.set('limit', '50')
    } else {
      params.set('limit', '200')
    }

    setLoading(true)
    fetch(`/api/marketing/tasks?${params}`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => {
        setTasks(Array.isArray(data.tasks) ? data.tasks : [])
        setTotal(typeof data.total === 'number' ? data.total : 0)
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersKey, department, category, showDelegated, hideCompleted, initialized, view, page, refreshKey])

  // ── Filter helpers ─────────────────────────────────────────────────────────

  const availableCategories = department ? DEPARTMENT_CATEGORIES[department as CrmTaskDepartment] ?? [] : []

  const isMeOnly = selectedUserIds !== 'all' &&
    (selectedUserIds as Set<string>).size === 1 &&
    (selectedUserIds as Set<string>).has(currentUser?.id ?? '')

  const pageTitle = defaultDepartment
    ? `${defaultDepartment} Tasks`
    : isMeOnly
    ? 'My Tasks'
    : 'Task Board'

  const userPhotoMap = Object.fromEntries(
    allUsers.map((u) => [u.id, u.profile_image_url ?? u.avatar_url])
  )

  // ── Filter setters (sync to URL) ───────────────────────────────────────────

  function handleDeptChange(d: CrmTaskDepartment | '') {
    setDepartment(d)
    setCategory('')
    setPage(1)
    syncUrl({ department: d || null, category: null })
  }

  function handleCategoryChange(c: string) {
    setCategory(c)
    setPage(1)
    syncUrl({ category: c || null })
  }

  function handleToggleUser(userId: string) {
    const next = selectedUserIds === 'all' ? new Set([userId]) : new Set(selectedUserIds as Set<string>)
    if (selectedUserIds !== 'all' && (selectedUserIds as Set<string>).has(userId)) {
      next.delete(userId)
      const result = next.size === 0 ? 'all' : next
      setSelectedUserIds(result)
      syncUrl({ assignees: result === 'all' ? 'all' : [...next].join(',') })
    } else {
      next.add(userId)
      setSelectedUserIds(next)
      syncUrl({ assignees: [...next].join(',') })
    }
    setPage(1)
  }

  function handleSelectMe() {
    if (!currentUser) return
    const next = new Set([currentUser.id])
    setSelectedUserIds(next)
    syncUrl({ assignees: currentUser.id })
    setPage(1)
  }

  function handleSelectAllAssignees() {
    setSelectedUserIds('all')
    syncUrl({ assignees: null })
    setPage(1)
  }

  function handleToggleDelegated() {
    const next = !showDelegated
    setShowDelegated(next)
    if (next) {
      setSelectedUserIds('all')
      syncUrl({ delegated: 'true', assignees: null })
    } else {
      syncUrl({ delegated: null })
    }
    setPage(1)
  }

  function handleHideCompleted(h: boolean) {
    setHideCompleted(h)
    syncUrl({ hide_completed: h ? null : 'false' })
  }

  function handleSortChange(s: 'priority' | 'due_date') {
    setSortBy(s)
    syncUrl({ sort: s === 'priority' ? null : s })
  }

  function handleSearchChange(s: string) {
    setSearch(s)
    syncUrl({ search: s || null })
  }

  function handleViewChange(v: 'kanban' | 'table') {
    setView(v)
    setPage(1)
    syncUrl({ view: v === 'kanban' ? null : v })
    try { localStorage.setItem('taskboard:view', v) } catch {}
  }

  // ── Saved filter helpers ───────────────────────────────────────────────────

  function getCurrentFilterConfig(): Record<string, unknown> {
    return {
      view,
      department: department || null,
      category: category || null,
      assignees: selectedUserIds === 'all' ? 'all' : [...(selectedUserIds as Set<string>)],
      showDelegated,
      hideCompleted,
      sortBy,
      search: search || null,
    }
  }

  function handleLoadFilter(config: Record<string, unknown>) {
    const newView = (config.view as 'kanban' | 'table') ?? 'kanban'
    const newDept = (config.department as CrmTaskDepartment | null) ?? ''
    const newCategory = (config.category as string | null) ?? ''
    const newAssignees = config.assignees
    const newShowDelegated = config.showDelegated === true
    const newHideCompleted = config.hideCompleted !== false
    const newSortBy = (config.sortBy as 'priority' | 'due_date') ?? 'priority'
    const newSearch = (config.search as string | null) ?? ''

    let newSelectedUserIds: UserSelection = 'all'
    if (newAssignees === 'all' || !newAssignees) {
      newSelectedUserIds = 'all'
    } else if (Array.isArray(newAssignees)) {
      newSelectedUserIds = new Set(newAssignees as string[])
    }

    setView(newView)
    setDepartment(newDept)
    setCategory(newCategory)
    setSelectedUserIds(newSelectedUserIds)
    setShowDelegated(newShowDelegated)
    setHideCompleted(newHideCompleted)
    setSortBy(newSortBy)
    setSearch(newSearch)
    setPage(1)

    // Sync to URL
    const assigneesStr = newSelectedUserIds === 'all' ? null : [...(newSelectedUserIds as Set<string>)].join(',')
    syncUrl({
      view: newView === 'kanban' ? null : newView,
      department: newDept || null,
      category: newCategory || null,
      assignees: assigneesStr,
      delegated: newShowDelegated ? 'true' : null,
      hide_completed: newHideCompleted ? null : 'false',
      sort: newSortBy === 'priority' ? null : newSortBy,
      search: newSearch || null,
    })
  }

  // ── Kanban reorder ─────────────────────────────────────────────────────────

  async function handleReorder(updates: { id: string; sort_order: number; status?: string }[]) {
    // Optimistically update local tasks
    setTasks((prev) => prev.map((t) => {
      const u = updates.find((u) => u.id === t.id)
      if (!u) return t
      return { ...t, sort_order: u.sort_order, ...(u.status ? { status: u.status as KanbanTask['status'] } : {}) }
    }))
    await fetch('/api/marketing/tasks/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    })
  }

  // ── Assign to me ──────────────────────────────────────────────────────────

  async function handleDeleteTask(taskId: string) {
    const response = await fetch(`/api/marketing/tasks/${taskId}`, { method: 'DELETE' })
    if (!response.ok) throw new Error('Failed to delete task')
    setTasks((prev) => prev.filter((t) => t.id !== taskId))
    setTotal((prev) => prev - 1)
    setContextMenu(null)
  }

  async function handleAssignToMe(taskId: string) {
    if (!currentUser) return
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, assigned_to: currentUser.id, assigned_user_name: currentUser.display_name } : t))
    await fetch(`/api/marketing/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_to: currentUser.id }),
    })
  }

  // ── Row actions (table view) ───────────────────────────────────────────────

  async function handleRowAction(taskId: string, action: TableRowAction) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    let patch: Record<string, unknown>
    if (action === 'send_for_approval') {
      patch = { status: 'waiting_on_approval' }
      // Reassign to creator when creator is known (mirrors task detail page behaviour)
      if (task.created_by) patch.assigned_to = task.created_by
    } else {
      patch = { status: 'completed' }
    }

    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...patch } : t))

    const res = await fetch(`/api/marketing/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })

    if (!res.ok) {
      // Roll back on error
      setTasks((prev) => prev.map((t) => t.id === taskId ? task : t))
      throw new Error('Failed to update task')
    }

    const updated = await res.json()
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updated } : t))
  }

  // ── Context menu ──────────────────────────────────────────────────────────

  function handleTaskContextMenu(e: React.MouseEvent, taskId: string) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ taskId, position: { x: e.clientX, y: e.clientY } })
  }

  async function handleQuickUpdate(field: string, value: unknown) {
    if (!contextMenu) return
    const taskId = contextMenu.taskId
    const patch = field === 'assignment' && value && typeof value === 'object'
      ? value as { department: string | null; category: string | null }
      : { [field]: value }

    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...patch } : t))
    const response = await fetch(`/api/marketing/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!response.ok) throw new Error('Failed to update task')
    const updated = await response.json()
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updated } : t))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const totalOpen = tasks.filter((t) => t.status !== 'completed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .tb-sort-btn { display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#666;transition:background 0.15s,color 0.15s,box-shadow 0.15s; }
        .tb-sort-btn.active { background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,0.10); }
        .tb-sort-btn:not(.active):hover { color:#333; }
        .tb-action-btn { display:flex;align-items:center;gap:7px;padding:8px 16px;background:#6b1e98;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:background 0.15s,transform 0.15s; }
        .tb-action-btn:hover { background:#5b21b6; }
        .tb-action-btn:active { transform:translateY(1px); }
        .tb-focusable:focus-visible,.tb-sort-btn:focus-visible,.tb-dd-opt:focus-visible,.tb-action-btn:focus-visible,.tb-chip-rm:focus-visible,.tb-switch:focus-visible { outline:2px solid #a855f7;outline-offset:2px; }
        .tb-select-box { display:flex;align-items:center;min-height:36px;background:#fff;border:1.5px solid #e5e7eb;border-radius:8px;cursor:pointer;transition:border-color 0.15s,box-shadow 0.15s;position:relative;user-select:none; }
        .tb-select-box:hover,.tb-select-box.open { border-color:#9333ea; }
        .tb-chips { flex:1;display:flex;flex-wrap:wrap;gap:5px;padding:5px 8px;min-width:0; }
        .tb-chip { display:inline-flex;align-items:center;gap:4px;padding:2px 6px 2px 4px;background:#ede9fe;color:#5b21b6;border-radius:20px;font-size:11px;font-weight:600;white-space:nowrap;max-width:130px; }
        .tb-chip-rm { display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;border:none;background:transparent;color:#7c3aed;cursor:pointer;padding:0;flex-shrink:0;font-size:13px;line-height:1; }
        .tb-chip-rm:hover { background:#c4b5fd; }
        .tb-chevron { display:flex;align-items:center;justify-content:center;padding:0 10px;color:#9ca3af;border-left:1px solid #f3f4f6;height:100%;align-self:stretch;flex-shrink:0; }
        .tb-dropdown { position:absolute;top:calc(100% + 6px);left:0;min-width:100%;width:max-content;max-width:320px;background:#fff;border:1.5px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:50;overflow:hidden; }
        .tb-dd-label { font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#9ca3af;padding:10px 12px 4px; }
        .tb-dd-opt { display:flex;align-items:center;gap:9px;padding:7px 12px;cursor:pointer;font-size:13px;font-weight:500;color:#222;transition:background 0.08s;border:none;background:transparent;width:100%;text-align:left; }
        .tb-dd-opt:hover { background:#f5f3ff; }
        .tb-dd-opt.sel { color:#6b21a8; }
        .tb-check { width:16px;height:16px;border-radius:4px;border:1.5px solid #d1d5db;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background 0.1s,border-color 0.1s; }
        .tb-check.on { background:#6b1e98;border-color:#6b1e98; }
        .tb-divider { height:1px;background:#f3f4f6;margin:4px 0; }
        .tb-scroll { max-height:240px;overflow-y:auto;overscroll-behavior:contain; }
        @media (prefers-reduced-motion: reduce) {
          .tb-sort-btn,.tb-action-btn,.tb-select-box,.tb-check,.tb-chip-rm { transition:none !important; }
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* View toggle */}
            <div style={{ display: 'flex', background: '#f0f0f0', borderRadius: 8, padding: 3, gap: 2 }}>
              <button
                className={`tb-sort-btn${view === 'kanban' ? ' active' : ''}`}
                onClick={() => handleViewChange('kanban')}
                title="Kanban view"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="5" height="18" rx="1" strokeWidth={2} />
                  <rect x="10" y="3" width="5" height="12" rx="1" strokeWidth={2} />
                  <rect x="17" y="3" width="5" height="15" rx="1" strokeWidth={2} />
                </svg>
                Board
              </button>
              <button
                className={`tb-sort-btn${view === 'table' ? ' active' : ''}`}
                onClick={() => handleViewChange('table')}
                title="List view"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                List
              </button>
            </div>
            <button
              onClick={() => setCreateTaskOpen(true)}
              className="tb-action-btn"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              New Task
            </button>
          </div>
        </div>

        {/* Filter row 1: Department + Category */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {/* Saved filter views */}
          <SavedFiltersMenu
            pageKey={pageKey}
            currentConfig={getCurrentFilterConfig()}
            onLoad={handleLoadFilter}
            activeFilterId={activeFilterId}
            onActiveFilterIdChange={setActiveFilterId}
            defaultActiveFilterId={activeFilterId}
          />

          {/* Department dropdown */}
          {!isDepartmentLocked && (
            <MultiSelect
              single
              options={DEPARTMENTS.map((d): MultiSelectOption => ({
                value: d,
                label: DEPARTMENT_DISPLAY_NAMES[d],
                meta: DEPARTMENT_CATEGORIES[d].length > 0 ? String(DEPARTMENT_CATEGORIES[d].length) : undefined,
              }))}
              value={department ? [department] : []}
              onChange={([d]) => handleDeptChange((d ?? '') as CrmTaskDepartment | '')}
              placeholder="All departments"
              label="Filter by department"
              dropdownWidth={220}
            />
          )}

          {/* Category dropdown (only when a dept is selected) */}
          {(department || isDepartmentLocked) && availableCategories.length > 0 && (
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-[13px] text-gray-700 outline-none transition-colors focus:border-purple-500 focus:ring-2 focus:ring-purple-300"
            >
              <option value="">All categories</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          {/* Delegated tasks toggle */}
          <button
            onClick={handleToggleDelegated}
            className="tb-focusable"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 12px', height: 36,
              border: `1.5px solid ${showDelegated ? '#9333ea' : '#e5e7eb'}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: showDelegated ? '#f3e8ff' : '#fff',
              color: showDelegated ? '#6b1e98' : '#666',
              cursor: 'pointer',
            }}
          >
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
              Tasks I've Delegated
          </button>
        </div>

        {/* Filter row 2: Assignee dropdown + search + sort + hide completed */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>

          {/* Assignee dropdown */}
          <MultiSelect
            options={allUsers.map((u): MultiSelectOption => ({
              value: u.id,
              label: u.display_name,
              chipLabel: u.display_name.split(' ')[0],
              meta: u.department?.join(', ') || undefined,
            }))}
            value={selectedUserIds === 'all' ? [] : [...(selectedUserIds as Set<string>)]}
            onChange={(ids) => {
              if (ids.length === 0) {
                handleSelectAllAssignees()
              } else {
                const next = new Set(ids)
                setSelectedUserIds(next)
                syncUrl({ assignees: ids.join(',') })
                setPage(1)
              }
            }}
            placeholder="All assignees"
            label="Filter by assignee"
            dropdownWidth={300}
            topActions={currentUser ? (close) => (
              <button
                className={`ms-opt${isMeOnly ? ' ms-sel' : ''}`}
                onClick={(e) => { e.stopPropagation(); handleSelectMe(); close() }}
              >
                <span className={`ms-check${isMeOnly ? ' ms-on' : ''}`}>
                  {isMeOnly && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </span>
                Me ({currentUser.display_name})
              </button>
            ) : undefined}
            className="flex-none"
          />

          {/* Search */}
          <div style={{ position: 'relative', flex: '1', minWidth: 160, maxWidth: 280 }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#aaa', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search tasks…"
              className="tb-focusable"
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#333', background: '#fff', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#9333ea' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb' }}
            />
          </div>

          {/* Sort */}
          {view === 'kanban' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#f0f0f0', borderRadius: 8, padding: '3px' }}>
              <span style={{ fontSize: 11, color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 6px' }}>Sort</span>
              <button className={`tb-sort-btn${sortBy === 'priority' ? ' active' : ''}`} onClick={() => handleSortChange('priority')}>
                <PriorityIcon priority="high" /> Priority
              </button>
              <button className={`tb-sort-btn${sortBy === 'due_date' ? ' active' : ''}`} onClick={() => handleSortChange('due_date')}>
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 11h14M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Due Date
              </button>
            </div>
          )}

          {/* Hide completed */}
          <button
            type="button"
            role="switch"
            aria-checked={hideCompleted}
            onClick={() => handleHideCompleted(!hideCompleted)}
            className="tb-switch"
            style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none', border: 'none', background: 'transparent', padding: '8px 2px', minHeight: 36 }}
          >
            <div style={{ width: 36, height: 20, borderRadius: 10, background: hideCompleted ? '#6b1e98' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: hideCompleted ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Hide completed</span>
          </button>
        </div>

        {/* Quick-add */}
        <div style={{ marginBottom: 12 }}>
          <QuickAddTask
            defaultDepartment={department || undefined}
            onTaskCreated={(created) => {
              setTasks((prev) => [...prev, {
                id: created.id,
                title: created.title,
                department: created.department ?? null,
                category: created.category,
                priority: created.priority as KanbanTask['priority'],
                status: created.status as KanbanTask['status'],
                due_date: created.due_date,
                progress: created.progress ?? 0,
                sort_order: created.sort_order ?? 0,
                assigned_to: currentUser?.id ?? null,
                assigned_user_name: currentUser?.display_name ?? null,
                linked_to_name: null,
                linked_to_type: null,
                opportunity_id: null,
                customer_id: null,
                vendor_id: null,
                contact_id: null,
                created_by: currentUser?.id ?? null,
                created_by_name: currentUser?.display_name ?? null,
                delegators: [],
              }])
              setTotal((t) => t + 1)
            }}
          />
        </div>
      </div>

      {/* Board / Table */}
      {view === 'kanban' ? (
        <TaskKanbanView
          tasks={tasks}
          loading={loading}
          hideCompleted={hideCompleted}
          sortBy={sortBy}
          search={search}
          showAssignee={!isMeOnly}
          showAssignToMe={!!defaultDepartment}
          userPhotoMap={userPhotoMap}
          onCardClick={(id) => setSelectedTaskId(id)}
          onCardContextMenu={handleTaskContextMenu}
          onReorder={handleReorder}
          onAssignToMe={handleAssignToMe}
          onCardAction={handleRowAction}
        />
      ) : (
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <TaskTableView
            tasks={tasks}
            loading={loading}
            total={total}
            page={page}
            search={search}
            onPageChange={setPage}
            onRowClick={(id) => setSelectedTaskId(id)}
            onRowContextMenu={handleTaskContextMenu}
            onRowAction={handleRowAction}
          />
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (() => {
        const task = tasks.find((t) => t.id === contextMenu.taskId)
        return task ? (
          <TaskQuickEditPanel
            task={task}
            position={contextMenu.position}
            onClose={() => setContextMenu(null)}
            onUpdate={handleQuickUpdate}
            onDelete={handleDeleteTask}
            allUsers={allUsers}
          />
        ) : null
      })()}
      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        defaultDepartment={defaultDepartment}
        onCreated={() => {
          setRefreshKey((key) => key + 1)
          setTaskCreatedToastOpen(true)
        }}
      />
      <TaskCreatedToast
        show={taskCreatedToastOpen}
        onClose={() => setTaskCreatedToastOpen(false)}
      />
      <TaskDetailModal
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onTaskUpdated={(updated) => {
          setTasks((prev) => prev.map((task) => task.id === updated.id ? {
            ...task,
            title: updated.title,
            department: updated.department,
            category: updated.category,
            priority: updated.priority as KanbanTask['priority'],
            status: updated.status as KanbanTask['status'],
            due_date: updated.due_date,
            progress: updated.progress,
            assigned_to: updated.assigned_to,
            assigned_user_name: updated.assigned_user?.display_name ?? null,
          } : task))
        }}
        onTaskDeleted={() => {
          setTasks((prev) => prev.filter((task) => task.id !== selectedTaskId))
          setSelectedTaskId(null)
        }}
      />
    </div>
  )
}

// ── Public export (wraps in Suspense for useSearchParams) ─────────────────────

export function TaskBoard(props: TaskBoardProps) {
  return (
    <Suspense fallback={<div />}>
      <TaskBoardInner {...props} />
    </Suspense>
  )
}
