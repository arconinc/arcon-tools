'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import EntitySearchPicker from '@/components/crm/EntitySearchPicker'
import { TaskAssignmentSelect } from '@/components/crm/TaskAssignmentSelect'
import { TaskDescriptionEditor } from '@/components/crm/TaskDescriptionEditor'
import { getTaskCategoryLabel } from '@/lib/task-constants'
import { useAppUser } from '@/components/layout/AppShell'
import { formatDate, formatDateTime, formatBytes } from '@/lib/format'
import { useTask } from '@/hooks/useTask'
import type { TaskPriority } from '@/hooks/useTask'
import { TaskStatusBar, STATUSES } from '@/components/crm/task/TaskStatusBar'
import { TaskNotesPreview } from '@/components/crm/task/TaskNotesPreview'
import { CommentsTab } from '@/components/crm/task/CommentsTab'

// ── Local Types ───────────────────────────────────────────────────────────────

type DropdownUser = { id: string; display_name: string; email: string }
type DropdownContact = { id: string; first_name: string; last_name: string }

// ── Local Constants ───────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  low: 'bg-slate-100 text-slate-500',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-red-100 text-red-700',
}

// ── Local Helpers ─────────────────────────────────────────────────────────────

function formatTaskAssignment(department: string | null, category: string | null) {
  if (department && category) return `${department} / ${getTaskCategoryLabel(category)}`
  return department ?? category ?? null
}

function isHtmlContent(str: string) {
  return str.trim().startsWith('<')
}

