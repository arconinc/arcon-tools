'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type TaskListItem = {
  id: string
  title: string
  category: string | null
  priority: 'low' | 'medium' | 'high'
  status: string
  due_date: string | null
  assigned_to: string | null
  assigned_user_name: string | null
  linked_to_name: string | null
  linked_to_type: 'opportunity' | 'customer' | 'vendor' | 'contact' | null
  opportunity_id: string | null
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
  progress: number
}

const STATUSES = [
  { value: 'not_started', label: 'Not Started', cls: 'bg-slate-100 text-slate-600' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', cls: 'bg-green-100 text-green-700' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval', cls: 'bg-yellow-100 text-yellow-700' },
  { value: 'waiting_on_client_approval', label: 'Waiting on Client', cls: 'bg-orange-100 text-orange-700' },
  { value: 'need_changes', label: 'Need Changes', cls: 'bg-red-100 text-red-600' },
]

const PRIORITY_BADGE: Record<string, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

const CATEGORIES = [
  'Art Order', 'Art Proactive Prospecting', 'Art Rush - Drop Everything',
  'Art Rush - EOD', 'Art Store Mocks', 'Art Waiting on Approval',
  'CSR Order', 'CSR Rush', 'CSR To Do', 'In Progress', 'Need Changes',
  'Need Content', 'Store/Ecommerce Adds', 'Store/Ecommerce Refresh',
  'Store/Ecommerce QDesign', 'Store/Ecommerce Update', 'To Do General',
  'Waiting On Approval', 'Waiting On Client Approval',
  'Warehouse Fulfillment', 'Warehouse Knitting', 'Warehouse Ship', 'Warehouse To Do',
]

function statusBadge(status: string) {
  const s = STATUSES.find((x) => x.value === status)
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${s?.cls ?? 'bg-slate-100 text-slate-600'}`}>
      {s?.label ?? status}
    </span>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(iso: string | null) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

function linkedToHref(task: TaskListItem): string | null {
  if (task.opportunity_id) return `/crm/opportunities/${task.opportunity_id}`
  if (task.customer_id) return `/crm/customers/${task.customer_id}`
  if (task.vendor_id) return `/crm/vendors/${task.vendor_id}`
  if (task.contact_id) return `/crm/contacts/${task.contact_id}`
  return null
}

const LINKED_TYPE_BADGE: Record<string, string> = {
  opportunity: 'bg-purple-100 text-purple-700',
  customer: 'bg-blue-100 text-blue-700',
  vendor: 'bg-orange-100 text-orange-700',
  contact: 'bg-teal-100 text-teal-700',
}

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (categoryFilter) params.set('category', categoryFilter)
    try {
      const res = await fetch(`/api/crm/tasks?${params}`)
      const data = await res.json()
      let items: TaskListItem[] = Array.isArray(data) ? data : []
      if (search) {
        const q = search.toLowerCase()
        items = items.filter(
          (t) =>
            t.title.toLowerCase().includes(q) ||
            (t.assigned_user_name ?? '').toLowerCase().includes(q) ||
            (t.linked_to_name ?? '').toLowerCase().includes(q) ||
            (t.category ?? '').toLowerCase().includes(q)
        )
      }
      setTasks(items)
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter, categoryFilter])

  useEffect(() => {
    const t = setTimeout(fetchTasks, 300)
    return () => clearTimeout(t)
  }, [fetchTasks])

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Tasks</h1>
          <p className="text-sm text-slate-500 mt-0.5">All CRM task activity</p>
        </div>
        <button
          onClick={() => router.push('/crm/tasks/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" strokeWidth={2} />
            <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 max-w-[220px]"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Task</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Category</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Priority</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Due Date</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Assigned To</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden xl:table-cell">Linked To</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <tr key={i}>
                {[...Array(7)].map((_, j) => (
                  <td key={j} className="px-5 py-3.5">
                    <div className="h-4 bg-slate-100 rounded animate-pulse" style={{ width: j === 0 ? '70%' : '50%' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                  {search || statusFilter || categoryFilter
                    ? 'No tasks match your filters.'
                    : 'No tasks yet. Create one to get started.'}
                </td>
              </tr>
            )}
            {!loading && tasks.map((t) => {
              const href = linkedToHref(t)
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/crm/tasks/${t.id}`)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="font-medium text-slate-900 truncate max-w-[280px]">{t.title}</div>
                    {t.progress > 0 && t.progress < 100 && (
                      <div className="mt-1 w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${t.progress}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden lg:table-cell">
                    {t.category
                      ? <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{t.category}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">{statusBadge(t.status)}</td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <span className={
                      isOverdue(t.due_date) && t.status !== 'completed'
                        ? 'text-red-600 font-medium text-xs'
                        : 'text-slate-500 text-xs'
                    }>
                      {fmtDate(t.due_date)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 text-xs hidden xl:table-cell">
                    {t.assigned_user_name ?? '—'}
                  </td>
                  <td className="px-5 py-3.5 hidden xl:table-cell" onClick={(e) => { if (href) e.stopPropagation() }}>
                    {t.linked_to_name && t.linked_to_type ? (
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${LINKED_TYPE_BADGE[t.linked_to_type] ?? 'bg-slate-100 text-slate-600'}`}>
                          {t.linked_to_type.slice(0, 3)}
                        </span>
                        {href ? (
                          <a
                            href={href}
                            className="text-xs text-purple-700 hover:underline truncate max-w-[140px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {t.linked_to_name}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-600 truncate max-w-[140px]">{t.linked_to_name}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && tasks.length > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 text-xs text-slate-400">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
