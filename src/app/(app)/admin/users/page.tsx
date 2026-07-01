'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { AppUser, GroupSourceType } from '@/types'
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
type UserGroupSummary = { id: string; name: string; color: string; is_active: boolean; source_type: GroupSourceType }
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

const GROUP_SOURCE_LABELS: Record<GroupSourceType, string> = {
  manual: 'Group',
  department: 'Assignment',
  role: 'Access',
  assignment_pool: 'Assignment',
}

function groupDisplayName(group: UserGroupSummary) {
  return `${GROUP_SOURCE_LABELS[group.source_type]}: ${group.name}`
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
  const [editForm, setEditForm] = useState({ display_name: '', birth_date: '', start_date: '' })
  const [saving, setSaving] = useState(false)

  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null)
  const actionMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openActionMenuId) return
    function handleClick(e: MouseEvent) {
      if (actionMenuRef.current && !actionMenuRef.current.contains(e.target as Node)) {
        setOpenActionMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openActionMenuId])

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

    if (!isEditing) return null

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

    return null
  }

  const visibleUsers = userFilter === 'active' ? activeUsers : deactivatedUsers
  const searchTerm = search.trim().toLocaleLowerCase()
  const filteredUsers = searchTerm
    ? visibleUsers.filter((user) => {
        const roles = (user.roles ?? []).join(' ')
        const groups = (user.groups ?? []).map(groupDisplayName).join(' ')
        return `${user.display_name} ${user.email} ${roles} ${groups}`.toLocaleLowerCase().includes(searchTerm)
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
      sortValue: (user) => (user.groups ?? []).map(groupDisplayName).join(', '),
      render: (user) => <div className="flex flex-wrap gap-1">{groupBadges(user)}</div>,
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
      className: 'w-[80px]',
      headerClassName: 'text-right',
      render: (user) => {
        const rowError = rowErrors[user.id]
        const isOpen = openActionMenuId === user.id
        return (
          <div className="flex flex-col items-end">
            <div className="relative" ref={isOpen ? actionMenuRef : undefined}>
              <button
                type="button"
                onClick={() => setOpenActionMenuId(isOpen ? null : user.id)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-purple-300"
              >
                Actions
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6"/></svg>
              </button>
              {isOpen && (
                <div className="absolute right-0 z-50 mt-1 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {user.deactivated_at ? (
                    <button
                      type="button"
                      onClick={() => { setOpenActionMenuId(null); setConfirmAction({ type: 'deactivate', user, nextDeactivated: false }) }}
                      disabled={deactivatingId === user.id}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
                      {deactivatingId === user.id ? 'Reactivating…' : 'Reactivate'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => { setOpenActionMenuId(null); startEdit(user) }}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => { setOpenActionMenuId(null); setConfirmAction({ type: 'admin', user, nextIsAdmin: !user.is_admin }) }}
                        disabled={togglingId === user.id}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/><path d="M16 11l2 2 4-4"/></svg>
                        {togglingId === user.id ? 'Updating…' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      {!user.is_admin && (
                        <>
                          <div className="my-1 border-t border-slate-100" />
                          <button
                            type="button"
                            onClick={() => { setOpenActionMenuId(null); setConfirmAction({ type: 'impersonate', user }) }}
                            disabled={impersonatingId === user.id}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                            {impersonatingId === user.id ? 'Starting…' : 'Impersonate'}
                          </button>
                        </>
                      )}
                      <div className="my-1 border-t border-slate-100" />
                      <button
                        type="button"
                        onClick={() => { setOpenActionMenuId(null); setConfirmAction({ type: 'deactivate', user, nextDeactivated: true }) }}
                        disabled={deactivatingId === user.id}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                        {deactivatingId === user.id ? 'Deactivating…' : 'Deactivate'}
                      </button>
                    </>
                  )}
                </div>
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
