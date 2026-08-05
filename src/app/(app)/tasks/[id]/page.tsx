'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import EntitySearchPicker from '@/components/crm/EntitySearchPicker'
import { TeamAssigneeSelect } from '@/components/crm/TeamAssigneeSelect'
import { useAppUser } from '@/components/layout/AppShell'
import { formatDate } from '@/lib/format'
import { useTask } from '@/hooks/useTask'
import type { TaskPriority } from '@/hooks/useTask'
import { TaskFlowStepper, flowStepLabel } from '@/components/crm/task/TaskFlowStepper'
import { TaskThread } from '@/components/crm/task/TaskThread'
import { AssignToControl } from '@/components/crm/task/AssignToControl'
import { TaskParticipants } from '@/components/crm/task/TaskParticipants'
import { computeTaskParticipants } from '@/lib/task-participants'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import { CalendarGlyph, TrashGlyph } from '@/components/crm/task/TaskIcons'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, computeTransitionPatch } from '@/lib/task-workflow'
import type { CrmTaskStatus } from '@/types'

// ── Local Types ───────────────────────────────────────────────────────────────

type DropdownUser = { id: string; display_name: string; email: string }
type DropdownContact = { id: string; first_name: string; last_name: string }
type DropdownTeam = { id: string; key: string; name: string; color: string }

// ── Local Constants ───────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

// ── Local Helpers ─────────────────────────────────────────────────────────────

