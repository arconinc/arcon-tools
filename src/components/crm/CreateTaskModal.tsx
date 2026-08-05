'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAppUser } from '@/components/layout/AppShell'
import { TaskDescriptionEditor } from '@/components/crm/TaskDescriptionEditor'
import { TaskThread } from '@/components/crm/task/TaskThread'
import { AssignToControl } from '@/components/crm/task/AssignToControl'
import { TaskParticipants } from '@/components/crm/task/TaskParticipants'
import { computeTaskParticipants } from '@/lib/task-participants'
import { TaskFlowStepper } from '@/components/crm/task/TaskFlowStepper'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS } from '@/lib/task-workflow'
import { CalendarGlyph, TrashGlyph, ExternalLinkGlyph, PlusGlyph } from '@/components/crm/task/TaskIcons'
import type { Comment, HistoryEntry, TaskAttachment } from '@/hooks/useTask'
import type { CrmTask, CrmTaskStatus } from '@/types'

type DropdownUser = { id: string; display_name: string; email: string }
type Team = { id: string; key: string; name: string; color: string }

function isHtmlContent(str: string) {
  return str.trim().startsWith('<')
}

type TaskForm = {
  title: string
  assigned_to: string
  team_id: string
  priority: string
  due_date: string
  status: string
  description: string
  progress: string
}

export type TaskLinkedEntity = {
  type: 'customer' | 'vendor' | 'contact' | 'opportunity'
  id: string
  name?: string
}

export type TaskFormTask = CrmTask & {
  id: string
  title: string
  assigned_to: string | null
  team_id: string | null
  category: string | null
  priority: string
  due_date: string | null
  status: string
  description: string | null
  progress: number
  opportunity?: { id: string; name: string } | null
  customer?: { id: string; name: string } | null
  vendor?: { id: string; name: string } | null
  contact?: { id: string; first_name: string; last_name: string } | null
  last_worked_by?: string | null
  assigned_user?: { id: string; display_name: string; email: string; avatar_url?: string | null; profile_image_url?: string | null } | null
  created_user?: { id: string; display_name: string; email?: string; avatar_url?: string | null; profile_image_url?: string | null } | null
  last_worked_user?: { id: string; display_name: string; avatar_url?: string | null; profile_image_url?: string | null } | null
  team?: { id: string; name: string; color: string } | null
  comments?: Comment[]
  history?: HistoryEntry[]
  attachments?: TaskAttachment[]
}

const STATUSES = [
  { value: 'not_started', label: 'Not Started', pill: 'text-slate-600 bg-slate-100 border-slate-200 hover:bg-slate-200' },
  { value: 'in_progress', label: 'In Progress', pill: 'text-blue-700 bg-blue-50 border-blue-200 hover:bg-blue-100' },
  { value: 'completed', label: 'Completed', pill: 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval', pill: 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100' },
  { value: 'waiting_on_client_approval', label: 'Waiting on Client', pill: 'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100' },
  { value: 'need_changes', label: 'Need Changes', pill: 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', pill: 'text-sky-700 bg-sky-50 border-sky-200 hover:bg-sky-100' },
  { value: 'medium', label: 'Medium', pill: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100' },
  { value: 'high', label: 'High', pill: 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100' },
]

// A single flag mark for all priority levels — the pill's color (not the
// glyph) carries low/medium/high, matching the reference design.
function PriorityIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21V4m0 0h11l-2 4 2 4H5" />
    </svg>
  )
}

function StatusIcon({ value }: { value: string }) {
  switch (value) {
    case 'not_started':
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
        </svg>
      )
    case 'in_progress':
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'completed':
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'waiting_on_approval':
    case 'waiting_on_client_approval':
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 7v5l3 3" />
        </svg>
      )
    case 'need_changes':
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      )
    default:
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" strokeWidth={2} />
        </svg>
      )
  }
}

function emptyForm(defaultTeamId?: string): TaskForm {
  return {
    title: '',
    assigned_to: '',
    team_id: defaultTeamId ?? '',
    priority: 'medium',
    due_date: '',
    status: 'not_started',
    description: '',
    progress: '0',
  }
}

function formFromTask(task: TaskFormTask): TaskForm {
  return {
    title: task.title ?? '',
    assigned_to: task.assigned_to ?? '',
    team_id: task.team_id ?? '',
    priority: task.priority ?? 'medium',
    due_date: task.due_date?.slice(0, 10) ?? '',
    status: task.status ?? 'not_started',
    description: task.description ?? '',
    progress: String(task.progress ?? 0),
  }
}

