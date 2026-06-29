'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppUser } from '@/types'
import { DEPARTMENTS, DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import { DataTable, FilterPillGroup, Modal, type DataTableColumn, type FilterPillOption } from '@/components/ui'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(val: string | null): string {
  if (!val) return '—'
  const parts = val.split('-')
  const [month, day] = parts.length === 2 ? parts : [parts[1], parts[2]]
  const m = parseInt(month, 10)
  const d = parseInt(day, 10)
  if (!m || !d) return '—'
  return `${MONTHS[m - 1]} ${d}`
}

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function MonthDayPicker({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [mm, dd] = value ? value.split('-') : ['', '']
  const monthIdx = mm ? parseInt(mm, 10) - 1 : -1
  const maxDays = monthIdx >= 0 ? DAYS_IN_MONTH[monthIdx] : 31

  function emit(newMm: string, newDd: string) {
    if (!newMm && !newDd) { onChange(''); return }
    const d = parseInt(newDd, 10)
    const maxD = newMm ? DAYS_IN_MONTH[parseInt(newMm, 10) - 1] : 31
    const clampedDd = d > maxD ? String(maxD).padStart(2, '0') : newDd
    onChange(newMm && clampedDd ? `${newMm}-${clampedDd}` : '')
  }

  return (
    <div className={`flex gap-2 ${className ?? ''}`}>
      <select
        value={mm || ''}
        onChange={(e) => emit(e.target.value, dd || '')}
        className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-400 bg-white"
      >
        <option value="">Month</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
        ))}
      </select>
      <select
        value={dd || ''}
        onChange={(e) => emit(mm || '', e.target.value)}
        className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-purple-400 bg-white"
      >
        <option value="">Day</option>
        {Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, '0')).map((d) => (
          <option key={d} value={d}>{parseInt(d, 10)}</option>
        ))}
      </select>
    </div>
  )
}

