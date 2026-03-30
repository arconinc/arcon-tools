'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { CrmTask } from '@/types'
import { formatDate } from './shared'

// ── Task row ──────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: CrmTask }) {
  const priorityColor: Record<string, string> = { high: 'text-red-600 bg-red-50', medium: 'text-amber-600 bg-amber-50', low: 'text-slate-500 bg-slate-100' }
  const statusLabel: Record<string, string> = {
    not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed',
    waiting_on_approval: 'Pending Approval', waiting_on_client_approval: 'Client Approval', need_changes: 'Needs Changes',
  }
  return (
    <Link href={`/crm/tasks/${task.id}`} className="flex items-center px-4 py-3 hover:bg-slate-50 gap-3 border-b border-slate-50 last:border-0 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{task.title}</p>
        {task.due_date && <p className="text-xs text-slate-400 mt-0.5">Due {formatDate(task.due_date)}</p>}
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${priorityColor[task.priority]}`}>{task.priority}</span>
      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">{statusLabel[task.status] ?? task.status}</span>
    </Link>
  )
}

// ── New Task Form ─────────────────────────────────────────────────────────────

function NewTaskForm({ storeId, onCreated }: { storeId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr(null)
    const res = await fetch(`/api/stores/${storeId}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, priority, due_date: dueDate || null }),
    })
    setSaving(false)
    if (!res.ok) { const d = await res.json(); setErr(d.error); return }
    setOpen(false); setTitle(''); setDueDate(''); onCreated()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-800 font-medium px-4 py-2.5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Task
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
      {err && <p className="text-xs text-red-600">{err}</p>}
      <input
        autoFocus
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        required
        placeholder="Task title…"
        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
      />
      <div className="flex gap-2">
        <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2 text-sm text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg transition-colors">
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </div>
    </form>
  )
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

export function TasksTab({ storeId }: { storeId: string }) {
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/stores/${storeId}/tasks`)
    const d = await res.json()
    setLoading(false)
    if (Array.isArray(d)) setTasks(d)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const open = tasks.filter(t => t.status !== 'completed')
  const done = tasks.filter(t => t.status === 'completed')

  return (
    <div>
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(n => <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No tasks yet.</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-4">
          {open.map(t => <TaskRow key={t.id} task={t} />)}
          {done.length > 0 && open.length > 0 && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wide">Completed</div>
          )}
          {done.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      )}
      <NewTaskForm storeId={storeId} onCreated={load} />
    </div>
  )
}
