'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppUser } from '@/types'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const [, month, day] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`
}

const EMPTY_FORM = { display_name: '', email: '', birth_date: '', start_date: '', is_admin: false }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add user form
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_FORM)
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Inline edit per user
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ display_name: '', birth_date: '', start_date: '' })
  const [saving, setSaving] = useState(false)

  // Admin toggle
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setLoading(false)
    if (Array.isArray(data)) setUsers(data)
    else setError(data.error ?? 'Failed to load users')
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function toggleAdmin(user: AppUser) {
    setTogglingId(user.id)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, is_admin: !user.is_admin }),
    })
    setTogglingId(null)
    loadUsers()
  }

  function startEdit(user: AppUser) {
    setEditingId(user.id)
    setEditForm({
      display_name: user.display_name,
      birth_date: user.birth_date ?? '',
      start_date: user.start_date ?? '',
    })
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

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage user roles and profile data. Pre-load users before they log in, or edit existing users.
          </p>
        </div>
        <button
          onClick={() => { setShowAdd((v) => !v); setAddError(null) }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

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
                type="date"
                value={addForm.birth_date}
                onChange={(e) => setAddForm((f) => ({ ...f, birth_date: e.target.value }))}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
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
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100">
          {users.map((user) => (
            <div key={user.id} className="px-5 py-4">
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
                        type="date"
                        value={editForm.birth_date}
                        onChange={(e) => setEditForm((f) => ({ ...f, birth_date: e.target.value }))}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-purple-400"
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
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-800">{user.display_name}</p>
                      {user.is_admin && (
                        <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admin</span>
                      )}
                      {user.google_id ? (
                        <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Linked</span>
                      ) : (
                        <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Pending</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                    <div className="flex gap-4 mt-1">
                      <p className="text-xs text-slate-300">
                        🎂 {formatDate(user.birth_date)}
                      </p>
                      <p className="text-xs text-slate-300">
                        🏢 Started {formatDate(user.start_date)}
                      </p>
                    </div>
                    {user.last_login_at && (
                      <p className="text-xs text-slate-300 mt-0.5">
                        Last login: {new Date(user.last_login_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(user)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleAdmin(user)}
                      disabled={togglingId === user.id}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 ${
                        user.is_admin
                          ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                      }`}
                    >
                      {togglingId === user.id ? '…' : user.is_admin ? 'Remove Admin' : 'Make Admin'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
