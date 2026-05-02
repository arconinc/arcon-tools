'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useAppUser } from '@/components/layout/AppShell'
import { TaskAssignmentSelect } from '@/components/crm/TaskAssignmentSelect'
import type { CrmTask, CrmTaskDepartment } from '@/types'

type DropdownUser = { id: string; display_name: string; email: string }

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
}

const STATUSES = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval' },
  { value: 'waiting_on_client_approval', label: 'Waiting on Client Approval' },
  { value: 'need_changes', label: 'Need Changes' },
]

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
  defaultDepartment,
  linkedEntity,
  task,
}: {
  open: boolean
  mode: 'create' | 'edit'
  onClose: () => void
  onSaved: (task: TaskFormTask) => void
  defaultDepartment?: CrmTaskDepartment
  linkedEntity?: TaskLinkedEntity
  task?: TaskFormTask | null
}) {
  const { user: appUser } = useAppUser()
  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [form, setForm] = useState<TaskForm>(() => task ? formFromTask(task) : emptyForm(defaultDepartment))
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setForm(task ? formFromTask(task) : emptyForm(defaultDepartment))
    setPendingFiles([])
    setError(null)
    fetch('/api/crm/users')
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

  if (!open) return null

  async function uploadAttachments(taskId: string) {
    if (pendingFiles.length === 0) return
    await Promise.all(pendingFiles.map(async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/crm/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) return
      const uploaded = await uploadRes.json()
      await fetch(`/api/crm/tasks/${taskId}/attachments`, {
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
    const detailRes = await fetch(`/api/crm/tasks/${taskId}`)
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
      const res = await fetch(mode === 'edit' && taskId ? `/api/crm/tasks/${taskId}` : '/api/crm/tasks', {
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

  const displayLinkedEntity = linkedEntity ?? (task ? linkedEntityFromTask(task) : undefined)
  const title = mode === 'edit' ? 'Edit Task' : 'New Task'
  const actionLabel = mode === 'edit' ? 'Save Task' : 'Create Task'
  const savingLabel = mode === 'edit' ? 'Saving...' : 'Creating...'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
            {displayLinkedEntity && (
              <p className="mt-0.5 text-xs font-medium text-slate-500">{linkedEntityLabel(displayLinkedEntity)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              required
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Department / Category</label>
            <TaskAssignmentSelect
              department={form.department || null}
              category={form.category || null}
              onChange={(assignment) =>
                setForm((p) => ({
                  ...p,
                  department: assignment.department ?? '',
                  category: assignment.category ?? '',
                }))
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
              <select
                value={form.assigned_to}
                onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
              >
                <option value="">- Unassigned -</option>
                {crmUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.display_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Due Date</label>
              <input
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Attachments</label>
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
              <div className="mt-2 flex flex-wrap gap-1.5">
                {pendingFiles.map((file, index) => (
                  <span key={`${file.name}-${index}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 text-xs rounded-full">
                    {file.name}
                    <button
                      type="button"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-red-500 leading-none"
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
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
