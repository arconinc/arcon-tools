'use client'

import { useState, useEffect } from 'react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

type GoalRow = { id?: string; user_id: string; year: number; month: number; goal_amount: number }

type UserMeta = { id: string; display_name: string; email: string; team: string | null }

function fmt$(val: number) {
  if (!val) return ''
  return val.toLocaleString('en-US')
}

export default function CrmGoalsPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [users, setUsers] = useState<UserMeta[]>([])
  const [goals, setGoals] = useState<GoalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [savedUserId, setSavedUserId] = useState<string | null>(null)
  // rowEdits: { [userId]: { [month]: string } }
  const [rowEdits, setRowEdits] = useState<Record<string, Record<number, string>>>({})
  const [fillValues, setFillValues] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data: UserMeta[]) => {
        if (Array.isArray(data)) setUsers(data.filter((u) => u.team === 'Sales'))
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch('/api/crm/goals')
      .then((r) => r.json())
      .then((data: GoalRow[]) => {
        if (Array.isArray(data)) setGoals(data)
        setRowEdits({})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [year])

  function getGoalAmount(userId: string, month: number): number {
    return goals.find((g) => g.user_id === userId && g.year === year && g.month === month)?.goal_amount ?? 0
  }

  function getEditValue(userId: string, month: number): string {
    const edit = rowEdits[userId]?.[month]
    if (edit !== undefined) return edit
    const val = getGoalAmount(userId, month)
    return val > 0 ? String(val) : ''
  }

  function handleFillRow(userId: string) {
    const val = (fillValues[userId] ?? '').replace(/,/g, '').trim()
    if (!val) return
    for (let m = 1; m <= 12; m++) {
      handleCellChange(userId, m, val)
    }
    setFillValues((prev) => ({ ...prev, [userId]: '' }))
  }

  function handleCellChange(userId: string, month: number, value: string) {
    setRowEdits((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [month]: value },
    }))
  }

  async function saveRow(userId: string) {
    setSavingUserId(userId)
    try {
      const goalEntries = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const editVal = rowEdits[userId]?.[month]
        const amount = editVal !== undefined
          ? (editVal.trim() === '' ? 0 : Number(editVal.replace(/,/g, '')))
          : getGoalAmount(userId, month)
        return { month, goal_amount: amount }
      })

      const res = await fetch(`/api/crm/goals/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, goals: goalEntries }),
      })

      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? 'Save failed')
        return
      }

      // Merge saved values back into goals state
      const saved = await res.json()
      setGoals((prev) => {
        const next = prev.filter((g) => !(g.user_id === userId && g.year === year))
        return [...next, ...saved]
      })
      setRowEdits((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      setSavedUserId(userId)
      setTimeout(() => setSavedUserId(null), 2000)
    } finally {
      setSavingUserId(null)
    }
  }

  function rowTotal(userId: string): number {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1
      const editVal = rowEdits[userId]?.[month]
      if (editVal !== undefined) return Number(editVal.replace(/,/g, '')) || 0
      return getGoalAmount(userId, month)
    }).reduce((s, v) => s + v, 0)
  }

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Goals</h1>
          <p className="text-sm text-slate-500 mt-0.5">Set monthly revenue targets per salesperson</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          {yearOptions.map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 animate-pulse">
          <div className="h-6 bg-slate-100 rounded w-48 mb-4" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-50 rounded mb-2" />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[160px] sticky left-0 bg-slate-50 z-10">
                    Salesperson
                  </th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[160px]">
                    Fill All
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="text-right px-3 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[90px]">
                      {m}
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide min-w-[100px]">
                    Annual
                  </th>
                  <th className="px-4 py-3 min-w-[80px]" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={16} className="px-4 py-8 text-center text-sm text-slate-400">
                      No salespeople found.
                    </td>
                  </tr>
                )}
                {users.map((u) => {
                  const isDirty = !!rowEdits[u.id]
                  const total = rowTotal(u.id)
                  return (
                    <tr key={u.id} className={isDirty ? 'bg-purple-50' : 'hover:bg-slate-50 transition-colors'}>
                      <td className="px-4 py-2.5 sticky left-0 bg-white z-10" style={{ background: isDirty ? '#faf5ff' : undefined }}>
                        <div className="font-medium text-slate-800 text-sm truncate max-w-[140px]">{u.display_name}</div>
                        <div className="text-xs text-slate-400 truncate max-w-[140px]">{u.email}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={fillValues[u.id] ?? ''}
                              onChange={(e) => setFillValues((prev) => ({ ...prev, [u.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleFillRow(u.id) }}
                              placeholder="0"
                              className="w-20 pl-5 pr-2 py-1.5 text-right text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                            />
                          </div>
                          <button
                            onClick={() => handleFillRow(u.id)}
                            className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
                          >
                            Fill
                          </button>
                        </div>
                      </td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const month = i + 1
                        const val = getEditValue(u.id, month)
                        return (
                          <td key={month} className="px-2 py-2">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={val}
                                onChange={(e) => handleCellChange(u.id, month, e.target.value)}
                                placeholder="0"
                                className="w-full pl-5 pr-2 py-1.5 text-right text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                                style={{ minWidth: 72 }}
                              />
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-700 text-sm whitespace-nowrap">
                        {total > 0 ? `$${total.toLocaleString()}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {savedUserId === u.id ? (
                          <span className="text-xs text-green-600 font-semibold">Saved ✓</span>
                        ) : (
                          <button
                            onClick={() => saveRow(u.id)}
                            disabled={savingUserId === u.id || !isDirty}
                            className="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-40 disabled:cursor-default transition-colors"
                          >
                            {savingUserId === u.id ? 'Saving…' : 'Save'}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Enter monthly revenue targets in USD. Click Save per row to apply.
          </div>
        </div>
      )}
    </div>
  )
}
