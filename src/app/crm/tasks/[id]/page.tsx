'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAppUser } from '@/components/layout/AppShell'

// ── Types ─────────────────────────────────────────────────────────────────────

type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'waiting_on_approval' | 'waiting_on_client_approval' | 'need_changes'
type TaskPriority = 'low' | 'medium' | 'high'

type DropdownUser = { id: string; display_name: string; email: string }
type DropdownCustomer = { id: string; name: string }
type DropdownVendor = { id: string; name: string }
type DropdownOpportunity = { id: string; name: string }
type DropdownContact = { id: string; first_name: string; last_name: string }

type Attachment = {
  id: string; comment_id: string; label: string; url: string
  file_name: string | null; file_size: number | null; mime_type: string | null
  is_drive_link: boolean; uploaded_by: string; created_at: string
}

type Comment = {
  id: string; task_id: string; user_id: string; comment: string
  created_at: string; updated_at: string
  attachments: Attachment[]
  user: { display_name: string }
}

type HistoryEntry = {
  id: string; task_id: string; user_id: string; field_changed: string
  old_value: string | null; new_value: string | null; changed_at: string
  user: { id: string; display_name: string }
}

type TaskDetail = {
  id: string; title: string; assigned_to: string | null; task_owner: string | null
  category: string | null; priority: TaskPriority; due_date: string | null
  status: TaskStatus; progress: number; description: string | null
  opportunity_id: string | null; customer_id: string | null
  vendor_id: string | null; contact_id: string | null
  created_by: string; created_at: string; updated_at: string
  comments: Comment[]
  history: HistoryEntry[]
  opportunity: { id: string; name: string } | null
  customer: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  contact: { id: string; first_name: string; last_name: string } | null
  assigned_user: { id: string; display_name: string; email: string } | null
}