function formatLastLogin(val: string | null): string {
  if (!val) return '—'
  return new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const EMPTY_FORM = { display_name: '', email: '', birth_date: '', start_date: '', is_admin: false }
type UserStatusFilter = 'active' | 'deactivated'
type UserGroupSummary = { id: string; name: string; color: string; is_active: boolean }
type AdminUser = AppUser & { groups?: UserGroupSummary[] }
type ConfirmAction =
  | { type: 'admin'; user: AdminUser; nextIsAdmin: boolean }
  | { type: 'deactivate'; user: AdminUser; nextDeactivated: boolean }
  | { type: 'impersonate'; user: AdminUser }

function sortUsersByLastName(a: AdminUser, b: AdminUser) {
  const getSortName = (user: AdminUser) => {
    const nameParts = user.display_name.trim().split(/\s+/).filter(Boolean)
    const lastName = nameParts.at(-1) ?? user.email
    return `${lastName} ${user.display_name} ${user.email}`.toLocaleLowerCase()
  }
  return getSortName(a).localeCompare(getSortName(b))
}

async function responseErrorMessage(res: Response, fallback: string) {
  try {
    const data = await res.json()
    return data.error ?? fallback
  } catch {
    return fallback
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userFilter, setUserFilter] = useState<UserStatusFilter>('active')
  const [search, setSearch] = useState('')

  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', birth_date: '', start_date: '', departments: [] as string[] })
  const [saving, setSaving] = useState(false)

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const [allRoles, setAllRoles] = useState<{ id: string; name: string; label: string; color: string }[]>([])
  const [roleManagingId, setRoleManagingId] = useState<string | null>(null)
  const [pendingRoleIds, setPendingRoleIds] = useState<string[]>([])
  const [savingRoles, setSavingRoles] = useState(false)

  useEffect(() => {
    fetch('/api/admin/roles')
      .then(r => r.json())
      .then(data => setAllRoles(Array.isArray(data) ? data : []))
      .catch(() => setAllRoles([]))
  }, [])

  async function openRoleManager(userId: string) {
    setRowErrors((current) => ({ ...current, [userId]: '' }))
    try {
      const res = await fetch(`/api/admin/user-roles?userId=${userId}`)
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to load roles for this user.'))
      }
      const data = await res.json()
      setPendingRoleIds(Array.isArray(data) ? data.map((r: { role_id: string }) => r.role_id) : [])
      setRoleManagingId(userId)
    } catch (err) {
      setRowErrors((current) => ({ ...current, [userId]: err instanceof Error ? err.message : 'Failed to load roles for this user.' }))
    }
  }

  async function saveRoles(userId: string) {
    setSavingRoles(true)
    setRowErrors((current) => ({ ...current, [userId]: '' }))
    try {
      const res = await fetch('/api/admin/user-roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, roleIds: pendingRoleIds }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to save roles.'))
      }
      setRoleManagingId(null)
      loadUsers()
    } catch (err) {
      setRowErrors((current) => ({ ...current, [userId]: err instanceof Error ? err.message : 'Failed to save roles.' }))
    } finally {
      setSavingRoles(false)
    }
  }

  async function handleImpersonate(user: AdminUser) {
    setImpersonatingId(user.id)
    setRowErrors((current) => ({ ...current, [user.id]: '' }))
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: user.id }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to start impersonation.'))
      }
      router.push('/dashboard')
    } catch (err) {
      setRowErrors((current) => ({ ...current, [user.id]: err instanceof Error ? err.message : 'Failed to start impersonation.' }))
    } finally {
      setImpersonatingId(null)
    }
  }

  function confirmTitle(action: ConfirmAction) {
    if (action.type === 'impersonate') return 'Start impersonation?'
    if (action.type === 'admin') return action.nextIsAdmin ? 'Grant admin access?' : 'Remove admin access?'
    return action.nextDeactivated ? 'Deactivate employee?' : 'Reactivate employee?'
  }

  function confirmDescription(action: ConfirmAction) {
    if (action.type === 'impersonate') {
      return `You will leave this page and use the app as ${action.user.display_name}. This is audit-sensitive and should only be used for support or verification.`
    }
    if (action.type === 'admin') {
      return action.nextIsAdmin
        ? `${action.user.display_name} will be able to access admin tools and bypass role checks.`
        : `${action.user.display_name} will lose admin access and rely on assigned roles for restricted areas.`
    }
    return action.nextDeactivated
      ? `${action.user.display_name} will no longer appear as an active employee. Reactivate them later if access should be restored.`
      : `${action.user.display_name} will return to the active employee list. Verify this is intentional before restoring access.`
  }

  function confirmButtonLabel(action: ConfirmAction) {
    if (action.type === 'impersonate') return impersonatingId === action.user.id ? 'Starting…' : 'Start impersonation'
    if (action.type === 'admin') {
      if (togglingId === action.user.id) return 'Updating…'
      return action.nextIsAdmin ? 'Grant admin access' : 'Remove admin access'
    }
    if (deactivatingId === action.user.id) return action.nextDeactivated ? 'Deactivating…' : 'Reactivating…'
    return action.nextDeactivated ? 'Deactivate employee' : 'Reactivate employee'
  }

  async function runConfirmedAction() {
    const action = confirmAction
    if (!action) return
    setConfirmAction(null)

    if (action.type === 'impersonate') {
      await handleImpersonate(action.user)
      return
    }
    if (action.type === 'admin') {
      await toggleAdmin(action.user)
      return
    }
    await toggleDeactivate(action.user)
  }

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const syncRan = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_sync') !== '1') return
    if (syncRan.current) return
    syncRan.current = true
    router.replace('/admin/users', { scroll: false })
    syncFromGoogle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncFromGoogle() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/admin/sync-google-photos', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSyncResult(data.message ?? 'Done')
        loadUsers()
      } else if (res.status === 400 || res.status === 401) {
        setSyncResult(null)
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            scopes: 'openid email profile https://www.googleapis.com/auth/directory.readonly',
            redirectTo: `${window.location.origin}/admin/users?google_sync=1`,
            queryParams: { access_type: 'offline', prompt: 'consent' },
          },
        })
      } else {
        setSyncResult(`Error: ${data.error ?? 'Unknown error'}`)
      }
    } catch (err) {
      setSyncResult(`Error: ${err instanceof Error ? err.message : 'Unable to sync Google photos'}`)
    } finally {
      setSyncing(false)
    }
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/users?include_deactivated=true')
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to load users.'))
      }
      const data = await res.json()
      if (Array.isArray(data)) {
        setUsers(data)
      } else {
        setError(data.error ?? 'Failed to load users.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const activeUsers = users.filter(u => !u.deactivated_at).sort(sortUsersByLastName)
  const deactivatedUsers = users.filter(u => u.deactivated_at).sort(sortUsersByLastName)

  async function toggleAdmin(user: AdminUser) {
    setTogglingId(user.id)
    setRowErrors((current) => ({ ...current, [user.id]: '' }))
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, is_admin: !user.is_admin }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to update admin access.'))
      }
      loadUsers()
    } catch (err) {
      setRowErrors((current) => ({ ...current, [user.id]: err instanceof Error ? err.message : 'Failed to update admin access.' }))
    } finally {
      setTogglingId(null)
    }
  }

  async function toggleDeactivate(user: AdminUser) {
    setDeactivatingId(user.id)
    setRowErrors((current) => ({ ...current, [user.id]: '' }))
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, deactivate: !user.deactivated_at }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, user.deactivated_at ? 'Failed to reactivate user.' : 'Failed to deactivate user.'))
      }
      loadUsers()
    } catch (err) {
      setRowErrors((current) => ({ ...current, [user.id]: err instanceof Error ? err.message : user.deactivated_at ? 'Failed to reactivate user.' : 'Failed to deactivate user.' }))
    } finally {
      setDeactivatingId(null)
    }
  }

  function startEdit(user: AdminUser) {
    setEditingId(user.id)
    setEditForm({
      display_name: user.display_name,
      birth_date: user.birth_date ?? '',
      start_date: user.start_date ?? '',
      departments: user.department ?? [],
    })
  }

  async function saveEdit(userId: string) {
    setSaving(true)
    setRowErrors((current) => ({ ...current, [userId]: '' }))
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          display_name: editForm.display_name,
          birth_date: editForm.birth_date || null,
          start_date: editForm.start_date || null,
          department: editForm.departments.length > 0 ? editForm.departments : null,
        }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to save profile changes.'))
      }
      setEditingId(null)
      loadUsers()
    } catch (err) {
      setRowErrors((current) => ({ ...current, [userId]: err instanceof Error ? err.message : 'Failed to save profile changes.' }))
    } finally {
      setSaving(false)
    }
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: addForm.email,
          display_name: addForm.display_name,
          birth_date: addForm.birth_date || null,
          start_date: addForm.start_date || null,
          is_admin: addForm.is_admin,
        }),
      })
      if (!res.ok) {
        throw new Error(await responseErrorMessage(res, 'Failed to add user.'))
      }
      setShowAdd(false)
      setAddForm(EMPTY_FORM)
      loadUsers()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add user.')
    } finally {
      setAdding(false)
    }
  }

  function renderAvatar(user: AdminUser) {
    const imageUrl = user.profile_image_url || user.avatar_url

    if (imageUrl) {
      return (
        <img
          src={imageUrl}
          alt={user.display_name}
          referrerPolicy="no-referrer"
          className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
        />
      )
    }

    return (
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-800">
        {user.display_name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
      </div>
    )
  }

  function departmentLabels(user: AdminUser) {
    return user.department?.map((d) => DEPARTMENT_DISPLAY_NAMES[d as keyof typeof DEPARTMENT_DISPLAY_NAMES] ?? d) ?? []
  }

  function roleBadges(user: AdminUser) {
    if ((user.roles ?? []).length === 0) return <span className="text-xs text-slate-400">—</span>

    return (user.roles ?? []).map((roleName: string) => {
      const role = allRoles.find(r => r.name === roleName)
      return (
        <span
          key={roleName}
          className="rounded-full px-2 py-0.5 text-xs font-semibold leading-none"
          style={{ background: (role?.color ?? '#6b7280') + '22', color: role?.color ?? '#6b7280' }}
        >
          {role?.label ?? roleName}
        </span>
      )
    })
  }

  function groupBadges(user: AdminUser) {
    if ((user.groups ?? []).length === 0) return <span className="text-xs text-slate-400">—</span>

    return (user.groups ?? []).map((group) => (
      <span
        key={group.id}
        className="rounded-full px-2 py-0.5 text-xs font-semibold leading-none"
        style={{ background: group.color + '22', color: group.color }}
      >
        {group.name}
      </span>
    ))
  }

  function renderExpandedRow(user: AdminUser) {
    const isEditing = editingId === user.id
    const isManagingRoles = roleManagingId === user.id

    if (!isEditing && !isManagingRoles) return null

    if (isEditing) {
      const rowError = rowErrors[user.id]
      return (
        <div>
          <div className="mb-3 flex items-center gap-2">
            {renderAvatar(user)}
            <span className="text-sm font-semibold text-slate-700">{user.display_name}</span>
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>
          <div className="mb-3 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Display name</label>
              <input
                value={editForm.display_name}
                onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="hidden sm:block" />
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Birth date</label>
              <MonthDayPicker
                value={editForm.birth_date}
                onChange={(v) => setEditForm((f) => ({ ...f, birth_date: v }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Start date</label>
              <input
                type="date"
                value={editForm.start_date}
                onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Departments</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
                {DEPARTMENTS.map((d) => (
                  <label key={d} className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={editForm.departments.includes(d)}
                      onChange={(e) => {
                        setEditForm((f) => ({
                          ...f,
                          departments: e.target.checked
                            ? [...f.departments, d]
                            : f.departments.filter((x) => x !== d),
                        }))
                      }}
                      className="accent-purple-600"
                    />
                    {DEPARTMENT_DISPLAY_NAMES[d]}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => saveEdit(user.id)}
              disabled={saving}
              className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
          {rowError && (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              {rowError}
            </p>
          )}
        </div>
      )
    }

    if (isManagingRoles) {
      const rowError = rowErrors[user.id]
      return (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">Assign roles — {user.display_name}</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                {allRoles.map(role => (
                  <label key={role.id} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={pendingRoleIds.includes(role.id)}
                      onChange={e => {
                        setPendingRoleIds(prev =>
                          e.target.checked ? [...prev, role.id] : prev.filter(id => id !== role.id)
                        )
                      }}
                      className="accent-purple-600"
                    />
                    <span className="font-medium px-2 py-0.5 rounded-full text-xs"
                      style={{ background: role.color + '22', color: role.color }}>
                      {role.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveRoles(user.id)}
                  disabled={savingRoles}
                  className="rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-purple-800 disabled:opacity-50"
                >
                  {savingRoles ? 'Saving…' : 'Save Roles'}
                </button>
                <button
                  onClick={() => setRoleManagingId(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
          {rowError && (
            <p className="mt-2 text-xs font-medium text-red-600" role="alert">
              {rowError}
            </p>
          )}
        </div>
      )
    }

    return null
  }

  const visibleUsers = userFilter === 'active' ? activeUsers : deactivatedUsers
  const searchTerm = search.trim().toLocaleLowerCase()
  const filteredUsers = searchTerm
    ? visibleUsers.filter((user) => {
        const labels = departmentLabels(user).join(' ')
        const roles = (user.roles ?? []).join(' ')
        const groups = (user.groups ?? []).map((group) => group.name).join(' ')
        return `${user.display_name} ${user.email} ${labels} ${roles} ${groups}`.toLocaleLowerCase().includes(searchTerm)
      })
    : visibleUsers
  const filterOptions: FilterPillOption<UserStatusFilter>[] = [
    { value: 'active', label: 'Active', color: 'green', count: activeUsers.length },
    { value: 'deactivated', label: 'Deactivated', color: 'slate', count: deactivatedUsers.length },
  ]

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'name',
      header: 'Name',
      sortValue: (user) => {
        const nameParts = user.display_name.trim().split(/\s+/).filter(Boolean)
        const lastName = nameParts.at(-1) ?? user.email
        return `${lastName} ${user.display_name} ${user.email}`
      },
      render: (user) => (
        <div className={`flex items-center gap-2.5 ${user.deactivated_at ? 'opacity-60' : ''}`}>
          {renderAvatar(user)}
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight text-slate-900">{user.display_name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {user.is_admin && (
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold leading-none text-purple-700">Admin</span>
              )}
              {user.deactivated_at ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold leading-none text-slate-600">Deactivated</span>
              ) : user.google_id ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold leading-none text-green-700">Linked</span>
              ) : (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold leading-none text-slate-600">Pending</span>
              )}
            </div>
          </div>
        </div>
      ),
      skeletonWidth: '70%',
    },
    {
      key: 'email',
      header: 'Email',
      sortValue: (user) => user.email,
      render: (user) => <span className="text-xs text-slate-600">{user.email}</span>,
    },
    {
      key: 'groups',
      header: 'Groups',
      sortValue: (user) => (user.groups ?? []).map((group) => group.name).join(', '),
      render: (user) => <div className="flex flex-wrap gap-1">{groupBadges(user)}</div>,
    },
    {
      key: 'departments',
      header: 'Departments',
      sortValue: (user) => departmentLabels(user).join(', '),
      render: (user) => {
        const labels = departmentLabels(user)
        return (
          <div className="flex flex-wrap gap-1">
            {labels.length > 0 ? (
              labels.map((label) => (
                <span key={label} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold leading-none text-blue-700">{label}</span>
              ))
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'roles',
      header: 'Roles',
      sortValue: (user) => (user.roles ?? []).join(', '),
      render: (user) => <div className="flex flex-wrap gap-1">{roleBadges(user)}</div>,
    },
    {
      key: 'birthdate',
      header: 'Birthdate',
      sortValue: (user) => user.birth_date ?? '',
      render: (user) => <span className="text-xs text-slate-500">{formatDate(user.birth_date)}</span>,
    },
    {
      key: 'anniversary',
      header: 'Anniversary',
      sortValue: (user) => user.start_date ?? '',
      render: (user) => <span className="text-xs text-slate-500">{formatDate(user.start_date)}</span>,
    },
    {
      key: 'last_login',
      header: 'Last Login',
      sortValue: (user) => user.last_login_at ? new Date(user.last_login_at) : null,
      render: (user) => <span className="text-xs text-slate-500">{formatLastLogin(user.last_login_at ?? null)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'w-[260px]',
      headerClassName: 'text-right',
      render: (user) => {
        const rowError = rowErrors[user.id]
        return (
          <div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {user.deactivated_at ? (
                <button
                  type="button"
                  onClick={() => setConfirmAction({ type: 'deactivate', user, nextDeactivated: false })}
                  disabled={deactivatingId === user.id}
                  className="rounded-lg border border-green-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                >
                  {deactivatingId === user.id ? 'Reactivating…' : 'Reactivate'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => startEdit(user)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => openRoleManager(user.id)}
                    className="rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
                  >
                    Roles
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'admin', user, nextIsAdmin: !user.is_admin })}
                    disabled={togglingId === user.id}
                    className="rounded-lg border border-purple-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-purple-300 disabled:opacity-50"
                  >
                    {togglingId === user.id ? 'Updating…' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                  {!user.is_admin && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ type: 'impersonate', user })}
                      disabled={impersonatingId === user.id}
                      className="rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:opacity-50"
                    >
                      {impersonatingId === user.id ? 'Starting…' : 'Impersonate'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setConfirmAction({ type: 'deactivate', user, nextDeactivated: true })}
                    disabled={deactivatingId === user.id}
                    className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50"
                  >
                    {deactivatingId === user.id ? 'Deactivating…' : 'Deactivate'}
                  </button>
                </>
              )}
            </div>
            {rowError && (
              <p className="mt-2 text-right text-xs font-medium text-red-600" role="alert">
                {rowError}
              </p>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage user roles and profile data. Pre-load users before they log in, or edit existing users.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={syncFromGoogle}
            disabled={syncing}
            title="Pull current profile photos from Google Workspace for all users"
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            {syncing ? 'Syncing…' : 'Sync from Google'}
          </button>
          <button
            onClick={() => { setShowAdd((v) => !v); setAddError(null) }}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
          >
            {showAdd ? 'Cancel' : '+ Add User'}
          </button>
        </div>
      </div>

      <div className="mb-5 rounded-lg border border-purple-100 bg-purple-50/50 px-4 py-3 text-xs leading-relaxed text-purple-950/75">
        <strong className="font-semibold text-purple-950">Groups</strong> are the new source of truth for people collections.
        <span className="mx-2 text-purple-300" aria-hidden="true">•</span>
        Keep <strong className="font-semibold text-purple-950">Departments</strong> and <strong className="font-semibold text-purple-950">Roles</strong> updated during migration; admins bypass role checks.
      </div>

      {syncResult && (
        <div className={`mb-4 px-4 py-2.5 rounded-xl text-xs font-medium border ${syncResult.startsWith('Error') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>
          {syncResult}
        </div>
      )}

      {showAdd && (
        <form onSubmit={addUser} className="bg-white border border-purple-200 rounded-2xl p-5 mb-4">
          <p className="text-sm font-semibold text-slate-700 mb-3">Pre-load a user</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Full name *</label>
              <input
                required
                value={addForm.display_name}
                onChange={(e) => setAddForm((f) => ({ ...f, display_name: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Work email *</label>
              <input
                required
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
                placeholder="jane@company.com"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Birth date</label>
              <MonthDayPicker
                value={addForm.birth_date}
                onChange={(v) => setAddForm((f) => ({ ...f, birth_date: v }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Start date</label>
              <input
                type="date"
                value={addForm.start_date}
                onChange={(e) => setAddForm((f) => ({ ...f, start_date: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={addForm.is_admin}
                onChange={(e) => setAddForm((f) => ({ ...f, is_admin: e.target.checked }))}
                className="accent-purple-600"
              />
              Admin
            </label>
          </div>
          {addError && <p className="text-xs text-red-600 mb-2">{addError}</p>}
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding…' : 'Add User'}
          </button>
        </form>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{error}</div>
      )}

      {!error && (
        <section aria-label="Employee directory">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterPillGroup
              options={filterOptions}
              value={userFilter}
              onChange={setUserFilter}
              label="Filter employees by status"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="8" strokeWidth={2} />
                  <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search employees…"
                  aria-label="Search employees"
                  className="h-[34px] min-w-[220px] rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <p className="text-xs text-slate-500">
                Showing {loading ? '…' : filteredUsers.length} of {loading ? '…' : visibleUsers.length}
              </p>
            </div>
          </div>

          <DataTable
            rows={filteredUsers}
            columns={columns}
            loading={loading}
            emptyMessage={searchTerm ? 'No employees match this search.' : userFilter === 'active' ? 'No active employees found.' : 'No deactivated employees found.'}
            getRowKey={(user) => user.id}
            renderExpandedRow={renderExpandedRow}
            minWidth="1040px"
          />
        </section>
      )}

      <Modal
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction ? confirmTitle(confirmAction) : 'Confirm action'}
      >
        {confirmAction && (
          <div>
            <p className="text-sm leading-relaxed text-slate-600">
              {confirmDescription(confirmAction)}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runConfirmedAction}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  confirmAction.type === 'deactivate' && confirmAction.nextDeactivated
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-200'
                    : confirmAction.type === 'impersonate'
                      ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-200'
                      : 'bg-purple-700 hover:bg-purple-800 focus:ring-purple-300'
                }`}
              >
                {confirmButtonLabel(confirmAction)}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
