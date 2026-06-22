'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useAppUser } from '@/components/layout/AppShell'
import { TaskAssignmentSelect } from '@/components/crm/TaskAssignmentSelect'
import { TaskDescriptionEditor } from '@/components/crm/TaskDescriptionEditor'
import type { CrmTask, CrmTaskDepartment } from '@/types'

type DropdownUser = { id: string; display_name: string; email: string }

type TaskNote = {
  id: string
  user_id: string
  comment: string
  created_at: string
  user: { display_name: string }
}

type TaskAttachment = {
  id: string
  file_name: string | null
  url: string
  mime_type: string | null
  file_size: number | null
  uploaded_by: string
}

function isHtmlContent(str: string) {
  return str.trim().startsWith('<')
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type TaskForm = {
  title: string
  assigned_to: string
  department: string
  category: string
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
  department: string | null
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
  assigned_user?: { id: string; display_name: string; email: string } | null
  created_user?: { id: string; display_name: string } | null
  comments?: TaskNote[]
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

function PriorityIcon({ value }: { value: string }) {
  if (value === 'high') return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
    </svg>
  )
  if (value === 'low') return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
    </svg>
  )
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
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

function emptyForm(defaultDepartment?: CrmTaskDepartment): TaskForm {
  return {
    title: '',
    assigned_to: '',
    department: defaultDepartment ?? '',
    category: '',
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
    department: task.department ?? '',
    category: task.category ?? '',
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
  defaultDepartment,
  linkedEntity,
  task,
}: {
  open: boolean
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: (task: TaskFormTask) => void
  onDeleted?: () => void
  defaultDepartment?: CrmTaskDepartment
  linkedEntity?: TaskLinkedEntity
  task?: TaskFormTask | null
}) {
  const { user: appUser } = useAppUser()
  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [form, setForm] = useState<TaskForm>(() => task ? formFromTask(task) : emptyForm(defaultDepartment))
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [existingAttachments, setExistingAttachments] = useState<TaskAttachment[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<TaskNote[]>(() => task?.comments ?? [])
  const [noteText, setNoteText] = useState('')
  const [submittingNote, setSubmittingNote] = useState(false)
  const notesEndRef = useRef<HTMLDivElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'priority' | 'status' | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initialFormRef = useRef<TaskForm>(task ? formFromTask(task) : emptyForm(defaultDepartment))
  const [editingField, setEditingField] = useState<'title' | 'dept' | 'assigned_to' | 'description' | null>(null)
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(false)
  const [notesExpanded, setNotesExpanded] = useState(false)
  const dueDateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    const initial = task ? formFromTask(task) : emptyForm(defaultDepartment)
    initialFormRef.current = initial
    setForm(initial)
    setPendingFiles([])
    setExistingAttachments([])
    setError(null)
    setEditingField(mode === 'create' ? 'title' : null)
    setAttachmentsExpanded(false)
    setNotesExpanded(false)
    if (mode === 'edit' && task?.id) {
      fetch(`/api/marketing/tasks/${task.id}/attachments`)
        .then((r) => r.json())
        .then((data) => { if (active && Array.isArray(data)) setExistingAttachments(data) })
        .catch(() => {})
    }
    fetch('/api/marketing/users')
      .then((r) => r.json())
      .then((users) => {
        if (!active || !Array.isArray(users)) return
        setCrmUsers(users)
        if (mode === 'create' && appUser?.email) {
          const me = users.find((u: DropdownUser) => u.email === appUser.email)
          if (me) setForm((prev) => ({ ...prev, assigned_to: me.id }))
        }
      })
      .catch(() => {})
    return () => { active = false }
  }, [open, mode, task?.id, appUser?.email, defaultDepartment])

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

  async function refreshNotes(taskId: string) {
    const res = await fetch(`/api/marketing/tasks/${taskId}/comments`)
    if (!res.ok) return
    const data = await res.json()
    if (Array.isArray(data)) setNotes(data)
    else if (Array.isArray(data.comments)) setNotes(data.comments)
    setTimeout(() => notesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function submitNote() {
    if (!noteText.trim() || !task?.id) return
    setSubmittingNote(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: noteText.trim() }),
      })
      if (res.ok) {
        setNoteText('')
        await refreshNotes(task.id)
      }
    } finally {
      setSubmittingNote(false)
    }
  }

  async function deleteExistingAttachment(attachmentId: string) {
    if (!task?.id) return
    await fetch(`/api/marketing/tasks/${task.id}/attachments?attachment_id=${attachmentId}`, { method: 'DELETE' })
    setExistingAttachments((prev) => prev.filter((a) => a.id !== attachmentId))
  }

  async function handleSendForApproval() {
    if (!task?.id || !task.created_by) return
    setSaving(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: task.created_by, status: 'waiting_on_approval' }),
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
        department: form.department || null,
        category: form.category || null,
        priority: form.priority || 'medium',
        due_date: form.due_date || null,
        status: form.status || 'not_started',
        description: form.description || null,
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

  const isDirty = pendingFiles.length > 0 || noteText.trim() !== '' || JSON.stringify(form) !== JSON.stringify(initialFormRef.current)

  function handleClose() {
    if (showDeleteConfirm) { setShowDeleteConfirm(false); return }
    if (isDirty) { setShowDiscardConfirm(true) } else { onClose() }
  }

  const displayLinkedEntity = linkedEntity ?? (task ? linkedEntityFromTask(task) : undefined)
  const title = mode === 'edit' ? 'Edit Task' : 'New Task'
  const actionLabel = mode === 'edit' ? 'Save Task' : 'Create Task'
  const savingLabel = mode === 'edit' ? 'Saving...' : 'Creating...'

  const currentPriority = PRIORITIES.find((p) => p.value === form.priority) ?? PRIORITIES[1]
  const currentStatus = STATUSES.find((s) => s.value === form.status) ?? STATUSES[0]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6" onClick={handleClose}>
      <div className="w-full max-w-3xl h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 border-b border-slate-100 bg-white px-6 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {displayLinkedEntity && (
              <p className="mt-0.5 text-xs font-medium text-slate-500">{linkedEntityLabel(displayLinkedEntity)}</p>
            )}
          </div>

          {/* Priority + Status pills */}
          <div ref={dropdownRef} className="flex items-center gap-2 relative">
            {/* Priority pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown(openDropdown === 'priority' ? null : 'priority')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${currentPriority.pill}`}
              >
                <PriorityIcon value={form.priority} />
                {currentPriority.label}
                <svg className="h-3 w-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openDropdown === 'priority' && (
                <div className="absolute right-0 top-full mt-1 w-36 rounded-xl border border-slate-200 bg-white shadow-lg z-20 py-1 overflow-hidden">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => { setForm((prev) => ({ ...prev, priority: p.value })); setOpenDropdown(null) }}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${p.value === form.priority ? p.pill : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <PriorityIcon value={p.value} />
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Status pill */}
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
                <div className="absolute right-0 top-full mt-1 w-52 rounded-xl border border-slate-200 bg-white shadow-lg z-20 py-1 overflow-hidden">
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

            {mode === 'edit' && task?.id && (
              <Link
                href={`/tasks/${task.id}`}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Open full task view"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form — flex column so description can grow */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 relative">

          {/* Compact metadata fields */}
          <div className="flex-shrink-0 px-6 pt-4">
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}

            {/* Task Title */}
            <div className="group flex items-center gap-2 py-2 border-b border-slate-100">
              <div className="flex-shrink-0 w-28 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                Task Title <span className="text-red-400">*</span>
              </div>
              <div className="flex-1 min-w-0">
                {editingField === 'title' ? (
                  <input
                    type="text"
                    value={form.title}
                    required
                    autoFocus
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                    onBlur={() => setEditingField(null)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setEditingField(null) } }}
                    className="w-full px-2 py-1 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <span className="text-sm font-medium text-slate-800 leading-tight">
                    {form.title || <span className="text-slate-400 italic">Untitled task</span>}
                  </span>
                )}
              </div>
              {editingField !== 'title' && (
                <button
                  type="button"
                  onClick={() => setEditingField('title')}
                  className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                  aria-label="Edit title"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>

            {/* Dept/Category + Due Date */}
            <div className="grid grid-cols-2 border-b border-slate-100">
              <div className="group flex items-center gap-2 py-2 pr-3 border-r border-slate-100">
                <div className="flex-shrink-0 w-20 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Dept</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'dept' ? (
                    <TaskAssignmentSelect
                      department={form.department || null}
                      category={form.category || null}
                      onChange={(assignment) => {
                        setForm((p) => ({ ...p, department: assignment.department ?? '', category: assignment.category ?? '' }))
                        setEditingField(null)
                      }}
                    />
                  ) : (
                    <span className="text-sm text-slate-700 leading-tight">
                      {form.department
                        ? <>{form.department}{form.category && <span className="text-slate-400"> · {form.category}</span>}</>
                        : <span className="text-slate-400 italic">Not set</span>
                      }
                    </span>
                  )}
                </div>
                {editingField !== 'dept' && (
                  <button
                    type="button"
                    onClick={() => setEditingField('dept')}
                    className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    aria-label="Edit department"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 py-2 pl-3">
                <div className="flex-shrink-0 w-20 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Due Date</div>
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-sm text-slate-700 leading-tight">
                    {form.due_date
                      ? new Date(form.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : <span className="text-slate-400 italic">No date</span>
                    }
                  </span>
                  <button
                    type="button"
                    onClick={() => (dueDateRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.() ?? dueDateRef.current?.click()}
                    className="flex-shrink-0 p-1 text-slate-400 hover:text-purple-600 transition-colors rounded"
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
                    value={form.due_date}
                    onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>

            {/* Assigned To + Assigned By */}
            <div className="grid grid-cols-2">
              <div className="group flex items-center gap-2 py-2 pr-3 border-r border-slate-100">
                <div className="flex-shrink-0 w-20 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Assigned To</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'assigned_to' ? (
                    <select
                      value={form.assigned_to}
                      autoFocus
                      onChange={(e) => { setForm((p) => ({ ...p, assigned_to: e.target.value })); setEditingField(null) }}
                      onBlur={() => setEditingField(null)}
                      className="w-full px-2 py-1 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                    >
                      <option value="">- Unassigned -</option>
                      {crmUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.display_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-700 leading-tight">
                      {form.assigned_to
                        ? (crmUsers.find((u) => u.id === form.assigned_to)?.display_name ?? 'Unknown')
                        : <span className="text-slate-400 italic">Unassigned</span>
                      }
                    </span>
                  )}
                </div>
                {editingField !== 'assigned_to' && (
                  <button
                    type="button"
                    onClick={() => setEditingField('assigned_to')}
                    className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    aria-label="Edit assignee"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 py-2 pl-3">
                <div className="flex-shrink-0 w-20 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Assigned By</div>
                <span className="text-sm text-slate-700 leading-tight">
                  {mode === 'edit' && task?.created_user
                    ? task.created_user.display_name
                    : <span className="text-slate-400 italic">—</span>
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Description — grows to fill remaining space */}
          <div className="flex-1 flex flex-col min-h-0 px-6 pt-3 pb-1">
            <div className="flex-shrink-0 flex items-center justify-between mb-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Description</span>
              {editingField !== 'description' && (
                <button
                  type="button"
                  onClick={() => setEditingField('description')}
                  className="p-0.5 text-slate-300 hover:text-purple-600 transition-colors rounded"
                  aria-label="Edit description"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
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
                className="flex-1 min-h-0 overflow-y-auto cursor-text rounded-lg border border-slate-200 hover:border-slate-300 bg-white px-3 py-2 transition-colors"
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
          </div>

          {/* Collapsible Attachments */}
          <div className="flex-shrink-0 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAttachmentsExpanded((p) => !p)}
              className="w-full flex items-center gap-2 px-6 py-2 text-left hover:bg-slate-50 transition-colors"
            >
              <svg className={`h-3 w-3 text-slate-400 transition-transform flex-shrink-0 ${attachmentsExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Attachments</span>
              {(existingAttachments.length + pendingFiles.length) > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full leading-none">
                  {existingAttachments.length + pendingFiles.length}
                </span>
              )}
            </button>
            {attachmentsExpanded && (
              <div className="px-6 pb-3 space-y-2">
                {existingAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {existingAttachments.map((att) => (
                      <span key={att.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="hover:underline truncate max-w-[160px]">
                          {att.file_name ?? 'file'}
                        </a>
                        <button
                          type="button"
                          onClick={() => deleteExistingAttachment(att.id)}
                          className="text-slate-400 hover:text-red-500 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? [])
                    setPendingFiles((prev) => [...prev, ...files])
                    e.target.value = ''
                  }}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                />
                {pendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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
            )}
          </div>

          {/* Collapsible Notes (edit mode only) */}
          {mode === 'edit' && task?.id && (
            <div className="flex-shrink-0 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setNotesExpanded((p) => !p)}
                className="w-full flex items-center gap-2 px-6 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <svg className={`h-3 w-3 text-slate-400 transition-transform flex-shrink-0 ${notesExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Notes</span>
                {notes.length > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full leading-none">
                    {notes.length}
                  </span>
                )}
              </button>
              {notesExpanded && (
                <div className="px-6 pb-3 space-y-3">
                  <div className="flex gap-2 items-start">
                    <textarea
                      rows={2}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitNote()
                      }}
                      placeholder="Add a note…"
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                    />
                    <button
                      type="button"
                      onClick={submitNote}
                      disabled={submittingNote || !noteText.trim()}
                      className="px-3 py-2 bg-purple-700 text-white text-xs font-semibold rounded-lg hover:bg-purple-800 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {submittingNote ? 'Saving…' : 'Add Note'}
                    </button>
                  </div>
                  {notes.length === 0 ? (
                    <p className="text-xs text-slate-400">No notes yet.</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-2.5 pr-1">
                      {[...notes].reverse().map((n) => (
                        <div key={n.id} className="bg-slate-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-semibold text-slate-700">{n.user.display_name}</span>
                            <span className="text-xs text-slate-400">{relativeTime(n.created_at)}</span>
                          </div>
                          <p className="text-xs text-slate-600 whitespace-pre-wrap">{n.comment}</p>
                        </div>
                      ))}
                      <div ref={notesEndRef} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-t border-slate-100">
            <div>
              {mode === 'edit' && task?.id && (appUser?.is_admin || task.created_by === appUser?.id || task.task_owner === appUser?.id) && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="flex gap-3">
              {mode === 'edit' && task?.created_by && (
                <button
                  type="button"
                  onClick={handleSendForApproval}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-yellow-700 border border-yellow-300 bg-yellow-50 rounded-xl hover:bg-yellow-100 disabled:opacity-60 transition-colors"
                >
                  Send for Approval
                </button>
              )}
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
  defaultDepartment,
  linkedEntity,
}: {
  open: boolean
  onClose: () => void
  onCreated: (task: TaskFormTask) => void
  defaultDepartment?: CrmTaskDepartment
  linkedEntity?: TaskLinkedEntity
}) {
  return (
    <TaskFormModal
      open={open}
      mode="create"
      onClose={onClose}
      onSaved={onCreated}
      defaultDepartment={defaultDepartment}
      linkedEntity={linkedEntity}
    />
  )
}
