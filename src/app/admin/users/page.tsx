'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AppUser } from '@/types'
import { DEPARTMENTS, DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Handles both MM-DD (birth_date) and YYYY-MM-DD (start_date)
function formatDate(val: string | null): string {
  if (!val) return '—'
  const parts = val.split('-')
  const [month, day] = parts.length === 2 ? parts : [parts[1], parts[2]]
  const m = parseInt(month, 10)
  const d = parseInt(day, 10)
  if (!m || !d) return '—'
  return `${MONTHS[m - 1]} ${d}`
}

const EMPTY_FORM = { display_name: '', email: '', birth_date: '', start_date: '', is_admin: false }

function sortUsersByLastName(a: AppUser, b: AppUser) {
  const getSortName = (user: AppUser) => {
    const nameParts = user.display_name.trim().split(/\s+/).filter(Boolean)
    const lastName = nameParts.at(-1) ?? user.email
    return `${lastName} ${user.display_name} ${user.email}`.toLocaleLowerCase()
  }

  return getSortName(a).localeCompare(getSortName(b))
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDeactivated, setShowDeactivated] = useState(false)
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null)

  // Add user form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Inline edit per user
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', birth_date: '', start_date: '', departments: [] as string[] })
  const [saving, setSaving] = useState(false)

  // Admin toggle
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Deactivate/reactivate
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  // Impersonation
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null)

  // Role management
  const [allRoles, setAllRoles] = useState<{ id: string; name: string; label: string; color: string }[]>([])
  const [roleManagingId, setRoleManagingId] = useState<string | null>(null)
  const [pendingRoleIds, setPendingRoleIds] = useState<string[]>([])
  const [savingRoles, setSavingRoles] = useState(false)
  useEffect(() => {
    fetch('/api/admin/roles').then(r => r.json()).then(data => setAllRoles(Array.isArray(data) ? data : []))
  }, [])

  async function openRoleManager(userId: string) {
    setOpenActionMenuId(null)
    const res = await fetch(`/api/admin/user-roles?userId=${userId}`)
    const data = await res.json()
    setPendingRoleIds(Array.isArray(data) ? data.map((r: { role_id: string }) => r.role_id) : [])
    setRoleManagingId(userId)
  }

  async function saveRoles(userId: string) {
    setSavingRoles(true)
    await fetch('/api/admin/user-roles', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, roleIds: pendingRoleIds }),
    })
    setSavingRoles(false)
    setRoleManagingId(null)
    loadUsers()
  }

  async function handleImpersonate(user: AppUser) {
    setImpersonatingId(user.id)
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: user.id }),
    })
    setImpersonatingId(null)
    if (res.ok) {
      router.push('/dashboard')
    } else {
      const d = await res.json()
      alert(d.error ?? 'Failed to start impersonation')
    }
  }

  // Sync Google photos
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const syncRan = useRef(false)
  const router = useRouter()
  const supabase = createClient()

  // After returning from Google OAuth re-auth, auto-trigger the Directory sync
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('google_sync') !== '1') return
    if (syncRan.current) return
    syncRan.current = true
    // Remove the query param from the URL without re-render
    router.replace('/admin/users', { scroll: false })
    syncFromGoogle()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function syncFromGoogle() {
    setSyncing(true)
    setSyncResult(null)
    const res = await fetch('/api/admin/sync-google-photos', { method: 'POST' })
    const data = await res.json()
    setSyncing(false)
    if (res.ok) {
      setSyncResult(data.message ?? 'Done')
      loadUsers()
    } else if (res.status === 400 || res.status === 401) {
      // No valid directory token — trigger Google re-auth with the required scope
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
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users?include_deactivated=true')
    const data = await res.json()
    setLoading(false)
    if (Array.isArray(data)) setUsers(data)
    else setError(data.error ?? 'Failed to load users')
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  const activeUsers = users.filter(u => !u.deactivated_at).sort(sortUsersByLastName)
  const deactivatedUsers = users.filter(u => u.deactivated_at).sort(sortUsersByLastName)

  async function toggleAdmin(user: AppUser) {
    setOpenActionMenuId(null)
    setTogglingId(user.id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, is_admin: !user.is_admin }),
    })
    setTogglingId(null)
    loadUsers()
  }

  async function toggleDeactivate(user: AppUser) {
    setOpenActionMenuId(null)
    setDeactivatingId(user.id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, deactivate: !user.deactivated_at }),
    })
    setDeactivatingId(null)
    loadUsers()
  }

  function startEdit(user: AppUser) {
    const scrollPos = window.scrollY
    setOpenActionMenuId(null)
    setEditingId(user.id)
    setEditForm({
      display_name: user.display_name,
      birth_date: user.birth_date ?? '',
      start_date: user.start_date ?? '',
      departments: user.department ?? [],
    })
    window.scrollTo(0, scrollPos)
  }

  async function saveEdit(userId: string) {
    setSaving(true)
    await fetch('/api/admin/users', {
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
    setSaving(false)
    setEditingId(null)
    loadUsers()
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setAddError(null)
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
    setAdding(false)
    if (res.ok) {
      setShowAdd(false)
      setAddForm(EMPTY_FORM)
      loadUsers()
    } else {
      const d = await res.json()
      setAddError(d.error ?? 'Failed to add user')
    }
  }

  function UserRow({ user, isDeactivated = false }: { user: AppUser; isDeactivated?: boolean }) {
    const isMenuOpen = openActionMenuId === user.id
    const departmentLabels = user.department?.map((d) => DEPARTMENT_DISPLAY_NAMES[d as keyof typeof DEPARTMENT_DISPLAY_NAMES] ?? d) ?? []
    const imageUrl = user.profile_image_url || user.avatar_url

    return (
      <div key={user.id} className={`px-5 py-4 ${isDeactivated ? 'opacity-50' : ''}`}>
        {editingId === user.id ? (
          /* ── Inline edit mode ── */
          <div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Display name</label>
                <input
                  value={editForm.display_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, display_name: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
                />
              </div>
              <div className="text-xs text-slate-400 pt-5">{user.email}</div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Birth date</label>
                <input
                  type="text"
                  value={editForm.birth_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
                  placeholder="MM-DD"
                  pattern="\d{2}-\d{2}"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Start date</label>
                <input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">Departments</label>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-0.5">
                  {DEPARTMENTS.map((d) => (
                    <label key={d} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.departments.includes(d)}
                        onChange={(e) => {
                          const scrollPos = window.scrollY
                          setEditForm((f) => ({
                            ...f,
                            departments: e.target.checked
                              ? [...f.departments, d]
                              : f.departments.filter((x) => x !== d),
                          }))
                          window.scrollTo(0, scrollPos)
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
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Read mode ── */
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={user.display_name}
                  referrerPolicy="no-referrer"
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, marginTop: 2 }}
                />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#6b1e98', flexShrink: 0, marginTop: 2 }}>
                  {user.display_name.split(' ').filter(Boolean).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-800">{user.display_name}</p>
                  {user.is_admin && (
                    <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                  {isDeactivated ? (
                    <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Deactivated</span>
                  ) : user.google_id ? (
                    <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Linked</span>
                  ) : (
                    <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pending</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-slate-400">Departments:</span>
                  {departmentLabels.length > 0 ? (
                    departmentLabels.map((label) => (
                      <span key={label} className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{label}</span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-300">None assigned</span>
                  )}
                </div>
                {isDeactivated && user.deactivated_at && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    Deactivated: {new Date(user.deactivated_at).toLocaleString()}
                  </p>
                )}
                {!isDeactivated && (
                  <div className="flex gap-4 mt-1">
                    <p className="text-xs text-slate-300">🎂 {formatDate(user.birth_date)}</p>
                    <p className="text-xs text-slate-300">🏢 Started {formatDate(user.start_date)}</p>
                  </div>
                )}
                {!isDeactivated && user.last_login_at && (
                  <p className="text-xs text-slate-300 mt-0.5">
                    Last login: {new Date(user.last_login_at).toLocaleString()}
                  </p>
                )}
                {/* Roles */}
                <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium text-slate-400">Roles:</span>
                  {(user.roles ?? []).length > 0 ? (
                    (user.roles ?? []).map((roleName: string) => {
                      const role = allRoles.find(r => r.name === roleName)
                      return (
                        <span key={roleName} className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ background: (role?.color ?? '#6b7280') + '22', color: role?.color ?? '#6b7280' }}>
                          {role?.label ?? roleName}
                        </span>
                      )
                    })
                  ) : (
                    <span className="text-xs text-slate-300">None assigned</span>
                  )}
                </div>
              </div>
            </div>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setOpenActionMenuId((id) => id === user.id ? null : user.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-1.5"
                aria-haspopup="menu"
                aria-expanded={isMenuOpen}
              >
                Actions
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {isMenuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg" role="menu">
                  {isDeactivated ? (
                    <button
                      type="button"
                      onClick={() => toggleDeactivate(user)}
                      disabled={deactivatingId === user.id}
                      className="block w-full px-3 py-2 text-left text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
                      role="menuitem"
                    >
                      {deactivatingId === user.id ? 'Reactivating…' : 'Reactivate'}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(user)}
                        className="block w-full px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
                        role="menuitem"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => openRoleManager(user.id)}
                        className="block w-full px-3 py-2 text-left text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                        role="menuitem"
                      >
                        Manage Roles
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleAdmin(user)}
                        disabled={togglingId === user.id}
                        className="block w-full px-3 py-2 text-left text-xs font-medium text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                        role="menuitem"
                      >
                        {togglingId === user.id ? 'Updating…' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      {!user.is_admin && (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenActionMenuId(null)
                            handleImpersonate(user)
                          }}
                          disabled={impersonatingId === user.id}
                          className="block w-full px-3 py-2 text-left text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                          role="menuitem"
                        >
                          {impersonatingId === user.id ? 'Starting…' : 'Impersonate'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleDeactivate(user)}
                        disabled={deactivatingId === user.id}
                        className="block w-full px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        role="menuitem"
                      >
                        {deactivatingId === user.id ? 'Deactivating…' : 'Deactivate'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {/* Inline role manager */}
        {roleManagingId === user.id && (
          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 12, paddingTop: 12 }}>
            <p className="text-xs font-semibold text-slate-600 mb-2">Assign Roles</p>
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
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {savingRoles ? 'Saving…' : 'Save Roles'}
              </button>
              <button
                onClick={() => setRoleManagingId(null)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
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

      {/* Add user form */}
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
              <input
                type="text"
                value={addForm.birth_date}
                onChange={(e) => setAddForm((f) => ({ ...f, birth_date: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
                placeholder="MM-DD"
                pattern="\d{2}-\d{2}"
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

      {loading && (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {[1, 2, 3].map((n) => (
            <div key={n} className="px-5 py-4 animate-pulse flex justify-between">
              <div>
                <div className="h-4 bg-slate-100 rounded w-40 mb-1.5" />
                <div className="h-3 bg-slate-100 rounded w-56" />
              </div>
              <div className="h-8 bg-slate-100 rounded-lg w-20" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && (
        <>
          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
            {activeUsers.map((user) => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>

          {deactivatedUsers.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowDeactivated((v) => !v)}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2"
              >
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${showDeactivated ? 'rotate-90' : ''}`}
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                {showDeactivated ? 'Hide' : 'Show'} deactivated ({deactivatedUsers.length})
              </button>
              {showDeactivated && (
                <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
                  {deactivatedUsers.map((user) => (
                    <UserRow key={user.id} user={user} isDeactivated />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