type CreateForm = {
  title: string; assigned_to: string; category: string; priority: string
  due_date: string; status: string; description: string; progress: string
  opportunity_id: string; customer_id: string; vendor_id: string; contact_id: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES: { value: TaskStatus; label: string; cls: string }[] = [
  { value: 'not_started', label: 'Not Started', cls: 'bg-slate-100 text-slate-600' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', cls: 'bg-green-100 text-green-700' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval', cls: 'bg-yellow-100 text-yellow-700' },
  { value: 'waiting_on_client_approval', label: 'Waiting on Client Approval', cls: 'bg-orange-100 text-orange-700' },
  { value: 'need_changes', label: 'Need Changes', cls: 'bg-red-100 text-red-600' },
]

const PRIORITY_BADGE: Record<TaskPriority, string> = {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function statusBadge(status: string) {
  const s = STATUSES.find((x) => x.value === status)
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s?.cls ?? 'bg-slate-100 text-slate-600'}`}>
      {s?.label ?? status}
    </span>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-sm text-slate-800">{value || <span className="text-slate-300">—</span>}</div>
    </div>
  )
}

function FieldInput({
  label, name, value, onChange, type = 'text', textarea = false,
}: {
  label: string; name: string; value: string; onChange: (n: string, v: string) => void
  type?: string; textarea?: boolean
}) {
  const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{label}</label>
      {textarea
        ? <textarea rows={3} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls + ' resize-none'} />
        : <input type={type} value={value} onChange={(e) => onChange(name, e.target.value)} className={cls} />}
    </div>
  )
}

function fmtFileSize(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function isImageMime(mime: string | null) {
  return mime?.startsWith('image/') ?? false
}

// ── Comments Tab ──────────────────────────────────────────────────────────────

function CommentsTab({
  taskId,
  comments,
  currentUserId,
  isAdmin,
  onRefresh,
}: {
  taskId: string
  comments: Comment[]
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLabel, setDriveLabel] = useState('')
  const [showDriveForm, setShowDriveForm] = useState(false)
  const [pendingCommentId, setPendingCommentId] = useState<string | null>(null)
  const [uploadingCommentId, setUploadingCommentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function submitComment() {
    if (!text.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/crm/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text.trim() }),
      })
      if (res.ok) {
        setText('')
        onRefresh()
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteComment(cid: string) {
    if (!confirm('Delete this comment?')) return
    await fetch(`/api/crm/tasks/${taskId}/comments/${cid}`, { method: 'DELETE' })
    onRefresh()
  }

  async function addDriveLink(cid: string) {
    if (!driveUrl.trim() || !driveLabel.trim()) return
    await fetch(`/api/crm/tasks/${taskId}/comments/${cid}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: driveUrl.trim(), label: driveLabel.trim(), is_drive_link: true }),
    })
    setDriveUrl('')
    setDriveLabel('')
    setShowDriveForm(false)
    setPendingCommentId(null)
    onRefresh()
  }

  async function uploadFile(cid: string, file: File) {
    setUploadingCommentId(cid)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const uploadRes = await fetch('/api/crm/upload', { method: 'POST', body: fd })
      if (!uploadRes.ok) { alert('Upload failed'); return }
      const uploaded = await uploadRes.json()
      await fetch(`/api/crm/tasks/${taskId}/comments/${cid}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: uploaded.url,
          label: uploaded.file_name,
          file_name: uploaded.file_name,
          file_size: uploaded.file_size,
          mime_type: uploaded.mime_type,
          is_drive_link: false,
        }),
      })
      onRefresh()
    } finally {
      setUploadingCommentId(null)
    }
  }

  async function deleteAttachment(cid: string, aid: string) {
    if (!confirm('Remove this attachment?')) return
    await fetch(`/api/crm/tasks/${taskId}/comments/${cid}/attachments/${aid}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-5">
      {/* New comment */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-700 mb-3">Add Comment</div>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-3"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={submitComment}
            disabled={submitting || !text.trim()}
            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
          >
            {submitting ? 'Posting…' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comment list */}
      {comments.length === 0 && (
        <div className="text-center text-sm text-slate-400 py-6">No comments yet. Be the first to comment!</div>
      )}

      {comments.map((c) => (
        <div key={c.id} className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 flex-shrink-0">
                {c.user.display_name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-slate-800">{c.user.display_name}</span>
              <span className="text-xs text-slate-400">{fmtDateTime(c.created_at)}</span>
            </div>
            {(c.user_id === currentUserId || isAdmin) && (
              <button
                onClick={() => deleteComment(c.id)}
                className="text-xs text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
              >
                Delete
              </button>
            )}
          </div>

          <p className="text-sm text-slate-700 whitespace-pre-wrap mb-3">{c.comment}</p>

          {/* Attachments */}
          {c.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {c.attachments.map((att) => (
                <div key={att.id} className="group relative">
                  {isImageMime(att.mime_type) ? (
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:border-purple-300 transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={att.url} alt={att.label} className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <a href={att.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition-colors">
                      {att.is_drive_link ? (
                        <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6.19 2l4.5 7.79H2l4.19-7.79zM12 2l6.19 10.72H5.81L12 2zM22 14.39L17.81 22H6.19L2 14.39h20z" />
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                      )}
                      <span className="truncate max-w-[120px]">{att.label}</span>
                      {att.file_size && <span className="text-slate-400 flex-shrink-0">{fmtFileSize(att.file_size)}</span>}
                    </a>
                  )}
                  {(att.uploaded_by === currentUserId || isAdmin) && (
                    <button
                      onClick={() => deleteAttachment(c.id, att.id)}
                      className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-5 h-5 bg-red-500 text-white rounded-full items-center justify-center text-xs leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Attach to this comment */}
          <div className="flex items-center gap-2 flex-wrap">
            <input
              ref={c.id === pendingCommentId ? fileInputRef : undefined}
              type="file"
              className="hidden"
              id={`file-input-${c.id}`}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (file) await uploadFile(c.id, file)
                e.target.value = ''
              }}
            />
            <label
              htmlFor={`file-input-${c.id}`}
              className="cursor-pointer text-xs text-slate-400 hover:text-purple-700 transition-colors flex items-center gap-1"
            >
              {uploadingCommentId === c.id ? (
                <span>Uploading…</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach file
                </>
              )}
            </label>

            <button
              onClick={() => {
                setPendingCommentId(c.id)
                setShowDriveForm((prev) => !prev || pendingCommentId !== c.id)
              }}
              className="text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.19 2l4.5 7.79H2l4.19-7.79zM12 2l6.19 10.72H5.81L12 2zM22 14.39L17.81 22H6.19L2 14.39h20z" />
              </svg>
              Add Drive link
            </button>
          </div>

          {/* Drive link inline form */}
          {showDriveForm && pendingCommentId === c.id && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
              <input
                type="url"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
                placeholder="Google Drive URL"
                className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <input
                type="text"
                value={driveLabel}
                onChange={(e) => setDriveLabel(e.target.value)}
                placeholder="Label (e.g. Design Brief v2)"
                className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => addDriveLink(c.id)}
                  disabled={!driveUrl.trim() || !driveLabel.trim()}
                  className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  Add Link
                </button>
                <button
                  onClick={() => { setShowDriveForm(false); setPendingCommentId(null) }}
                  className="px-3 py-1 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TaskDetailPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const id = params.id
  const isNew = id === 'new'
  const { user: appUser } = useAppUser()

  const [task, setTask] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'details' | 'related' | 'comments'>('details')
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<Partial<TaskDetail>>({})
  const [saving, setSaving] = useState(false)

  // Dropdown data
  const [crmUsers, setCrmUsers] = useState<DropdownUser[]>([])
  const [customers, setCustomers] = useState<DropdownCustomer[]>([])
  const [vendors, setVendors] = useState<DropdownVendor[]>([])
  const [opportunities, setOpportunities] = useState<DropdownOpportunity[]>([])
  const [contacts, setContacts] = useState<DropdownContact[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/crm/users').then((r) => r.json()),
      fetch('/api/crm/customers').then((r) => r.json()),
      fetch('/api/crm/vendors').then((r) => r.json()),
      fetch('/api/crm/opportunities').then((r) => r.json()),
      fetch('/api/crm/contacts').then((r) => r.json()),
    ]).then(([users, custs, vends, opps, conts]) => {
      if (Array.isArray(users)) setCrmUsers(users)
      if (Array.isArray(custs)) setCustomers(custs)
      if (Array.isArray(vends)) setVendors(vends)
      // opportunities API returns { items: [...], pipeline_total: ... }
      if (opps?.items && Array.isArray(opps.items)) setOpportunities(opps.items)
      if (Array.isArray(conts)) setContacts(conts)
    })
  }, [])

  // Create form
  const [createForm, setCreateForm] = useState<CreateForm>({
    title: '',
    assigned_to: '',
    category: '',
    priority: 'medium',
    due_date: '',
    status: 'not_started',
    description: '',
    progress: '0',
    opportunity_id: searchParams.get('opportunity_id') ?? '',
    customer_id: searchParams.get('customer_id') ?? '',
    vendor_id: searchParams.get('vendor_id') ?? '',
    contact_id: searchParams.get('contact_id') ?? '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  async function loadTask() {
    const res = await fetch(`/api/crm/tasks/${id}`)
    const data = await res.json()
    if (data.error) { setError(data.error); return }
    setTask(data)
  }

  useEffect(() => {
    if (isNew) return
    setLoading(true)
    loadTask().finally(() => setLoading(false))
  }, [id, isNew])

  function startEdit() {
    if (!task) return
    setEditForm({ ...task })
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
    setEditForm({})
  }

  function handleEditChange(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value === '' ? null : value }))
  }

  async function saveEdit() {
    if (!task) return
    setSaving(true)
    try {
      const payload = { ...editForm }
      if (typeof payload.progress === 'string') payload.progress = Number(payload.progress) as any
      const res = await fetch(`/api/crm/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? 'Save failed'); return }
      // Reload full detail to get new history
      await loadTask()
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!createForm.title.trim()) { setCreateError('Title is required'); return }
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createForm.title.trim(),
          assigned_to: createForm.assigned_to || null,
          category: createForm.category || null,
          priority: createForm.priority || 'medium',
          due_date: createForm.due_date || null,
          status: createForm.status || 'not_started',
          description: createForm.description || null,
          progress: createForm.progress ? Number(createForm.progress) : 0,
          opportunity_id: createForm.opportunity_id || null,
          customer_id: createForm.customer_id || null,
          vendor_id: createForm.vendor_id || null,
          contact_id: createForm.contact_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setCreateError(data.error ?? 'Create failed'); return }
      router.push(`/crm/tasks/${data.id}`)
    } finally {
      setCreating(false)
    }
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  if (isNew) {
    const cf = createForm
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <Link href="/crm/tasks" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tasks
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mb-6">New Task</h1>
        <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          {createError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{createError}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input type="text" value={cf.title} required
              onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</label>
              <select value={cf.category}
                onChange={(e) => setCreateForm((p) => ({ ...p, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="">— Select —</option>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Priority</label>
              <select value={cf.priority}
                onChange={(e) => setCreateForm((p) => ({ ...p, priority: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
              <select value={cf.status}
                onChange={(e) => setCreateForm((p) => ({ ...p, status: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Due Date</label>
              <input type="date" value={cf.due_date}
                onChange={(e) => setCreateForm((p) => ({ ...p, due_date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
            <select value={cf.assigned_to}
              onChange={(e) => setCreateForm((p) => ({ ...p, assigned_to: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
              <option value="">— Unassigned —</option>
              {crmUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
            <textarea rows={3} value={cf.description}
              onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none" />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Link To (optional — select one)</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Opportunity</label>
                <select value={cf.opportunity_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, opportunity_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="">— None —</option>
                  {opportunities.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Customer</label>
                <select value={cf.customer_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, customer_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="">— None —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Vendor</label>
                <select value={cf.vendor_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, vendor_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="">— None —</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contact</label>
                <select value={cf.contact_id}
                  onChange={(e) => setCreateForm((p) => ({ ...p, contact_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                  <option value="">— None —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={creating}
              className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
              {creating ? 'Creating…' : 'Create Task'}
            </button>
            <Link href="/crm/tasks" className="px-5 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    )
  }

  // ── Loading / error ─────────────────────────────────────────────────────────
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
        <Link href="/crm/tasks" className="text-sm text-slate-500 hover:text-slate-700">← Tasks</Link>
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error ?? 'Task not found'}
        </div>
      </div>
    )
  }

  const ef = editForm as Partial<TaskDetail>
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed'
  const statusInfo = STATUSES.find((s) => s.value === task.status)

  // Determine linked object
  const linkedObj = task.opportunity
    ? { type: 'opportunity', label: 'Opportunity', href: `/crm/opportunities/${task.opportunity.id}`, name: task.opportunity.name, color: 'bg-purple-100 text-purple-700' }
    : task.customer
    ? { type: 'customer', label: 'Customer', href: `/crm/customers/${task.customer.id}`, name: task.customer.name, color: 'bg-blue-100 text-blue-700' }
    : task.vendor
    ? { type: 'vendor', label: 'Vendor', href: `/crm/vendors/${task.vendor.id}`, name: task.vendor.name, color: 'bg-orange-100 text-orange-700' }
    : task.contact
    ? { type: 'contact', label: 'Contact', href: `/crm/contacts/${task.contact.id}`, name: `${task.contact.first_name} ${task.contact.last_name}`, color: 'bg-teal-100 text-teal-700' }
    : null

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link href="/crm/tasks" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Tasks
      </Link>

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
                  {isOverdue ? '⚠️ ' : ''}Due {fmtDate(task.due_date)}
                </span>
              )}
              {task.assigned_user && (
                <span className="text-sm text-slate-500">
                  Assigned to <span className="font-medium text-slate-700">{task.assigned_user.display_name}</span>
                </span>
              )}
            </div>
            {task.progress > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                </div>
                <span className="text-xs text-slate-400">{task.progress}%</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5">
        {(['details', 'related', 'comments'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg capitalize transition-colors ${
              activeTab === tab ? 'bg-purple-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
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
              {!editing ? (
                <button onClick={startEdit}
                  className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-60 transition-colors">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button onClick={cancelEdit}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-300 text-slate-600 rounded-lg hover:bg-white transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 grid grid-cols-2 gap-5">
              {editing ? (
                <>
                  <div className="col-span-2">
                    <FieldInput label="Title" name="title" value={(ef.title as string) ?? ''} onChange={handleEditChange} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Status</label>
                    <select value={(ef.status as string) ?? 'not_started'}
                      onChange={(e) => handleEditChange('status', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Priority</label>
                    <select value={(ef.priority as string) ?? 'medium'}
                      onChange={(e) => handleEditChange('priority', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Category</label>
                    <select value={(ef.category as string) ?? ''}
                      onChange={(e) => handleEditChange('category', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                      <option value="">— None —</option>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <FieldInput label="Due Date" name="due_date" value={(ef.due_date as string)?.slice(0, 10) ?? ''} onChange={handleEditChange} type="date" />
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Progress: {ef.progress ?? 0}%
                    </label>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={Number(ef.progress ?? 0)}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, progress: Number(e.target.value) as any }))}
                      className="w-full accent-purple-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Assigned To</label>
                    <select value={(ef.assigned_to as string) ?? ''}
                      onChange={(e) => handleEditChange('assigned_to', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                      <option value="">— Unassigned —</option>
                      {crmUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.display_name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <FieldInput label="Description" name="description" value={(ef.description as string) ?? ''} onChange={handleEditChange} textarea />
                  </div>
                  <div className="col-span-2 border-t border-slate-100 pt-4">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Linked Record</div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Opportunity</label>
                        <select value={(ef.opportunity_id as string) ?? ''}
                          onChange={(e) => handleEditChange('opportunity_id', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          <option value="">— None —</option>
                          {opportunities.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Customer</label>
                        <select value={(ef.customer_id as string) ?? ''}
                          onChange={(e) => handleEditChange('customer_id', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          <option value="">— None —</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Vendor</label>
                        <select value={(ef.vendor_id as string) ?? ''}
                          onChange={(e) => handleEditChange('vendor_id', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          <option value="">— None —</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">Contact</label>
                        <select value={(ef.contact_id as string) ?? ''}
                          onChange={(e) => handleEditChange('contact_id', e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white">
                          <option value="">— None —</option>
                          {contacts.map((c) => (
                            <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Status" value={statusInfo?.label ?? task.status} />
                  <Field label="Priority" value={task.priority} />
                  <Field label="Category" value={task.category} />
                  <Field label="Due Date" value={fmtDate(task.due_date)} />
                  <Field label="Progress" value={`${task.progress}%`} />
                  <Field label="Assigned To" value={task.assigned_user?.display_name ?? null} />
                  {task.description && (
                    <div className="col-span-2">
                      <Field label="Description" value={task.description} />
                    </div>
                  )}
                  {linkedObj && (
                    <div className="col-span-2">
                      <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Linked To</div>
                      <Link href={linkedObj.href} className="inline-flex items-center gap-2 hover:underline">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${linkedObj.color}`}>
                          {linkedObj.label.slice(0, 3)}
                        </span>
                        <span className="text-sm text-purple-700">{linkedObj.name}</span>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 bg-slate-50 flex gap-6 text-xs text-slate-400">
              <span>Created {fmtDate(task.created_at)}</span>
              <span>Updated {fmtDate(task.updated_at)}</span>
            </div>
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
                      <div className="text-xs text-slate-400 mt-0.5">{fmtDateTime(h.changed_at)}</div>
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
          {/* Linked object card */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Linked Record</h2>
            </div>
            {!linkedObj ? (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">This task is not linked to any record.</div>
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
          onRefresh={async () => {
            const data = await fetch(`/api/crm/tasks/${task.id}`).then((r) => r.json())
            if (!data.error) setTask(data)
          }}
        />
      )}
    </div>
  )
}
