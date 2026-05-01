'use client'

import type { MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import type { KanbanTask } from './TaskKanbanView'

const PAGE_SIZE = 50

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

const LINKED_TYPE_BADGE: Record<string, string> = {
  opportunity: 'bg-purple-100 text-purple-700',
  customer: 'bg-blue-100 text-blue-700',
  vendor: 'bg-orange-100 text-orange-700',
  contact: 'bg-teal-100 text-teal-700',
}

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

function linkedToHref(t: KanbanTask): string | null {
  if (t.opportunity_id) return `/crm/opportunities/${t.opportunity_id}`
  if (t.customer_id) return `/crm/customers/${t.customer_id}`
  if (t.vendor_id) return `/crm/vendors/${t.vendor_id}`
  if (t.contact_id) return `/crm/contacts/${t.contact_id}`
  return null
}

interface TaskTableViewProps {
  tasks: KanbanTask[]
  loading: boolean
  total: number
  page: number
  search: string
  onPageChange: (p: number) => void
  onRowContextMenu: (e: MouseEvent, taskId: string) => void
}

export function TaskTableView({ tasks, loading, total, page, search, onPageChange, onRowContextMenu }: TaskTableViewProps) {
  const router = useRouter()

  const displayed = (() => {
    if (!search) return tasks
    const q = search.toLowerCase()
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.assigned_user_name ?? '').toLowerCase().includes(q) ||
        (t.linked_to_name ?? '').toLowerCase().includes(q) ||
        (t.category ?? '').toLowerCase().includes(q) ||
        (t.department ?? '').toLowerCase().includes(q)
    )
  })()

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeTo = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="px-6 pb-8">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Task</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Dept / Category</th>
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
            {!loading && displayed.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                  {search ? 'No tasks match your search.' : 'No tasks match the current filters.'}
                </td>
              </tr>
            )}
            {!loading && displayed.map((t) => {
              const href = linkedToHref(t)
              return (
                <tr
                  key={t.id}
                  onClick={() => router.push(`/tasks/${t.id}`)}
                  onContextMenu={(e) => onRowContextMenu(e, t.id)}
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
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <div className="flex gap-1">
                      {t.department && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold w-fit">{t.department}</span>
                      )}
                      {t.category && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">{t.category}</span>
                      )}
                      {!t.department && !t.category && <span className="text-slate-300">—</span>}
                    </div>
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
                          <a href={href} className="text-xs text-purple-700 hover:underline truncate max-w-[140px]" onClick={(e) => e.stopPropagation()}>
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
        {!loading && total > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <span className="text-xs text-slate-400">
              Showing {rangeFrom}–{rangeTo} of {total} task{total !== 1 ? 's' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Previous
                </button>
                <span className="text-xs text-slate-500 px-1">Page {page} of {totalPages}</span>
                <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
