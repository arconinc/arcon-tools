'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppUser } from '@/components/layout/AppShell'
import { DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
import { DataTable, type DataTableColumn } from '@/components/ui'
import type { KanbanTask } from '@/components/crm/TaskKanbanView'
import type { CrmTaskDepartment } from '@/types'

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

const COLUMNS: DataTableColumn<KanbanTask>[] = [
  {
    key: 'title',
    header: 'Task',
    skeletonWidth: '70%',
    sortValue: (t) => t.title,
    render: (t) => (
      <div>
        <div style={{ fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.title}</div>
        {t.progress > 0 && t.progress < 100 && (
          <div style={{ marginTop: 4, width: 80, height: 4, background: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#7c3aed', borderRadius: 9999, width: `${t.progress}%` }} />
          </div>
        )}
      </div>
    ),
  },
  {
    key: 'dept',
    header: 'Dept / Category',
    className: 'hidden md:table-cell',
    headerClassName: 'hidden md:table-cell',
    render: (t) => (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {t.department && (
          <span style={{ fontSize: 11, background: '#ede9fe', color: '#5b21b6', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
            {DEPARTMENT_DISPLAY_NAMES[t.department as CrmTaskDepartment] ?? t.department}
          </span>
        )}
        {t.category && (
          <span style={{ fontSize: 11, background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: 4, fontWeight: 500 }}>
            {t.category}
          </span>
        )}
        {!t.department && !t.category && <span style={{ color: '#d1d5db' }}>—</span>}
      </div>
    ),
  },
  {
    key: 'priority',
    header: 'Priority',
    className: 'hidden md:table-cell',
    headerClassName: 'hidden md:table-cell',
    sortValue: (t) => ({ low: 0, medium: 1, high: 2 }[t.priority] ?? 0),
    render: (t) => (
      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
        {t.priority}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (t) => t.status,
    render: (t) => statusBadge(t.status),
  },
  {
    key: 'due_date',
    header: 'Due Date',
    className: 'hidden md:table-cell',
    headerClassName: 'hidden md:table-cell',
    sortValue: (t) => t.due_date ?? '',
    render: (t) => (
      <span style={{
        fontSize: 12,
        color: isOverdue(t.due_date) && t.status !== 'completed' ? '#dc2626' : '#6b7280',
        fontWeight: isOverdue(t.due_date) && t.status !== 'completed' ? 600 : 400,
      }}>
        {fmtDate(t.due_date)}
      </span>
    ),
  },
]

export function DashboardTasksWidget() {
  const { user } = useAppUser()
  const router = useRouter()
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const tasksUrl = '/my-tasks?view=table'

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams({ assigned_to: user.id, limit: '50', hide_completed: 'true', order_by: 'created' })
    fetch(`/api/marketing/tasks?${params}`)
      .then((r) => { if (!r.ok) throw new Error('Failed'); return r.json() })
      .then((data) => {
        setTasks(Array.isArray(data.tasks) ? data.tasks : [])
        setTotal(typeof data.total === 'number' ? data.total : 0)
      })
      .catch(() => setTasks([]))
      .finally(() => setLoading(false))
  }, [user])

  const openCount = tasks.filter((t) => t.status !== 'completed').length

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: '13px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>My Tasks</span>
          {!loading && (
            <span style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>
              {openCount} open{total > 50 ? ` · showing 50 of ${total}` : total !== openCount ? ` · ${total} total` : ''}
            </span>
          )}
        </div>
        <Link
          href={tasksUrl}
          style={{ fontSize: 12, color: '#6b1e98', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
        >
          View All
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Table — constrained height, scrollable */}
      <div style={{ overflowY: 'auto', maxHeight: 320 }}>
        <DataTable
          rows={tasks}
          columns={COLUMNS}
          loading={loading}
          emptyMessage="No tasks assigned to you."
          getRowKey={(t) => t.id}
          onRowClick={() => router.push(tasksUrl)}
          resizable
        />
      </div>
    </div>
  )
}