function PencilIcon() {

  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id
  const isNew = id === 'new'
  const { user: appUser } = useAppUser()

  const { task, setTask, loading, error, refetch, load } = useTask(id)

  const [activeTab, setActiveTab] = useState<'thread' | 'details' | 'related'>('thread')
  const [editingField, setEditingField] = useState<'title' | 'priority' | 'due_date' | 'assigned_to' | null>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)
  const [editingLinked, setEditingLinked] = useState(false)
  const [linkedForm, setLinkedForm] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [contacts, setContacts] = useState<DropdownContact[]>([])
  const [teams, setTeams] = useState<DropdownTeam[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing/users').then((r) => r.json()),
      fetch('/api/marketing/contacts').then((r) => r.json()),
      fetch('/api/teams').then((r) => r.json()),
    ]).then(([users, conts, teamsData]) => {
      if (Array.isArray(users)) setCrmUsers(users)
      if (Array.isArray(conts)) setContacts(conts)
      if (Array.isArray(teamsData)) setTeams(teamsData)
    })
  }, [])

  useEffect(() => {
    if (isNew) {
      router.replace('/sales/tasks')
      return
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew, router])

  async function saveFieldValues(fields: Record<string, unknown>) {
    if (!task) return
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Save failed')
        return
      }
      await refetch()
    } finally {
      setSaving(false)
    }
  }

  async function saveFieldValue(field: string, value: unknown) {
    await saveFieldValues({ [field]: value })
  }

  function startEditLinked() {
    if (!task) return
    setLinkedForm({ ...task })
    setEditingLinked(true)
  }

  function cancelEditLinked() {
    setEditingLinked(false)
    setLinkedForm({})
  }

  async function saveLinked() {
    if (!task) return
    setSaving(true)
    try {
      const payload = {
        opportunity_id: (linkedForm.opportunity_id as string | null) ?? null,
        customer_id: (linkedForm.customer_id as string | null) ?? null,
        vendor_id: (linkedForm.vendor_id as string | null) ?? null,
        contact_id: (linkedForm.contact_id as string | null) ?? null,
      }
      const res = await fetch(`/api/marketing/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      await refetch()
      setEditingLinked(false)
    } finally {
      setSaving(false)
    }
  }

  async function quickUpdateStatus(newStatus: CrmTaskStatus) {
    if (!task) return
    const prev = task.status
    setTask((t) => t ? { ...t, status: newStatus as typeof task.status } : t)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Could not change status')
        setTask((t) => t ? { ...t, status: prev } : t)
      } else {
        await refetch()
      }
    } catch {
      setTask((t) => t ? { ...t, status: prev } : t)
    }
  }

  // Preview text for the guided status buttons — who the task will go to next.
  function describeNextOwner(toStatus: CrmTaskStatus): string | null {
    if (!task || !appUser) return null
    const patch = computeTransitionPatch(
      { assigned_to: task.assigned_to, created_by: task.created_by, last_worked_by: task.last_worked_by },
      task.status as CrmTaskStatus,
      toStatus,
      appUser.id
    )
    const targetId = patch.assigned_to
    if (targetId === undefined) return null
    if (targetId === appUser.id) return 'you'
    if (targetId === task.created_user?.id) return task.created_user.display_name
    if (targetId === task.assigned_user?.id) return task.assigned_user.display_name
    if (targetId === task.last_worked_user?.id) return task.last_worked_user.display_name
    return null
  }

  async function uploadTaskAttachment(file: File) {
    if (!task) return
    setUploadingAttachment(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) { alert('Upload failed'); return }
      const uploaded = await uploadRes.json()
      await fetch(`/api/marketing/tasks/${task.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploaded.url,
          file_name: uploaded.file_name,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
        }),
      })
      await refetch()
    } finally {
      setUploadingAttachment(false)
    }
  }

  async function deleteTaskAttachment(attachmentId: string) {
    if (!task || !confirm('Remove this attachment?')) return
    await fetch(`/api/marketing/tasks/${task.id}/attachments?attachment_id=${attachmentId}`, { method: 'DELETE' })
    await refetch()
  }

  async function deleteTask() {
    if (!task) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error ?? 'Delete failed')
        return
      }
      router.push('/sales/tasks')
    } finally {
      setDeleting(false)
    }
  }

  if (isNew) return null

  if (loading) {

    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-slate-100 rounded w-24" />
          <div className="h-24 bg-slate-100 rounded-2xl" />
          <div className="h-64 bg-slate-100 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error || !task) {

    return (
      <div className="max-w-4xl mx-auto px-6 py-8">
        <Link href="/sales/tasks" className="text-sm text-slate-500 hover:text-slate-700">← Tasks</Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error ?? 'Task not found'}
        </div>
      </div>
    )
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
  const statusLabel = TASK_STATUS_LABELS[task.status as CrmTaskStatus] ?? task.status
  const statusColorCls = TASK_STATUS_COLORS[task.status as CrmTaskStatus] ?? 'bg-slate-100 text-slate-600'

  const linkedObj = task.opportunity
    ? { type: 'opportunity', label: 'Opportunity', href: `/sales/opportunities/${task.opportunity.id}`, name: task.opportunity.name, color: 'bg-purple-100 text-purple-700' }
    : task.customer
    ? { type: 'customer', label: 'Customer', href: `/sales/customers/${task.customer.id}`, name: task.customer.name, color: 'bg-blue-100 text-blue-700' }
    : task.vendor
    ? { type: 'vendor', label: 'Supplier', href: `/sales/suppliers/${task.vendor.id}`, name: task.vendor.name, color: 'bg-orange-100 text-orange-700' }
    : task.contact
    ? { type: 'contact', label: 'Contact', href: `/sales/contacts/${task.contact.id}`, name: `${task.contact.first_name} ${task.contact.last_name}`, color: 'bg-teal-100 text-teal-700' }
    : null

  // Every attachment across the opening description and all replies, newest
  // first — for the sidebar's quick-find list (the thread itself keeps each
  // attachment inline with the message it belongs to).
  const allAttachments = [
    ...task.attachments.map((a) => ({ id: a.id, url: a.url, label: a.file_name ?? 'file', created_at: a.created_at })),
    ...task.comments.flatMap((c) => c.attachments.map((a) => ({ id: a.id, url: a.url, label: a.label, created_at: a.created_at }))),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const participants = computeTaskParticipants(task)


  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href="/sales/tasks" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tasks
      </Link>



      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-5">
        <div className="px-8 py-4">
          <div className="flex items-center justify-between gap-5 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 leading-tight">{task.title}</h1>
            </div>

            {/* Status + priority badges, due date, delete */}
            <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusColorCls}`}>
                {statusLabel}
              </span>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${PRIORITY_BADGE[task.priority]}`}>
                {task.priority}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                <CalendarGlyph />
                {task.due_date ? `${isOverdue ? '⚠️ ' : ''}${formatDate(task.due_date)}` : 'No date'}
              </span>
              {(appUser?.is_admin || task.created_by === appUser?.id || task.task_owner === appUser?.id) && (
                <ConfirmButton
                  idleLabel="Delete Task"
                  confirmLabel="Yes, delete task?"
                  onConfirm={deleteTask}
                  variant="red"
                  size="sm"
                  icon={<TrashGlyph />}
                  disabled={deleting}
                />
              )}
            </div>
          </div>

          {/* Prominent assign control + everyone involved in the task */}
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <AssignToControl
              teamId={task.team_id}
              assignedTo={task.assigned_to}
              displayLabel={task.assigned_user?.display_name ?? task.team?.name ?? 'Unassigned'}
              teams={teams}
              users={crmUsers}
              editing={editingField === 'assigned_to'}
              onStartEdit={() => setEditingField('assigned_to')}
              onChange={(assignment) => {
                saveFieldValues({ team_id: assignment.teamId ?? null, assigned_to: assignment.assignedTo ?? null })
                setEditingField(null)
              }}
            />
            <TaskParticipants participants={participants} />
          </div>
        </div>

        <TaskFlowStepper
          status={task.status as CrmTaskStatus}
          ownerName={task.assigned_user?.display_name}
          requestorName={task.created_user?.display_name}
          onAction={quickUpdateStatus}
          describeNext={describeNextOwner}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-5">
        {(['thread', 'details', 'related'] as const).map((tab) => {
          const count = tab === 'thread' ? task.comments.length : 0
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
                activeTab === tab ? 'font-bold text-purple-700 border-purple-700' : 'font-medium text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {tab}
              {count > 0 && <span className="ml-1.5 text-xs opacity-70">{count}</span>}
            </button>
          )
        })}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Task Details</h2>
              {saving && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
            </div>

            <div className="divide-y divide-slate-100">

              {/* Title */}
              <div className="group flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Title</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'title' ? (
                    <input
                      type="text"
                      defaultValue={task.title}
                      autoFocus
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (val && val !== task.title) saveFieldValue('title', val)
                        else setEditingField(null)
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      className="w-full px-2 py-1 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  ) : (
                    <span className="text-sm font-medium text-slate-800">{task.title}</span>
                  )}
                </div>
                {editingField !== 'title' && (
                  <button type="button" onClick={() => setEditingField('title')}
                    className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    aria-label="Edit title">
                    <PencilIcon />
                  </button>
                )}
              </div>

              {/* Priority */}
              <div className="group flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Priority</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'priority' ? (
                    <select
                      defaultValue={task.priority}
                      autoFocus
                      onChange={(e) => { saveFieldValue('priority', e.target.value); setEditingField(null) }}
                      onBlur={() => setEditingField(null)}
                      className="px-2 py-1 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[task.priority]}`}>
                      {task.priority}
                    </span>
                  )}
                </div>
                {editingField !== 'priority' && (
                  <button type="button" onClick={() => setEditingField('priority')}
                    className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    aria-label="Edit priority">
                    <PencilIcon />
                  </button>
                )}
              </div>

              {/* Due Date */}
              <div className="flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Due Date</div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-800'}`}>
                    {task.due_date ? formatDate(task.due_date) : <span className="italic text-slate-400">No date</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => (dueDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.() ?? dueDateRef.current?.click()}
                    className="p-1 text-slate-400 hover:text-purple-600 transition-colors rounded"
                    aria-label="Pick date"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                      <line x1="16" y1="2" x2="16" y2="6" strokeWidth={2} />
                      <line x1="8" y1="2" x2="8" y2="6" strokeWidth={2} />
                      <line x1="3" y1="10" x2="21" y2="10" strokeWidth={2} />
                    </svg>
                  </button>
                  <input
                    ref={dueDateRef}
                    type="date"
                    defaultValue={task.due_date?.slice(0, 10) ?? ''}
                    onChange={(e) => saveFieldValue('due_date', e.target.value || null)}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>

              {/* Assigned To (Team or Individual) */}
              <div className="group flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Assigned To</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'assigned_to' ? (
                    <TeamAssigneeSelect
                      teamId={task.team_id ?? null}
                      assignedTo={task.assigned_to ?? null}
                      teams={teams}
                      users={crmUsers}
                      onChange={(assignment) => {
                        saveFieldValues({ team_id: assignment.teamId ?? null, assigned_to: assignment.assignedTo ?? null })
                        setEditingField(null)
                      }}
                    />
                  ) : (
                    <span className="text-sm text-slate-800">
                      {task.assigned_user?.display_name
                        ?? task.team?.name
                        ?? <span className="italic text-slate-400">Unassigned</span>}
                    </span>
                  )}
                </div>
                {editingField !== 'assigned_to' && (
                  <button type="button" onClick={() => setEditingField('assigned_to')}
                    className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    aria-label="Edit assignee">
                    <PencilIcon />
                  </button>
                )}
              </div>

              {/* Assigned By (read-only) */}
              <div className="flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Assigned By</div>
                <span className="text-sm text-slate-800">
                  {task.created_user?.display_name ?? <span className="italic text-slate-400">—</span>}
                </span>
              </div>

              {/* Linked record (read-only; edit in Related tab) */}
              {linkedObj && (
                <div className="px-6 py-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Linked To</div>
                  <Link href={linkedObj.href} className="inline-flex items-center gap-2 hover:underline">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${linkedObj.color}`}>
                      {linkedObj.label.slice(0, 3)}
                    </span>
                    <span className="text-sm text-purple-700">{linkedObj.name}</span>
                  </Link>
                </div>
              )}

              {/* Linked spec sample */}
              {task.linked_spec && (
                <div className="px-6 py-3">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Spec Sample</div>
                  <Link href={`/marketing/specs/${task.linked_spec.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider bg-purple-100 text-purple-700">
                      Spec
                    </span>
                    <span className="text-sm text-purple-700">{task.linked_spec.item_name}</span>
                  </Link>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex gap-6 text-xs text-slate-400">
              <span>Created {formatDate(task.created_at)}</span>
              <span>Updated {formatDate(task.updated_at)}</span>
            </div>
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Task Information */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Task Information</h2>
            </div>
            <div className="divide-y divide-slate-100 text-sm">
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Status</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColorCls}`}>{statusLabel}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Priority</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[task.priority]}`}>{task.priority}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Task ID</span>
                <span className="font-mono text-slate-700">{task.id.slice(0, 4).toUpperCase()}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Flow Step</span>
                <span className="text-slate-700">{flowStepLabel(task.status as CrmTaskStatus)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Assigned To</span>
                <span className="text-slate-700">{task.assigned_user?.display_name ?? task.team?.name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Assigned By</span>
                <span className="text-slate-700">{task.created_user?.display_name ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-700">{formatDate(task.created_at)}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-2.5">
                <span className="text-slate-400">Updated</span>
                <span className="text-slate-700">{formatDate(task.updated_at)}</span>
              </div>
            </div>
          </div>

          {/* Files preview — every attachment across the description and all
              replies, newest first, so files stay findable without hunting
              through the thread. */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">
                Files
                {allAttachments.length > 0 && <span className="ml-1.5 text-xs font-normal text-slate-400">({allAttachments.length})</span>}
              </h2>
            </div>
            {allAttachments.length === 0 ? (
              <div className="px-5 py-4 text-sm text-slate-400">No files yet.</div>
            ) : (
              <div className="p-3 space-y-1.5">
                {allAttachments.slice(0, 6).map((att) => (
                  <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-slate-700 hover:bg-slate-50 transition-colors">
                    <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="truncate">{att.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* ── Thread Tab ── */}
      {activeTab === 'thread' && appUser && (
        <TaskThread
          taskId={task.id}
          createdAt={task.created_at}
          createdByName={task.created_user?.display_name ?? 'Unknown'}
          createdByEmail={task.created_user?.email}
          createdByAvatarUrl={task.created_user?.avatar_url}
          createdByProfileImageUrl={task.created_user?.profile_image_url}
          description={task.description}
          descriptionAttachments={task.attachments}
          comments={task.comments}
          history={task.history}
          currentUserId={appUser.id}
          currentUserName={appUser.display_name}
          currentUserAvatarUrl={appUser.avatar_url}
          isAdmin={appUser.is_admin}
          assignedTo={task.assigned_to}
          createdBy={task.created_by}
          canEditDescription
          uploadingDescriptionFile={uploadingAttachment}
          onRefresh={refetch}
          onSaveDescription={(html) => saveFieldValue('description', html || null)}
          onUploadDescriptionFile={uploadTaskAttachment}
          onDeleteDescriptionAttachment={deleteTaskAttachment}
        />
      )}

      {/* ── Related Tab ── */}
      {activeTab === 'related' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Linked Record</h2>
              {!editingLinked ? (
                <button onClick={startEditLinked}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={saveLinked} disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelEditLinked}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {editingLinked ? (
              <div className="p-5 grid grid-cols-2 gap-4">
                <EntitySearchPicker
                  label="Opportunity"
                  apiPath="/api/marketing/opportunities"
                  resultsKey="items"
                  value={(linkedForm.opportunity_id as string) ?? null}
                  displayName={(linkedForm.opportunity as { name: string } | null)?.name ?? null}
                  onSelect={(id, name) =>
                    setLinkedForm((p) => ({ ...p, opportunity_id: id ?? null, opportunity: id ? { id, name: name! } : null }))
                  }
                  placeholder="Search opportunities…"
                />
                <EntitySearchPicker
                  label="Customer"
                  apiPath="/api/marketing/customers"
                  resultsKey="customers"
                  value={(linkedForm.customer_id as string) ?? null}
                  displayName={(linkedForm.customer as { name: string } | null)?.name ?? null}
                  onSelect={(id, name) =>
                    setLinkedForm((p) => ({ ...p, customer_id: id ?? null, customer: id ? { id, name: name! } : null }))
                  }
                  placeholder="Search customers…"
                />
                <EntitySearchPicker
                  label="Supplier"
                  apiPath="/api/marketing/vendors"
                  resultsKey="vendors"
                  value={(linkedForm.vendor_id as string) ?? null}
                  displayName={(linkedForm.vendor as { name: string } | null)?.name ?? null}
                  onSelect={(id, name) =>
                    setLinkedForm((p) => ({ ...p, vendor_id: id ?? null, vendor: id ? { id, name: name! } : null }))
                  }
                  placeholder="Search suppliers…"
                />
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Contact</label>
                  <select value={(linkedForm.contact_id as string) ?? ''}
                    onChange={(e) => setLinkedForm((p) => ({ ...p, contact_id: e.target.value || null }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                    <option value="">— None —</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : !linkedObj ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">
                This task is not linked to any record.{' '}
                <button onClick={startEditLinked} className="text-purple-600 hover:underline font-medium">Add a link</button>
              </div>
            ) : (
              <div className="p-5">
                <Link href={linkedObj.href} className="flex items-center gap-4 p-4 border border-slate-200 rounded-xl hover:border-purple-300 hover:bg-purple-50 transition-colors group">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 ${linkedObj.color}`}>
                    {linkedObj.label.slice(0, 1)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{linkedObj.label}</div>
                    <div className="text-sm font-semibold text-slate-800 group-hover:text-purple-700 transition-colors">{linkedObj.name}</div>
                  </div>
                  <svg className="w-4 h-4 text-slate-300 group-hover:text-purple-400 ml-auto transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