function linkedEntityLabel(entity: TaskLinkedEntity) {
  const type = entity.type.charAt(0).toUpperCase() + entity.type.slice(1)
  return entity.name ? `${type}: ${entity.name}` : type
}

const LINKED_ENTITY_ROUTES: Record<TaskLinkedEntity['type'], string> = {
  customer: '/sales/customers',
  vendor: '/sales/suppliers',
  contact: '/sales/contacts',
  opportunity: '/sales/opportunities',
}

function linkedEntityHref(entity: TaskLinkedEntity) {
  return `${LINKED_ENTITY_ROUTES[entity.type]}/${entity.id}`
}

function linkedEntityFromTask(task: TaskFormTask): TaskLinkedEntity | undefined {
  if (task.opportunity) return { type: 'opportunity', id: task.opportunity.id, name: task.opportunity.name }
  if (task.customer) return { type: 'customer', id: task.customer.id, name: task.customer.name }
  if (task.vendor) return { type: 'vendor', id: task.vendor.id, name: task.vendor.name }
  if (task.contact) return { type: 'contact', id: task.contact.id, name: `${task.contact.first_name} ${task.contact.last_name}` }
  return undefined
}

export function TaskFormModal({
  open,
  mode,
  onClose,
  onSaved,
  onDeleted,
  defaultTeamId,
  linkedEntity,
  task,
}: {
  open: boolean
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: (task: TaskFormTask) => void
  onDeleted?: () => void
  defaultTeamId?: string
  linkedEntity?: TaskLinkedEntity
  task?: TaskFormTask | null
}) {
  const { user: appUser } = useAppUser()
  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [form, setForm] = useState<TaskForm>(() => task ? formFromTask(task) : emptyForm(defaultTeamId))
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [uploadingDescriptionFile, setUploadingDescriptionFile] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'priority' | 'status' | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initialFormRef = useRef<TaskForm>(task ? formFromTask(task) : emptyForm(defaultTeamId))
  const [editingField, setEditingField] = useState<'title' | 'assigned_to' | 'description' | null>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const initial = task ? formFromTask(task) : emptyForm(defaultTeamId)
    initialFormRef.current = initial
    setForm(initial)
    setPendingFiles([])
    setError(null)
    setEditingField(mode === 'create' ? 'title' : null)
    fetch('/api/marketing/users')
      .then((r) => r.json())
      .then((users) => {
        if (!active || !Array.isArray(users)) return
        setCrmUsers(users)
        // Only default to "assigned to me" when no team is already selected —
        // opening the create form from a team-locked board should keep the
        // team as the assignee, not silently reassign to the creator.
        if (mode === 'create' && appUser?.email && !defaultTeamId) {
          const me = users.find((u: DropdownUser) => u.email === appUser.email)
          if (me) setForm((prev) => ({ ...prev, assigned_to: me.id }))
        }
      })
      .catch(() => {})
    fetch('/api/teams')
      .then((r) => r.json())
      .then((data) => { if (active && Array.isArray(data)) setTeams(data) })
      .catch(() => {})
    return () => { active = false }
  }, [open, mode, task?.id, appUser?.email, defaultTeamId])

  useEffect(() => {
    if (!openDropdown) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openDropdown])

  if (!open) return null

  // Re-fetches the full task detail (comments, history, attachments) and
  // hands it up to the parent — the thread's own actions (reply, attach,
  // reassign) don't go through the batch "Save Task" submit, so each one
  // refreshes the shared task state directly.
  async function refreshTask() {
    if (!task?.id) return
    const saved = await fetchSavedTask(task.id, task)
    onSaved(saved as TaskFormTask)
  }

  async function saveDescription(html: string) {
    if (!task?.id) return
    await fetch(`/api/marketing/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: html || null }),
    })
    await refreshTask()
  }

  async function uploadDescriptionAttachment(file: File) {
    if (!task?.id) return
    setUploadingDescriptionFile(true)
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
          url: uploaded.url, file_name: uploaded.file_name, file_size: uploaded.file_size, mime_type: uploaded.mime_type,
        }),
      })
      await refreshTask()
    } finally {
      setUploadingDescriptionFile(false)
    }
  }

  async function deleteDescriptionAttachment(attachmentId: string) {
    if (!task?.id) return
    await fetch(`/api/marketing/tasks/${task.id}/attachments?attachment_id=${attachmentId}`, { method: 'DELETE' })
    await refreshTask()
  }

  // The action is just the target status — reassignment (who it goes to next)
  // is computed server-side by the guided workflow state machine. See
  // src/lib/task-workflow.ts and the PATCH handler.
  async function handleStatusAction(toStatus: CrmTaskStatus) {
    if (!task?.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: toStatus }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Save failed')
        return
      }
      const saved = await fetchSavedTask(task.id, task)
      onSaved(saved as TaskFormTask)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // Preview text for the guided status buttons — who the task will go to next.
  function describeNextOwner(toStatus: CrmTaskStatus): string | null {
    if (!task || !appUser) return null
    const targetId =
      toStatus === 'in_progress' ? appUser.id
      : toStatus === 'waiting_on_approval' ? task.created_by
      : toStatus === 'need_changes' ? (task.last_worked_by ?? task.assigned_to ?? null)
      : toStatus === 'completed' && task.status === 'not_started' ? appUser.id
      : null
    if (!targetId) return null
    if (targetId === appUser.id) return 'you'
    if (targetId === task.created_user?.id) return task.created_user.display_name
    if (targetId === task.assigned_user?.id) return task.assigned_user.display_name
    if (targetId === task.last_worked_user?.id) return task.last_worked_user.display_name
    return null
  }

  async function handleDeleteTask() {
    if (!task?.id) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Delete failed')
        setShowDeleteConfirm(false)
        return
      }
      onDeleted?.()
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  async function uploadAttachments(taskId: string) {
    if (pendingFiles.length === 0) return
    await Promise.all(pendingFiles.map(async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) return
      const uploaded = await uploadRes.json()
      await fetch(`/api/marketing/tasks/${taskId}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploaded.url,
          file_name: uploaded.file_name,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
        }),
      })
    }))
  }

  async function fetchSavedTask(taskId: string, fallback: TaskFormTask) {
    const detailRes = await fetch(`/api/marketing/tasks/${taskId}`)
    if (!detailRes.ok) return fallback
    const detail = await detailRes.json()
    return detail.error ? fallback : detail
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    if (mode === 'edit' && !task?.id) {
      setError('Task is missing')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const linkedPayload = mode === 'create' && linkedEntity ? { [`${linkedEntity.type}_id`]: linkedEntity.id } : {}
      const payload = {
        title: form.title.trim(),
        assigned_to: form.assigned_to || null,
        team_id: form.team_id || null,
        priority: form.priority || 'medium',
        due_date: form.due_date || null,
        status: form.status || 'not_started',
        // In edit mode the description lives in the thread now and saves
        // immediately on blur (see saveDescription) — including the
        // form-staged copy here would overwrite it with a stale snapshot.
        ...(mode === 'create' ? { description: form.description || null } : {}),
        progress: form.progress ? Number(form.progress) : 0,
        ...linkedPayload,
      }
      const taskId = task?.id
      const res = await fetch(mode === 'edit' && taskId ? `/api/marketing/tasks/${taskId}` : '/api/marketing/tasks', {
        method: mode === 'edit' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? (mode === 'edit' ? 'Save failed' : 'Create failed'))
        return
      }

      const savedId = data.id ?? taskId
      if (savedId) await uploadAttachments(savedId)

      const savedTask = savedId ? await fetchSavedTask(savedId, { ...task, ...data } as TaskFormTask) : data
      onSaved(savedTask)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const isDirty = pendingFiles.length > 0 || JSON.stringify(form) !== JSON.stringify(initialFormRef.current)

  function handleClose() {
    if (showDeleteConfirm) { setShowDeleteConfirm(false); return }
    if (isDirty) { setShowDiscardConfirm(true) } else { onClose() }
  }

  const displayLinkedEntity = linkedEntity ?? (task ? linkedEntityFromTask(task) : undefined)
  const actionLabel = mode === 'edit' ? 'Save Task' : 'Create Task'
  const savingLabel = mode === 'edit' ? 'Saving...' : 'Creating...'

  const currentPriority = PRIORITIES.find((p) => p.value === form.priority) ?? PRIORITIES[1]
  const currentStatus = STATUSES.find((s) => s.value === form.status) ?? STATUSES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6" onClick={handleClose}>
      <div className="w-full max-w-7xl h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-100 bg-white px-8 py-4">
          <div className="flex items-center justify-between gap-5 flex-wrap">
            <div className="min-w-0">
              {editingField === 'title' ? (
                <input
                  type="text"
                  value={form.title}
                  required
                  autoFocus
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  onBlur={() => setEditingField(null)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setEditingField(null) } }}
                  className="w-full text-xl font-bold text-slate-900 border border-purple-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              ) : (
                <h2
                  className="text-xl font-bold text-slate-900 leading-tight cursor-text"
                  onClick={() => setEditingField('title')}
                >
                  {form.title || <span className="text-slate-400 italic">Untitled task</span>}
                </h2>
              )}
              {displayLinkedEntity && (
                <Link
                  href={linkedEntityHref(displayLinkedEntity)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100 transition-colors"
                >
                  {linkedEntityLabel(displayLinkedEntity)}
                  <ExternalLinkGlyph className="h-3 w-3" />
                </Link>
              )}
            </div>

            {/* Status + priority badges, due date, external link, close */}
            <div ref={dropdownRef} className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            {mode === 'create' ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(openDropdown === 'status' ? null : 'status')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${currentStatus.pill}`}
                >
                  <StatusIcon value={form.status} />
                  {currentStatus.label}
                  <svg className="h-3 w-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openDropdown === 'status' && (
                  <div className="absolute left-0 top-full mt-1 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-20 py-1 overflow-hidden">
                    {STATUSES.map((s) => (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => { setForm((prev) => ({ ...prev, status: s.value })); setOpenDropdown(null) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${s.value === form.status ? s.pill : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <StatusIcon value={s.value} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${TASK_STATUS_COLORS[(task?.status ?? 'not_started') as CrmTaskStatus]}`}>
                {TASK_STATUS_LABELS[(task?.status ?? 'not_started') as CrmTaskStatus]}
              </span>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${currentPriority.pill}`}
              >
                <PriorityIcon />
                {currentPriority.label}
                <svg className="h-3 w-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'priority' && (
                <div className="absolute left-0 top-full mt-1 w-36 rounded-xl border border-slate-200 bg-white shadow-lg z-20 py-1 overflow-hidden">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setForm((prev) => ({ ...prev, priority: p.value })); setOpenDropdown(null) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${p.value === form.priority ? p.pill : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <PriorityIcon />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => (dueDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.() ?? dueDateRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-purple-700 transition-colors"
            >
              <CalendarGlyph />
              {form.due_date
                ? new Date(form.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'No date'}
            </button>
            <input
              ref={dueDateRef}
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
            />

              {mode === 'edit' && task?.id && (
                <Link
                  href={`/tasks/${task.id}`}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  aria-label="Open full task view"
                >
                  <ExternalLinkGlyph />
                </Link>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Prominent assign control + (edit mode) everyone involved */}
          <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
            <AssignToControl
              teamId={form.team_id || null}
              assignedTo={form.assigned_to || null}
              displayLabel={
                mode === 'edit'
                  ? (task?.assigned_user?.display_name ?? task?.team?.name ?? 'Unassigned')
                  : (form.assigned_to
                      ? (crmUsers.find((u) => u.id === form.assigned_to)?.display_name ?? 'Unknown')
                      : form.team_id
                      ? (teams.find((t) => t.id === form.team_id)?.name ?? 'Unknown team')
                      : 'Unassigned')
              }
              teams={teams}
              users={crmUsers}
              editing={editingField === 'assigned_to'}
              onStartEdit={() => setEditingField('assigned_to')}
              onChange={(assignment) => {
                setForm((p) => ({ ...p, team_id: assignment.teamId ?? '', assigned_to: assignment.assignedTo ?? '' }))
                setEditingField(null)
              }}
            />
            {mode === 'edit' && task && <TaskParticipants participants={computeTaskParticipants(task)} />}
          </div>
        </div>

        {mode === 'edit' && task && (
          <TaskFlowStepper
            status={task.status as CrmTaskStatus}
            ownerName={task.assigned_user?.display_name}
            requestorName={task.created_user?.display_name}
            onAction={handleStatusAction}
            disabled={saving}
            describeNext={describeNextOwner}
          />
        )}

        {/* Form — flex column so description can grow */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 relative">

          {error && (
            <div className="flex-shrink-0 mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          {mode === 'create' ? (
            <div className="flex-1 flex flex-col min-h-0 px-6 pt-3 pb-3">
              <div className="flex-shrink-0 mb-1">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Description</span>
              </div>

              {editingField === 'description' ? (
                <div
                  className="flex-1 flex flex-col min-h-0"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                      setEditingField(null)
                    }
                  }}
                >
                  <TaskDescriptionEditor
                    initialHtml={form.description}
                    onChange={(html) => setForm((p) => ({ ...p, description: html }))}
                  />
                </div>
              ) : (
                <div
                  className="flex-1 min-h-0 overflow-y-auto cursor-text rounded-lg hover:bg-slate-50 bg-white px-3 py-2 transition-colors"
                  onClick={() => setEditingField('description')}
                >
                  {form.description ? (
                    isHtmlContent(form.description) ? (
                      <div
                        className="prose prose-sm prose-slate max-w-none"
                        dangerouslySetInnerHTML={{ __html: form.description }}
                      />
                    ) : (
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">{form.description}</p>
                    )
                  ) : (
                    <p className="text-sm text-slate-400 italic">Add a description…</p>
                  )}
                </div>
              )}

              <div className="flex-shrink-0 mt-3">
                <label className="flex items-center justify-center gap-1.5 w-full py-3 border border-dashed border-slate-300 rounded-lg text-sm font-semibold text-slate-500 hover:border-purple-300 hover:text-purple-700 hover:bg-purple-50/50 cursor-pointer transition-colors">
                  <PlusGlyph />
                  Attach files
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      setPendingFiles((prev) => [...prev, ...files])
                      e.target.value = ''
                    }}
                    className="sr-only"
                  />
                </label>
                {pendingFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pendingFiles.map((file, index) => (
                      <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                        {file.name}
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                          className="text-slate-400 hover:text-red-500 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            task?.id && (
              <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
                <TaskThread
                  taskId={task.id}
                  createdAt={task.created_at}
                  createdByName={task.created_user?.display_name ?? 'Unknown'}
                  createdByEmail={task.created_user?.email}
                  createdByAvatarUrl={task.created_user?.avatar_url}
                  createdByProfileImageUrl={task.created_user?.profile_image_url}
                  description={task.description}
                  descriptionAttachments={task.attachments ?? []}
                  comments={task.comments ?? []}
                  history={task.history ?? []}
                  currentUserId={appUser?.id ?? ''}
                  currentUserName={appUser?.display_name ?? ''}
                  currentUserAvatarUrl={appUser?.avatar_url}
                  isAdmin={appUser?.is_admin ?? false}
                  assignedTo={task.assigned_to}
                  createdBy={task.created_by}
                  canEditDescription
                  uploadingDescriptionFile={uploadingDescriptionFile}
                  onRefresh={refreshTask}
                  onSaveDescription={saveDescription}
                  onUploadDescriptionFile={uploadDescriptionAttachment}
                  onDeleteDescriptionAttachment={deleteDescriptionAttachment}
                />
              </div>
            )
          )}

          {/* Footer */}
          <div className="mt-auto flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t border-slate-100">
            <div>
              {mode === 'edit' && task?.id && (appUser?.is_admin || task.created_by === appUser?.id || task.task_owner === appUser?.id) && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                >
                  <TrashGlyph />
                  Delete Task
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors"
              >
                {saving ? savingLabel : actionLabel}
              </button>
            </div>
          </div>

          {showDiscardConfirm && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm p-6">
              <div className="w-full max-w-sm text-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Discard changes?</h3>
                <p className="text-sm text-slate-600 mb-6">Your unsaved changes will be lost.</p>
                <div className="flex gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowDiscardConfirm(false)}
                    className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Keep editing
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </div>
            </div>
          )}

          {showDeleteConfirm && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/95 backdrop-blur-sm p-6">
              <div className="w-full max-w-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Delete Task?</h3>
                </div>
                <p className="text-sm text-slate-600 mb-1">You are about to permanently delete:</p>
                <p className="text-sm font-semibold text-slate-900 mb-4 bg-slate-50 px-3 py-2 rounded-lg truncate">
                  {task?.title}
                </p>
                <p className="text-sm text-red-600 font-medium mb-6">
                  This cannot be undone. All comments, history, and attachments will be deleted.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    disabled={deleting}
                    className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
                  >
                    {deleting ? 'Deleting…' : 'Delete Task'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

export function CreateTaskModal({
  open,
  onClose,
  onCreated,
  defaultTeamId,
  linkedEntity,
}: {
  open: boolean
  onClose: () => void
  onCreated: (task: TaskFormTask) => void
  defaultTeamId?: string
  linkedEntity?: TaskLinkedEntity
}) {
  return (
    <TaskFormModal
      open={open}
      mode="create"
      onClose={onClose}
      onSaved={onCreated}
      defaultTeamId={defaultTeamId}
      linkedEntity={linkedEntity}
    />
  )
}
