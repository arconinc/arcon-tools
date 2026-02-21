'use client'

import { useState, useEffect, useCallback } from 'react'
import { AppUser } from '@/types'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, is_admin: !user.is_admin }),
    })
    setTogglingId(null)
    if (res.ok) loadUsers()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="text-sm text-slate-500 mt-1">Manage user roles. New users are created automatically on first login.</p>
      </div>

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
            <div key={user.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-800">{user.display_name}</p>
                  {user.is_admin && (
                    <span className="text-xs font-medium bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Admin</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}
                </p>
              </div>
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
          ))}
        </div>
      )}
    </div>
  )
}