function isImageMime(mime: string | null) {
  return mime?.startsWith('image/') ?? false
}

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

  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'comments'>('details')
  const [editingField, setEditingField] = useState<'title' | 'priority' | 'dept' | 'due_date' | 'assigned_to' | 'description' | null>(null)
  const descriptionDraftRef = useRef<string | null>(null)
  const dueDateRef = useRef<HTMLInputElement>(null)
  const [editingLinked, setEditingLinked] = useState(false)
  const [linkedForm, setLinkedForm] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)
  const [uploadingAttachment, setUploadingAttachment] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [contacts, setContacts] = useState<DropdownContact[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/marketing/users').then((r) => r.json()),
      fetch('/api/marketing/contacts').then((r) => r.json()),
    ]).then(([users, conts]) => {
      if (Array.isArray(users)) setCrmUsers(users)
      if (Array.isArray(conts)) setContacts(conts)
    })
  }, [])

  useEffect(() => {
    if (isNew) {
      router.replace('/marketing/tasks')
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

  async function quickUpdateStatus(newStatus: string) {
    if (!task) return
    const prev = task.status
    setTask((t) => t ? { ...t, status: newStatus as typeof task.status } : t)
    try {
      const res = await fetch(`/api/marketing/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) setTask((t) => t ? { ...t, status: prev } : t)
      else await refetch()
    } catch {
      setTask((t) => t ? { ...t, status: prev } : t)
    }
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
      router.push('/marketing/tasks')
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
        <Link href="/marketing/tasks" className="text-sm text-slate-500 hover:text-slate-700">← Tasks</Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error ?? 'Task not found'}
        </div>
      </div>
    )
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
  const statusInfo = STATUSES.find((s) => s.value === task.status)

  const linkedObj = task.opportunity
    ? { type: 'opportunity', label: 'Opportunity', href: `/marketing/opportunities/${task.opportunity.id}`, name: task.opportunity.name, color: 'bg-purple-100 text-purple-700' }
    : task.customer
    ? { type: 'customer', label: 'Customer', href: `/marketing/customers/${task.customer.id}`, name: task.customer.name, color: 'bg-blue-100 text-blue-700' }
    : task.vendor
    ? { type: 'vendor', label: 'Supplier', href: `/marketing/vendors/${task.vendor.id}`, name: task.vendor.name, color: 'bg-orange-100 text-orange-700' }
    : task.contact
    ? { type: 'contact', label: 'Contact', href: `/marketing/contacts/${task.contact.id}`, name: `${task.contact.first_name} ${task.contact.last_name}`, color: 'bg-teal-100 text-teal-700' }
    : null


  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href="/marketing/tasks" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tasks
      </Link>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-900">Delete Task?</h2>
            </div>
            <p className="text-sm text-slate-600 mb-1">
              You are about to permanently delete:
            </p>
            <p className="text-sm font-semibold text-slate-900 mb-4 bg-slate-50 px-3 py-2 rounded-lg truncate">
              {task.title}
            </p>
            <p className="text-sm text-red-600 font-medium mb-6">
              This cannot be undone. All comments, history, and attachments will be deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={deleteTask}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-900">{task.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {statusInfo && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusInfo.cls}`}>
                  {statusInfo.label}
                </span>
              )}
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize ${PRIORITY_BADGE[task.priority]}`}>
                {task.priority} priority
              </span>
              {task.due_date && (
                <span className={`text-sm ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                  {isOverdue ? '⚠️ ' : ''}Due {formatDate(task.due_date)}
                </span>
              )}
              {task.assigned_user && (
                <span className="text-sm text-slate-500">
                  Assigned to <span className="font-medium text-slate-700">{task.assigned_user.display_name}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-3 flex-wrap text-xs text-slate-400">
              {task.created_user && (
                <span>Created by <span className="font-medium text-slate-600">{task.created_user.display_name}</span></span>
              )}
              {task.delegator_users.length > 0 && (
                <span>
                  Delegated by{' '}
                  <span className="font-medium text-slate-600">
                    {task.delegator_users.map((u) => u.display_name).join(' → ')}
                  </span>
                </span>
              )}
            </div>
          </div>
          {(appUser?.is_admin || task.created_by === appUser?.id || task.task_owner === appUser?.id) && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-slate-700">Status</span>
        </div>
        <TaskStatusBar currentStatus={task.status} onStatusClick={quickUpdateStatus} disabled={false} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-5">
        {(['details', 'related', 'comments'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab ? 'font-bold text-purple-700 border-purple-700' : 'font-medium text-slate-500 border-transparent hover:text-slate-700'
            }`}
          >
            {tab === 'comments' ? 'Notes' : tab}
            {tab === 'comments' && task.comments.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{task.comments.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Details Tab ── */}
      {activeTab === 'details' && (
        <div className="space-y-5">
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

              {/* Department / Category */}
              <div className="group flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Dept / Category</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'dept' ? (
                    <TaskAssignmentSelect
                      department={task.department ?? null}
                      category={task.category ?? null}
                      onChange={(a) => {
                        saveFieldValues({ department: a.department ?? null, category: a.category ?? null })
                        setEditingField(null)
                      }}
                    />
                  ) : (
                    <span className="text-sm text-slate-800">
                      {formatTaskAssignment(task.department, task.category) ?? <span className="italic text-slate-400">Not set</span>}
                    </span>
                  )}
                </div>
                {editingField !== 'dept' && (
                  <button type="button" onClick={() => setEditingField('dept')}
                    className="flex-shrink-0 p-1 text-slate-300 hover:text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                    aria-label="Edit department">
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

              {/* Assigned To */}
              <div className="group flex items-center gap-3 px-6 py-3">
                <div className="w-36 flex-shrink-0 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Assigned To</div>
                <div className="flex-1 min-w-0">
                  {editingField === 'assigned_to' ? (
                    <select
                      defaultValue={task.assigned_to ?? ''}
                      autoFocus
                      onChange={(e) => { saveFieldValue('assigned_to', e.target.value || null); setEditingField(null) }}
                      onBlur={() => setEditingField(null)}
                      className="w-full px-2 py-1 text-sm border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                    >
                      <option value="">— Unassigned —</option>
                      {crmUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.display_name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-slate-800">
                      {task.assigned_user?.display_name ?? <span className="italic text-slate-400">Unassigned</span>}
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

              {/* Description */}
              <div className="px-6 pt-4 pb-5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Description</span>
                  {editingField !== 'description' && (
                    <button
                      type="button"
                      onClick={() => { descriptionDraftRef.current = task.description ?? ''; setEditingField('description') }}
                      className="p-1 text-slate-300 hover:text-purple-600 transition-colors rounded"
                      aria-label="Edit description"
                    >
                      <PencilIcon />
                    </button>
                  )}
                </div>

                {editingField === 'description' ? (
                  <div
                    className="flex flex-col"
                    style={{ minHeight: 220 }}
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                        const html = descriptionDraftRef.current
                        if (html !== null && html !== task.description) {
                          saveFieldValue('description', html || null)
                        }
                        setEditingField(null)
                      }
                    }}
                  >
                    <TaskDescriptionEditor
                      initialHtml={task.description ?? ''}
                      onChange={(html) => { descriptionDraftRef.current = html }}
                    />
                  </div>
                ) : (
                  <div
                    className="cursor-text min-h-[60px] rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50/50 px-3 py-2 transition-colors"
                    onClick={() => { descriptionDraftRef.current = task.description ?? ''; setEditingField('description') }}
                  >
                    {task.description ? (
                      isHtmlContent(task.description) ? (
                        <div className="prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: task.description }} />
                      ) : (
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.description}</p>
                      )
                    ) : (
                      <p className="text-sm text-slate-400 italic">Add a description…</p>
                    )}
                  </div>
                )}
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

          <TaskNotesPreview
            comments={task.comments}
            onViewAll={() => setActiveTab('comments')}
          />

          {/* Attachments */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">
                Attachments
                {task.attachments.length > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">({task.attachments.length})</span>
                )}
              </h2>
              <div>
                <input
                  ref={attachmentInputRef}
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (file) await uploadTaskAttachment(file)
                    e.target.value = ''
                  }}
                />
                <button
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={uploadingAttachment}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors disabled:opacity-60"
                >
                  {uploadingAttachment ? 'Uploading…' : '+ Attach'}
                </button>
              </div>
            </div>
            {task.attachments.length === 0 ? (
              <div className="px-6 py-4 text-sm text-slate-400">No attachments yet.</div>
            ) : (
              <div className="p-4 flex flex-wrap gap-2">
                {task.attachments.map((att) => (
                  <div key={att.id} className="group relative">
                    {isImageMime(att.mime_type) ? (
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                        className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-300 transition-colors">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={att.url} alt={att.file_name ?? 'attachment'} className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <a href={att.url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors">
                        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span className="truncate max-w-[160px]">{att.file_name ?? 'file'}</span>
                        {att.file_size && <span className="text-slate-400 flex-shrink-0">{formatBytes(att.file_size)}</span>}
                      </a>
                    )}
                    {(att.uploaded_by === appUser?.id || appUser?.is_admin) && (
                      <button
                        onClick={() => deleteTaskAttachment(att.id)}
                        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center text-xs leading-none"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* History timeline */}
          {task.history.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Change History</h2>
              </div>
              <div className="p-4 space-y-0">
                {task.history.map((h, idx) => (
                  <div key={h.id} className={`flex gap-4 ${idx < task.history.length - 1 ? 'pb-4' : ''}`}>
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />
                      {idx < task.history.length - 1 && <div className="w-px flex-1 bg-slate-100 my-1" />}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{h.user.display_name}</span>
                        {' changed '}
                        <span className="font-medium text-slate-700">{h.field_changed.replace(/_/g, ' ')}</span>
                        {h.old_value != null && (
                          <> from <span className="font-mono bg-slate-100 px-1 rounded">{h.old_value}</span></>
                        )}
                        {h.new_value != null && (
                          <> to <span className="font-mono bg-purple-50 text-purple-700 px-1 rounded">{h.new_value}</span></>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDateTime(h.changed_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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

      {/* ── Comments Tab ── */}
      {activeTab === 'comments' && appUser && (
        <CommentsTab
          taskId={task.id}
          comments={task.comments}
          currentUserId={appUser.id}
          isAdmin={appUser.is_admin}
          onRefresh={refetch}
        />
      )}
    </div>
  )
}
