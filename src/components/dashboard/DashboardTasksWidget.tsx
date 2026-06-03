'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAppUser } from '@/components/layout/AppShell'
import { DEPARTMENT_DISPLAY_NAMES } from '@/lib/task-constants'
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

export function DashboardTasksWidget() {
  const { user } = useAppUser()
  const [tasks, setTasks] = useState<KanbanTask[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams({ assigned_to: user.id, limit: '50' })
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
          href="/my-tasks?view=table"
          style={{ fontSize: 12, color: '#6b1e98', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.textDecoration = 'none' }}
        >
          View All
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Scrollable table */}
      <div style={{ overflowY: 'auto', maxHeight: 320 }}>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Task</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }} className="hidden md:table-cell">Dept / Category</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }} className="hidden md:table-cell">Priority</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }} className="hidden md:table-cell">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {[0, 1, 2, 3, 4].map((j) => (
                  <td key={j} style={{ padding: '10px 16px' }}>
                    <div style={{ height: 14, background: '#f1f5f9', borderRadius: 4, width: j === 0 ? '70%' : '50%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  </td>
                ))}
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                  No tasks assigned to you.
                </td>
              </tr>
            )}
            {!loading && tasks.map((t) => (
              <tr
                key={t.id}
                style={{
                  borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer',
                  boxShadow: t.priority === 'high' ? 'inset 3px 0 0 #fca5a5' : t.priority === 'low' ? 'inset 3px 0 0 #93c5fd' : undefined,
                  background: t.priority === 'high' ? '#fffbfb' : t.priority === 'low' ? '#f8fbff' : undefined,
                }}
                onClick={() => window.open(`/my-tasks?view=table`, '_self')}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(0.97)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = '' }}
              >
                <td style={{ padding: '10px 16px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{t.title}</div>
                  {t.progress > 0 && t.progress < 100 && (
                    <div style={{ marginTop: 4, width: 80, height: 4, background: '#e5e7eb', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#7c3aed', borderRadius: 9999, width: `${t.progress}%` }} />
                    </div>
                  )}
                </td>
                <td style={{ padding: '10px 16px' }} className="hidden md:table-cell">
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
                </td>
                <td style={{ padding: '10px 16px' }} className="hidden md:table-cell">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[t.priority] ?? 'bg-slate-100 text-slate-600'}`}>
                    {t.priority}
                  </span>
                </td>
                <td style={{ padding: '10px 16px' }}>{statusBadge(t.status)}</td>
                <td style={{ padding: '10px 16px' }} className="hidden md:table-cell">
                  <span style={{
                    fontSize: 12,
                    color: isOverdue(t.due_date) && t.status !== 'completed' ? '#dc2626' : '#6b7280',
                    fontWeight: isOverdue(t.due_date) && t.status !== 'completed' ? 600 : 400,
                  }}>
                    {fmtDate(t.due_date)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
