'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useAppUser } from '@/components/layout/AppShell'
import { TaskKanbanView, UserAvatar, PriorityIcon, type KanbanTask } from './TaskKanbanView'
import { TaskTableView } from './TaskTableView'
import { TaskQuickEditPanel } from './TaskQuickEditPanel'
import QuickAddTask from './QuickAddTask'
import { CreateTaskModal } from './CreateTaskModal'
import { TaskCreatedToast } from './TaskCreatedToast'
import { TaskDetailModal } from './TaskDetailModal'
import { DEPARTMENTS, DEPARTMENT_CATEGORIES, DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import type { CrmTaskDepartment } from '@/types'

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

  // View: kanban | table — from URL param
  const [view, setView] = useState<'kanban' | 'table'>(() =>
    searchParams.get('view') === 'table' ? 'table' : 'kanban'
  )

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

  // Dropdown state
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false)
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
  const deptDropdownRef = useRef<HTMLDivElement>(null)
  const assigneeDropdownRef = useRef<HTMLDivElement>(null)

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

  // Close dropdowns on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target as Node)) setDeptDropdownOpen(false)
      if (assigneeDropdownRef.current && !assigneeDropdownRef.current.contains(e.target as Node)) setAssigneeDropdownOpen(false)
    }
    if (deptDropdownOpen || assigneeDropdownOpen) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [deptDropdownOpen, assigneeDropdownOpen])

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
    setDeptDropdownOpen(false)
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
    setAssigneeDropdownOpen(false)
  }

  function handleSelectAllAssignees() {
    setSelectedUserIds('all')
    syncUrl({ assignees: null })
    setPage(1)
    setAssigneeDropdownOpen(false)
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

  const selectedUsers = selectedUserIds === 'all'
    ? []
    : allUsers.filter((u) => (selectedUserIds as Set<string>).has(u.id))

  const totalOpen = tasks.filter((t) => t.status !== 'completed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <style>{`
        .tb-sort-btn { display:flex;align-items:center;gap:5px;padding:5px 11px;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:#666;transition:background 0.1s,color 0.1s; }
        .tb-sort-btn.active { background:#fff;color:#111;box-shadow:0 1px 3px rgba(0,0,0,0.12); }
        .tb-sort-btn:not(.active):hover { color:#333; }
        .tb-select-box { display:flex;align-items:center;min-height:36px;background:#fff;border:1.5px solid #e5e7eb;border-radius:9px;cursor:pointer;transition:border-color 0.12s;position:relative;user-select:none; }
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
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#6b1e98', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#581c87' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#6b1e98' }}
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

          {/* Department dropdown */}
          {!isDepartmentLocked && (
            <div ref={deptDropdownRef} style={{ position: 'relative' }}>
              <div
                className={`tb-select-box${deptDropdownOpen ? ' open' : ''}`}
                onClick={() => { setDeptDropdownOpen((o) => !o); setAssigneeDropdownOpen(false) }}
                style={{ minWidth: 160 }}
              >
                <div className="tb-chips">
                  {!department
                    ? <span style={{ fontSize: 13, color: '#888', padding: '1px 2px' }}>All departments</span>
                    : <span className="tb-chip"><span>{DEPARTMENT_DISPLAY_NAMES[department as CrmTaskDepartment] ?? department}</span><button className="tb-chip-rm" onClick={(e) => { e.stopPropagation(); handleDeptChange('') }}>×</button></span>
                  }
                </div>
                <div className="tb-chevron">
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    style={{ transform: deptDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {deptDropdownOpen && (
                <div className="tb-dropdown" style={{ minWidth: 180 }}>
                  <div style={{ padding: '6px 0 2px' }}>
                    <button className={`tb-dd-opt${!department ? ' sel' : ''}`} onClick={() => handleDeptChange('')}>
                      <span className={`tb-check${!department ? ' on' : ''}`}>
                        {!department && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      All departments
                    </button>
                  </div>
                  <div className="tb-divider" />
                  {DEPARTMENTS.map((d) => (
                    <button key={d} className={`tb-dd-opt${department === d ? ' sel' : ''}`} onClick={() => handleDeptChange(d)}>
                      <span className={`tb-check${department === d ? ' on' : ''}`}>
                        {department === d && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      {DEPARTMENT_DISPLAY_NAMES[d]}
                      {DEPARTMENT_CATEGORIES[d].length > 0 && (
                        <span style={{ fontSize: 10, color: '#aaa', marginLeft: 'auto' }}>{DEPARTMENT_CATEGORIES[d].length}</span>
                      )}
                    </button>
                  ))}
                  <div style={{ height: 4 }} />
                </div>
              )}
            </div>
          )}

          {/* Category dropdown (only when a dept is selected) */}
          {(department || isDepartmentLocked) && availableCategories.length > 0 && (
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              style={{ padding: '0 12px', height: 36, border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, background: '#fff', color: category ? '#111' : '#888', cursor: 'pointer', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#9333ea' }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb' }}
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
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 12px', height: 36,
              border: `1.5px solid ${showDelegated ? '#9333ea' : '#e5e7eb'}`,
              borderRadius: 9, fontSize: 12, fontWeight: 600,
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
          <div ref={assigneeDropdownRef} style={{ position: 'relative', flex: '0 1 300px' }}>
            <div
              className={`tb-select-box${assigneeDropdownOpen ? ' open' : ''}`}
              onClick={() => { setAssigneeDropdownOpen((o) => !o); setDeptDropdownOpen(false) }}
            >
              <div className="tb-chips">
                {selectedUserIds === 'all'
                  ? <span style={{ fontSize: 13, color: '#888', padding: '1px 2px' }}>All assignees</span>
                  : selectedUsers.length === 0
                  ? <span style={{ fontSize: 13, color: '#bbb', padding: '1px 2px' }}>Select assignees…</span>
                  : selectedUsers.map((u) => (
                    <span key={u.id} className="tb-chip">
                      <UserAvatar name={u.display_name} avatarUrl={u.profile_image_url ?? u.avatar_url} size={14} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.display_name.split(' ')[0]}</span>
                      <button className="tb-chip-rm" onClick={(e) => { e.stopPropagation(); handleToggleUser(u.id) }}>×</button>
                    </span>
                  ))
                }
              </div>
              <div className="tb-chevron">
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  style={{ transform: assigneeDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
            {assigneeDropdownOpen && (
              <div className="tb-dropdown">
                <div style={{ padding: '6px 0 2px' }}>
                  <button className={`tb-dd-opt${selectedUserIds === 'all' ? ' sel' : ''}`} onClick={handleSelectAllAssignees}>
                    <span className={`tb-check${selectedUserIds === 'all' ? ' on' : ''}`}>
                      {selectedUserIds === 'all' && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    All assignees
                  </button>
                  {currentUser && (
                    <button className={`tb-dd-opt${isMeOnly ? ' sel' : ''}`} onClick={handleSelectMe}>
                      <span className={`tb-check${isMeOnly ? ' on' : ''}`}>
                        {isMeOnly && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                      </span>
                      <UserAvatar name={currentUser.display_name} avatarUrl={currentUser.avatar_url ?? null} size={18} />
                      Me ({currentUser.display_name})
                    </button>
                  )}
                </div>
                <div className="tb-divider" />
                <div className="tb-scroll">
                  {allUsers.map((u) => {
                    const sel = selectedUserIds !== 'all' && (selectedUserIds as Set<string>).has(u.id)
                    return (
                      <button key={u.id} className={`tb-dd-opt${sel ? ' sel' : ''}`} onClick={() => handleToggleUser(u.id)}>
                        <span className={`tb-check${sel ? ' on' : ''}`}>
                          {sel && <svg width="10" height="10" fill="none" stroke="#fff" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                        </span>
                        <UserAvatar name={u.display_name} avatarUrl={u.profile_image_url ?? u.avatar_url} size={22} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name}</span>
                        {u.department && u.department.length > 0 && <span style={{ fontSize: 10, color: '#aaa', marginLeft: 'auto', paddingLeft: 8, flexShrink: 0 }}>{u.department.join(', ')}</span>}
                      </button>
                    )
                  })}
                </div>
                <div style={{ height: 4 }} />
              </div>
            )}
          </div>

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
              style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 32, paddingRight: 12, paddingTop: 7, paddingBottom: 7, border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, color: '#333', background: '#fff', outline: 'none' }}
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
          <div onClick={() => handleHideCompleted(!hideCompleted)} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: hideCompleted ? '#6b1e98' : '#d1d5db', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 2, left: hideCompleted ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </div>
            <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Hide completed</span>
          </div>
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
        />
      ) : (
        <TaskTableView
          tasks={tasks}
          loading={loading}
          total={total}
          page={page}
          search={search}
          onPageChange={setPage}
          onRowClick={(id) => setSelectedTaskId(id)}
          onRowContextMenu={handleTaskContextMenu}
        />
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
