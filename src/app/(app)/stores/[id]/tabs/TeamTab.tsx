'use client'

import { useState, useEffect } from 'react'
import { StoreDetail, StoreAssignment } from '@/types'

interface AppUserSummary { id: string; display_name: string; email: string; avatar_url: string | null; profile_image_url: string | null }

export function TeamTab({ store }: { store: StoreDetail }) {
  const [assignments, setAssignments] = useState<StoreAssignment[]>(store.assignments)
  const [allUsers, setAllUsers] = useState<AppUserSummary[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState<'manager' | 'sales'>('manager')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/users').then(r => r.json()).then(d => { if (Array.isArray(d)) setAllUsers(d) })
  }, [])

  const assignedIds = new Set(assignments.map(a => a.user_id))
  const unassigned = allUsers.filter(u => !assignedIds.has(u.id))

  async function addAssignment() {
    if (!selectedUserId) return
    setSaving(true); setErr(null)
    const res = await fetch(`/api/stores/${store.id}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: selectedUserId, role: selectedRole }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setErr(d.error ?? 'Failed'); return }
    const d = await res.json()
    setAssignments(a => [...a, d])
    setSelectedUserId('')
  }

  async function removeAssignment(assignmentId: string) {
    const res = await fetch(`/api/stores/${store.id}/assignments/${assignmentId}`, { method: 'DELETE' })
    if (res.ok) setAssignments(a => a.filter(x => x.id !== assignmentId))
  }

  return (
    <div className="space-y-4">
      {err && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{err}</div>}

      {assignments.length > 0 && (
        <div className="space-y-2">
          {assignments.map(a => (
            <div key={a.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0 overflow-hidden">
                {a.user?.profile_image_url
                  ? <img src={a.user.profile_image_url} alt="" className="w-full h-full object-cover rounded-full" />
                  : (a.user?.display_name?.[0] ?? '?')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.user?.display_name}</p>
                <p className="text-xs text-slate-400">{a.role}</p>
              </div>
              <button onClick={() => removeAssignment(a.id)}
                className="text-slate-300 hover:text-red-500 transition-colors p-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="flex gap-2 items-center pt-2 border-t border-slate-100">
          <select value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="">Select a team member…</option>
            {unassigned.map(u => (
              <option key={u.id} value={u.id}>{u.display_name} ({u.email})</option>
            ))}
          </select>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value as 'manager' | 'sales')}
            className="w-28 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
            <option value="manager">Manager</option>
            <option value="sales">Sales</option>
          </select>
          <button onClick={addAssignment} disabled={!selectedUserId || saving}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors whitespace-nowrap">
            {saving ? 'Adding…' : 'Add'}
          </button>
        </div>
      )}
    </div>
  )
}
