'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

type PipelineOpp = {
  id: string; name: string; customer_name: string | null
  value: number | null; probability: number | null
  pipeline_stage: string | null; forecast_close_date: string | null; status: string
}

type ClosingSoonOpp = {
  id: string; name: string; customer_name: string | null; assigned_user_name: string | null
  value: number | null; pipeline_stage: string | null; forecast_close_date: string | null
}

type LeaderboardEntry = { user_id: string; display_name: string; open_value: number }

type GoalEntry = {
  user_id: string; display_name: string; goal_amount: number; won_amount: number; pct: number
}

type TaskItem = {
  id: string; title: string; status: string; priority: string
  due_date: string | null; category: string | null; linked_name: string | null
}

type DashboardData = {
  my_pipeline: PipelineOpp[]
  my_pipeline_total: number
  closing_soon: ClosingSoonOpp[]
  leaderboard: LeaderboardEntry[]
  goal_progress: GoalEntry[]
  my_tasks: TaskItem[]
  current_month: number
  current_year: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt$(val: number | null) {
  if (val == null || val === 0) return '$0'
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`
  return `$${val.toLocaleString()}`
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const TASK_STATUS_BADGE: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_on_approval: 'bg-yellow-100 text-yellow-700',
  waiting_on_client_approval: 'bg-orange-100 text-orange-700',
  need_changes: 'bg-red-100 text-red-600',
}

const TASK_STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  waiting_on_approval: 'Waiting Approval',
  waiting_on_client_approval: 'Waiting Client',
  need_changes: 'Need Changes',
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, action, href }: { title: string; action?: string; href?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
      <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      {action && href && (
        <Link href={href} className="text-xs font-semibold text-purple-700 hover:text-purple-900">
          {action}
        </Link>
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="px-5 py-6 text-sm text-slate-400 text-center">{text}</div>
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function CrmDashboardPage() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/crm/dashboard')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return }
        setData(d)
      })
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-5">
          <div className="h-8 bg-slate-100 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-100 rounded-2xl" />)}
          </div>
          <div className="grid grid-cols-2 gap-5">
            {[...Array(4)].map((_, i) => <div key={i} className="h-48 bg-slate-100 rounded-2xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error ?? 'Could not load dashboard'}
        </div>
      </div>
    )
  }

  const monthLabel = `${MONTH_NAMES[data.current_month - 1]} ${data.current_year}`

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CRM Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your pipeline, goals, and team activity</p>
        </div>
        <button
          onClick={() => router.push('/crm/opportunities/new')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Opportunity
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">My Open Pipeline</div>
          <div className="text-3xl font-bold text-slate-900">{fmt$(data.my_pipeline_total)}</div>
          <div className="text-xs text-slate-400 mt-1">{data.my_pipeline.length} open opportunit{data.my_pipeline.length !== 1 ? 'ies' : 'y'}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Closing Soon</div>
          <div className="text-3xl font-bold text-amber-600">{data.closing_soon.length}</div>
          <div className="text-xs text-slate-400 mt-1">due within 30 days</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Tasks Overdue</div>
          <div className="text-3xl font-bold text-red-600">{data.my_tasks.length}</div>
          <div className="text-xs text-slate-400 mt-1">due today or past due</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* My Pipeline */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <SectionHeader title="My Pipeline" action="View all →" href="/crm/opportunities" />
          {data.my_pipeline.length === 0 ? (
            <EmptyState text="No open opportunities assigned to you." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.my_pipeline.slice(0, 8).map((o) => (
                <div
                  key={o.id}
                  onClick={() => router.push(`/crm/opportunities/${o.id}`)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{o.name}</div>
                    <div className="text-xs text-slate-400 truncate">{o.customer_name ?? 'No customer'}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-slate-700">{fmt$(o.value)}</div>
                    {o.forecast_close_date && (
                      <div className="text-xs text-slate-400">{fmtDate(o.forecast_close_date)}</div>
                    )}
                  </div>
                </div>
              ))}
              {data.my_pipeline.length > 8 && (
                <div className="px-5 py-3 text-xs text-slate-400">
                  +{data.my_pipeline.length - 8} more — <Link href="/crm/opportunities" className="text-purple-700 hover:underline">view all</Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Closing Soon */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <SectionHeader title="Closing Soon (30 days)" action="View all →" href="/crm/opportunities" />
          {data.closing_soon.length === 0 ? (
            <EmptyState text="No opportunities closing in the next 30 days." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.closing_soon.slice(0, 8).map((o) => (
                <div
                  key={o.id}
                  onClick={() => router.push(`/crm/opportunities/${o.id}`)}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{o.name}</div>
                    <div className="text-xs text-slate-400 truncate">
                      {o.customer_name ?? '—'} · {o.assigned_user_name ?? 'Unassigned'}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-slate-700">{fmt$(o.value)}</div>
                    <div className="text-xs font-semibold text-amber-600">{fmtDate(o.forecast_close_date)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <div className="grid grid-cols-2 gap-5 mb-5">

        {/* Monthly Goal Progress */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <SectionHeader title={`Goal Progress — ${monthLabel}`} action="Manage goals →" href="/admin/crm-goals" />
          {data.goal_progress.length === 0 ? (
            <EmptyState text="No goals set for this month." />
          ) : (
            <div className="p-4 space-y-3">
              {data.goal_progress.map((g) => (
                <div key={g.user_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{g.display_name}</span>
                    <span className="text-xs text-slate-400">
                      {fmt$(g.won_amount)}
                      {g.goal_amount > 0 && <> / {fmt$(g.goal_amount)}</>}
                      {' · '}
                      <span className={g.pct >= 100 ? 'text-green-600 font-semibold' : 'text-slate-500'}>
                        {g.pct}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        g.pct >= 100 ? 'bg-green-500' :
                        g.pct >= 75 ? 'bg-blue-500' :
                        g.pct >= 50 ? 'bg-purple-500' :
                        g.pct >= 25 ? 'bg-amber-400' : 'bg-slate-300'
                      }`}
                      style={{ width: `${Math.min(100, g.pct)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Team Leaderboard */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <SectionHeader title="Team Leaderboard (Open Pipeline)" action="All opportunities →" href="/crm/opportunities" />
          {data.leaderboard.length === 0 ? (
            <EmptyState text="No open opportunities assigned yet." />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.leaderboard.slice(0, 8).map((entry, idx) => (
                <div key={entry.user_id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0 ? 'bg-amber-100 text-amber-700' :
                    idx === 1 ? 'bg-slate-200 text-slate-600' :
                    idx === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {idx + 1}
                  </div>
                  <div className="flex-1 text-sm font-medium text-slate-800">{entry.display_name}</div>
                  <div className="text-sm font-bold text-slate-700">{fmt$(entry.open_value)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* My Tasks Due/Overdue */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <SectionHeader title="My Tasks — Due Today &amp; Overdue" action="All tasks →" href="/crm/tasks" />
        {data.my_tasks.length === 0 ? (
          <EmptyState text="You're all caught up! No tasks due today or overdue." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.my_tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/crm/tasks/${t.id}`)}
                className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{t.title}</div>
                  {t.linked_name && <div className="text-xs text-slate-400 truncate">{t.linked_name}</div>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {t.category && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-medium hidden md:inline">
                      {t.category}
                    </span>
                  )}
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${TASK_STATUS_BADGE[t.status] ?? 'bg-slate-100 text-slate-600'}`}>
                    {TASK_STATUS_LABEL[t.status] ?? t.status}
                  </span>
                  <span className="text-xs text-red-500 font-medium whitespace-nowrap">
                    {t.due_date ? fmtDate(t.due_date) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
