'use client'

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { formatDateTime } from '@/lib/format'
import { TASK_STATUS_LABELS } from '@/lib/task-workflow'
import { TaskDescriptionEditor } from '@/components/crm/TaskDescriptionEditor'
import { ConfirmButton } from '@/components/ui/ConfirmButton'
import EmployeeAvatar from '@/components/employees/EmployeeAvatar'
import { PaperclipGlyph, SendGlyph, ReassignGlyph, DocumentGlyph, ImageGlyph } from '@/components/crm/task/TaskIcons'
import type { Comment, HistoryEntry, TaskAttachment } from '@/hooks/useTask'
import type { CrmTaskStatus } from '@/types'

type ParticipantRef = {
  id: string
  display_name: string
  avatar_url?: string | null
  profile_image_url?: string | null
}

function isImageMime(mime: string | null) {
  return mime?.startsWith('image/') ?? false
}

function isHtmlContent(str: string) {
  return str.trim().startsWith('<')
}

// Turns a history row into one clear, name-based sentence — never "you"/"me",
// always the resolved actor and (for assigned_to/team_id) the resolved
// old→new names the API already looks up, so a reassignment always reads
// like "Matt reassigned: Cami → Matt", not an ambiguous first-person label.
function formatHistoryLine(h: HistoryEntry): string {
  const actor = h.user.display_name
  if (h.field_changed === 'status') {
    const oldLabel = h.old_value ? (TASK_STATUS_LABELS[h.old_value as CrmTaskStatus] ?? h.old_value) : null
    const newLabel = h.new_value ? (TASK_STATUS_LABELS[h.new_value as CrmTaskStatus] ?? h.new_value) : '—'
    return oldLabel ? `${actor} moved status: ${oldLabel} → ${newLabel}` : `${actor} set status to ${newLabel}`
  }
  if (h.field_changed === 'assigned_to') {
    return `${actor} reassigned: ${h.old_value ?? 'Unassigned'} → ${h.new_value ?? 'Unassigned'}`
  }
  if (h.field_changed === 'team_id') {
    return `${actor} reassigned team: ${h.old_value ?? 'Unassigned'} → ${h.new_value ?? 'Unassigned'}`
  }
  if (h.field_changed === 'due_date') {
    const oldD = h.old_value ? formatDateTime(h.old_value) : null
    const newD = h.new_value ? formatDateTime(h.new_value) : 'none'
    return oldD ? `${actor} changed due date: ${oldD} → ${newD}` : `${actor} set due date to ${newD}`
  }
  const label = h.field_changed.replace(/_/g, ' ')
  if (h.old_value != null && h.new_value != null) return `${actor} changed ${label}: ${h.old_value} → ${h.new_value}`
  if (h.new_value != null) return `${actor} set ${label} to ${h.new_value}`
  return `${actor} changed ${label}`
}

// ── Shared bits: avatar+name header, attachment grid, per-message thread card ──

function MessageMeta({
  displayName,
  email,
  avatarUrl,
  profileImageUrl,
  badge,
}: {
  displayName: string
  email?: string | null
  avatarUrl?: string | null
  profileImageUrl?: string | null
  badge?: string
}) {
  return (
    <div className="flex items-center gap-2 mb-2 flex-wrap">
      <EmployeeAvatar displayName={displayName} avatarUrl={avatarUrl} profileImageUrl={profileImageUrl} size="sm" />
      <span className="text-sm font-semibold text-blue-700">{displayName}</span>
      {email && <span className="text-xs text-slate-400">{email}</span>}
      {badge && (
        <span className="text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
          {badge}
        </span>
      )}
    </div>
  )
}

type AttachmentCardItem = {
  id: string
  url: string
  label: string
  mimeType?: string | null
  isDriveLink?: boolean
  onDelete?: () => void
}

function AttachmentCard({ url, label, mimeType, isDriveLink, onDelete }: AttachmentCardItem) {
  const [confirming, setConfirming] = useState(false)
  return (
    <div className="group relative">
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="block w-28 rounded-lg border border-slate-200 overflow-hidden bg-white hover:border-purple-300 transition-colors">
        <div className="h-20 flex items-center justify-center bg-slate-50">
          {isImageMime(mimeType ?? null) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={label} className="w-full h-full object-cover" />
          ) : isDriveLink ? (
            <svg className="w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.19 2l4.5 7.79H2l4.19-7.79zM12 2l6.19 10.72H5.81L12 2zM22 14.39L17.81 22H6.19L2 14.39h20z" />
            </svg>
          ) : (
            <DocumentGlyph className="w-7 h-7 text-slate-300" />
          )}
        </div>
        <div className="px-2 py-1.5 border-t border-slate-100">
          <div className="text-[11px] font-medium text-slate-700 truncate">{label}</div>
        </div>
      </a>
      {onDelete && (
        <button
          type="button"
          onClick={() => {
            if (confirming) { setConfirming(false); onDelete() }
            else { setConfirming(true); setTimeout(() => setConfirming(false), 3000) }
          }}
          className={`absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center text-xs leading-none rounded-full transition-colors ${
            confirming ? 'bg-red-700 text-white w-auto px-1.5 py-0.5' : 'bg-red-500 text-white w-5 h-5'
          }`}
        >
          {confirming ? '?' : '×'}
        </button>
      )}
    </div>
  )
}

function AttachmentsGrid({ items }: { items: AttachmentCardItem[] }) {
  if (items.length === 0) return null
  return (
    <>
      <div className="border-t border-slate-100 my-3" />
      <div className="text-xs font-semibold text-slate-500 mb-2">
        {items.length} Attachment{items.length === 1 ? '' : 's'}
      </div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => <AttachmentCard key={item.id} {...item} />)}
      </div>
    </>
  )
}

function InlineAttachControls({
  onUploadFile,
  onAddDriveLink,
  uploading,
}: {
  onUploadFile: (file: File) => void
  onAddDriveLink?: (url: string, label: string) => void
  uploading: boolean
}) {
  const [showDriveForm, setShowDriveForm] = useState(false)
  const [driveUrl, setDriveUrl] = useState('')
  const [driveLabel, setDriveLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="mt-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUploadFile(file)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs text-slate-400 hover:text-purple-700 transition-colors flex items-center gap-1 disabled:opacity-60"
        >
          <PaperclipGlyph className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Attach file'}
        </button>
        {onAddDriveLink && (
          <button
            type="button"
            onClick={() => setShowDriveForm((prev) => !prev)}
            className="text-xs text-slate-400 hover:text-blue-600 transition-colors flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6.19 2l4.5 7.79H2l4.19-7.79zM12 2l6.19 10.72H5.81L12 2zM22 14.39L17.81 22H6.19L2 14.39h20z" />
            </svg>
            Add Drive link
          </button>
        )}
      </div>

      {showDriveForm && onAddDriveLink && (
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
          <input
            type="url" value={driveUrl} onChange={(e) => setDriveUrl(e.target.value)}
            placeholder="Google Drive URL"
            className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <input
            type="text" value={driveLabel} onChange={(e) => setDriveLabel(e.target.value)}
            placeholder="Label (e.g. Design Brief v2)"
            className="w-full px-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { onAddDriveLink(driveUrl.trim(), driveLabel.trim()); setDriveUrl(''); setDriveLabel(''); setShowDriveForm(false) }}
              disabled={!driveUrl.trim() || !driveLabel.trim()}
              className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              Add Link
            </button>
            <button
              onClick={() => setShowDriveForm(false)}
              className="px-3 py-1 text-xs text-slate-600 border border-slate-300 rounded-lg hover:bg-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ThreadHistoryItem({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="flex items-center gap-3 py-1.5 text-xs text-slate-500">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="flex-shrink-0">{formatHistoryLine(entry)} · {formatDateTime(entry.changed_at)}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  )
}

function ThreadDescriptionItem({
  authorName,
  authorEmail,
  authorAvatarUrl,
  authorProfileImageUrl,
  createdAt,
  description,
  attachments,
  editable,
  onSave,
  onUploadFile,
  onDeleteAttachment,
  uploading,
}: {
  authorName: string
  authorEmail?: string | null
  authorAvatarUrl?: string | null
  authorProfileImageUrl?: string | null
  createdAt: string
  description: string | null
  attachments: TaskAttachment[]
  editable: boolean
  onSave: (html: string) => void
  onUploadFile: (file: File) => void
  onDeleteAttachment: (attachmentId: string) => void
  uploading: boolean
}) {
  const [editing, setEditing] = useState(false)
  const draftRef = useRef<string | null>(null)

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <MessageMeta displayName={authorName} email={authorEmail} avatarUrl={authorAvatarUrl} profileImageUrl={authorProfileImageUrl} badge="Task description" />

      {editing ? (
        <div
          className="flex flex-col"
          style={{ minHeight: 180 }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              if (draftRef.current !== null && draftRef.current !== description) onSave(draftRef.current || '')
              setEditing(false)
            }
          }}
        >
          <TaskDescriptionEditor
            initialHtml={description ?? ''}
            onChange={(html) => { draftRef.current = html }}
          />
        </div>
      ) : (
        <div
          className={`min-h-[24px] rounded-lg border border-transparent px-1 py-1 -mx-1 transition-colors ${editable ? 'cursor-text hover:border-slate-200 hover:bg-slate-50/50' : ''}`}
          onClick={() => { if (editable) { draftRef.current = description ?? ''; setEditing(true) } }}
        >
          {description ? (
            isHtmlContent(description) ? (
              <div className="prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: description }} />
            ) : (
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{description}</p>
            )
          ) : (
            <p className="text-sm text-slate-400 italic">{editable ? 'Add a description…' : 'No description.'}</p>
          )}
        </div>
      )}

      <AttachmentsGrid
        items={attachments.map((att) => ({
          id: att.id, url: att.url, label: att.file_name ?? 'file', mimeType: att.mime_type,
          onDelete: () => onDeleteAttachment(att.id),
        }))}
      />

      <div className="text-xs text-slate-400 mt-3">{formatDateTime(createdAt)}</div>

      {editable && <InlineAttachControls onUploadFile={onUploadFile} uploading={uploading} />}
    </div>
  )
}

function ThreadCommentItem({
  comment,
  taskId,
  currentUserId,
  isAdmin,
  onRefresh,
}: {
  comment: Comment
  taskId: string
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}) {
  async function deleteComment() {
    await fetch(`/api/marketing/tasks/${taskId}/comments/${comment.id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function deleteAttachment(aid: string) {
    await fetch(`/api/marketing/tasks/${taskId}/comments/${comment.id}/attachments/${aid}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <MessageMeta displayName={comment.user.display_name} email={comment.user.email} avatarUrl={comment.user.avatar_url} profileImageUrl={comment.user.profile_image_url} />
        {(comment.user_id === currentUserId || isAdmin) && (
          <ConfirmButton idleLabel="Delete" confirmLabel="Yes, delete?" onConfirm={deleteComment} variant="red" size="sm" />
        )}
      </div>

      {comment.comment && (
        isHtmlContent(comment.comment) ? (
          <div className="prose prose-sm prose-slate max-w-none" dangerouslySetInnerHTML={{ __html: comment.comment }} />
        ) : (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{comment.comment}</p>
        )
      )}

      <AttachmentsGrid
        items={comment.attachments.map((att) => ({
          id: att.id, url: att.url, label: att.label, mimeType: att.mime_type, isDriveLink: att.is_drive_link,
          onDelete: (att.uploaded_by === currentUserId || isAdmin) ? () => deleteAttachment(att.id) : undefined,
        }))}
      />

      <div className="text-xs text-slate-400 mt-3">{formatDateTime(comment.created_at)}</div>
    </div>
  )
}

// Rich-text reply composer: replying to an in-thread message gets a small
// tiptap editor (bold/italic/underline/link), an inline-image button that
// uploads then embeds the image in the message body, and a file-attach
// button whose files upload as separate attachment cards once the reply is
// posted — mirroring how the top-level "New Message" composer attaches files.
function GroupReplyComposer({
  taskId,
  parentCommentId,
  onRefresh,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  currentUserProfileImageUrl,
  assignedTo,
  participants,
}: {
  taskId: string
  parentCommentId: string
  onRefresh: () => void | Promise<void>
  currentUserId: string
  currentUserName: string
  currentUserAvatarUrl?: string | null
  currentUserProfileImageUrl?: string | null
  assignedTo: string | null
  participants: ParticipantRef[]
}) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [reassignTo, setReassignTo] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)

  // Only the current holder of the task can hand it off, and only to someone
  // else already in this conversation.
  const reassignTargets = participants.filter((p) => p.id !== currentUserId)
  const canReassign = assignedTo === currentUserId && reassignTargets.length > 0

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: false }),
      Underline,
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'text-purple-600 underline' } }),
      TiptapImage,
      Placeholder.configure({ placeholder: 'Add Reply' }),
    ],
    content: '',
    editorProps: { attributes: { class: 'text-sm min-h-[40px] focus:outline-none' } },
  })

  async function insertImage(file: File) {
    setUploadingImage(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/marketing/upload', { method: 'POST', body: fd })
      if (!res.ok) { alert('Image upload failed'); return }
      const uploaded = await res.json()
      editor?.chain().focus().setImage({ src: uploaded.url, alt: uploaded.file_name }).run()
    } finally {
      setUploadingImage(false)
    }
  }

  async function submit(reassignToId?: string) {
    const html = editor?.getHTML() ?? ''
    const isEmpty = !editor || editor.isEmpty
    if (isEmpty && pendingFiles.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: isEmpty ? '' : html, parent_comment_id: parentCommentId, reassign_to: reassignToId || undefined }),
      })
      if (!res.ok) return
      const created = await res.json()
      if (pendingFiles.length > 0) {
        await Promise.all(pendingFiles.map(async (file) => {
          const fd = new FormData()
          fd.append('file', file)
          const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: fd })
          if (!uploadRes.ok) return
          const uploaded = await uploadRes.json()
          await fetch(`/api/marketing/tasks/${taskId}/comments/${created.id}/attachments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: uploaded.url, label: uploaded.file_name, file_name: uploaded.file_name,
              file_size: uploaded.file_size, mime_type: uploaded.mime_type, is_drive_link: false,
            }),
          })
        }))
      }
      editor?.commands.clearContent()
      setPendingFiles([])
      setReassignTo('')
      await onRefresh()
    } finally {
      setSubmitting(false)
    }
  }

  if (!editor) return null

  return (
    <div className="flex items-start gap-2">
      <EmployeeAvatar displayName={currentUserName} avatarUrl={currentUserAvatarUrl} profileImageUrl={currentUserProfileImageUrl} size="sm" />
      <div className="flex-1 border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-purple-400 overflow-hidden">
        <EditorContent editor={editor} className="px-3 py-2 prose prose-sm prose-slate max-w-none [&_.ProseMirror]:outline-none" />

        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-3 pb-2">
            {pendingFiles.map((file, i) => (
              <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                {file.name}
                <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 leading-none">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 px-2 py-1.5 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}
            title="Bold"
            className={`px-1.5 py-0.5 rounded text-xs font-bold transition-colors ${editor.isActive('bold') ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            B
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}
            title="Italic"
            className={`px-1.5 py-0.5 rounded text-xs italic transition-colors ${editor.isActive('italic') ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            I
          </button>
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run() }}
            title="Underline"
            className={`px-1.5 py-0.5 rounded text-xs underline transition-colors ${editor.isActive('underline') ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            U
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) insertImage(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            title="Insert image"
            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-purple-700 disabled:opacity-50 transition-colors"
          >
            <ImageGlyph className="w-3.5 h-3.5" />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              setPendingFiles((prev) => [...prev, ...files])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="p-1 rounded text-slate-500 hover:bg-slate-100 hover:text-purple-700 transition-colors"
          >
            <PaperclipGlyph className="w-3.5 h-3.5" />
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            {canReassign && reassignTargets.length === 1 && (
              <button
                type="button"
                onClick={() => submit(reassignTargets[0].id)}
                disabled={submitting || (editor.isEmpty && pendingFiles.length === 0)}
                title={`Send and reassign to ${reassignTargets[0].display_name}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                <ReassignGlyph />
                Reply & Reassign to {reassignTargets[0].display_name}
              </button>
            )}
            {canReassign && reassignTargets.length > 1 && (
              <select
                value={reassignTo}
                onChange={(e) => setReassignTo(e.target.value)}
                className="text-xs border border-amber-300 bg-amber-50 text-amber-800 rounded-lg px-1.5 py-1 focus:outline-none"
              >
                <option value="">Reassign to…</option>
                {reassignTargets.map((p) => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            )}
            {canReassign && reassignTargets.length > 1 && reassignTo && (
              <button
                type="button"
                onClick={() => submit(reassignTo)}
                disabled={submitting || (editor.isEmpty && pendingFiles.length === 0)}
                title={`Send and reassign to ${reassignTargets.find((p) => p.id === reassignTo)?.display_name ?? ''}`}
                className="inline-flex items-center gap-1.5 px-3 py-1 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
              >
                <ReassignGlyph />
                Reply & Reassign
              </button>
            )}
            <button
              type="button"
              onClick={() => submit()}
              disabled={submitting || (editor.isEmpty && pendingFiles.length === 0)}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              <SendGlyph className="h-3 w-3" />
              {submitting ? 'Sending…' : 'Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// A top-level message plus its replies, indented directly beneath it — every
// message (not just the newest overall) gets its own always-visible reply
// row, so a user can jump into any point in the conversation, not just append
// to the end.
function CommentGroup({
  comment,
  replies,
  taskId,
  currentUserId,
  isAdmin,
  onRefresh,
  currentUserName,
  currentUserAvatarUrl,
  currentUserProfileImageUrl,
  assignedTo,
  participants,
}: {
  comment: Comment
  replies: Comment[]
  taskId: string
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
  currentUserName: string
  currentUserAvatarUrl?: string | null
  currentUserProfileImageUrl?: string | null
  assignedTo: string | null
  participants: ParticipantRef[]
}) {
  return (
    <div>
      <ThreadCommentItem comment={comment} taskId={taskId} currentUserId={currentUserId} isAdmin={isAdmin} onRefresh={onRefresh} />
      {replies.length > 0 && (
        <div className="ml-10 mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
          {replies.map((r) => (
            <ThreadCommentItem key={r.id} comment={r} taskId={taskId} currentUserId={currentUserId} isAdmin={isAdmin} onRefresh={onRefresh} />
          ))}
        </div>
      )}
      <div className="ml-10 mt-3 pl-4">
        <GroupReplyComposer
          taskId={taskId}
          parentCommentId={comment.id}
          onRefresh={onRefresh}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          currentUserAvatarUrl={currentUserAvatarUrl}
          currentUserProfileImageUrl={currentUserProfileImageUrl}
          assignedTo={assignedTo}
          participants={participants}
        />
      </div>
    </div>
  )
}

type ThreadEntry =
  | { kind: 'description'; at: string }
  | { kind: 'comment'; at: string; comment: Comment }
  | { kind: 'history'; at: string; entry: HistoryEntry }

export function TaskThread({
  taskId,
  createdAt,
  createdByName,
  createdByEmail,
  createdByAvatarUrl,
  createdByProfileImageUrl,
  description,
  descriptionAttachments,
  comments,
  history,
  currentUserId,
  currentUserName,
  currentUserAvatarUrl,
  currentUserProfileImageUrl,
  isAdmin,
  assignedTo,
  createdBy,
  canEditDescription,
  uploadingDescriptionFile,
  onRefresh,
  onSaveDescription,
  onUploadDescriptionFile,
  onDeleteDescriptionAttachment,
}: {
  taskId: string
  createdAt: string
  createdByName: string
  createdByEmail?: string | null
  createdByAvatarUrl?: string | null
  createdByProfileImageUrl?: string | null
  description: string | null
  descriptionAttachments: TaskAttachment[]
  comments: Comment[]
  history: HistoryEntry[]
  currentUserId: string
  currentUserName: string
  currentUserAvatarUrl?: string | null
  currentUserProfileImageUrl?: string | null
  isAdmin: boolean
  assignedTo: string | null
  createdBy: string | null
  canEditDescription: boolean
  uploadingDescriptionFile: boolean
  onRefresh: () => void | Promise<void>
  onSaveDescription: (html: string) => void
  onUploadDescriptionFile: (file: File) => void
  onDeleteDescriptionAttachment: (attachmentId: string) => void
}) {
  const [text, setText] = useState('')
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canReassignToCreator = !!createdBy && assignedTo === currentUserId && createdBy !== currentUserId
  const assignerName = createdByName || 'the person who assigned it'

  // Everyone who has posted in this thread, plus whoever opened it — the
  // reassignment target list for in-thread replies.
  const participantsById = new Map<string, ParticipantRef>()
  if (createdBy) {
    participantsById.set(createdBy, {
      id: createdBy, display_name: createdByName,
      avatar_url: createdByAvatarUrl, profile_image_url: createdByProfileImageUrl,
    })
  }
  for (const c of comments) {
    if (!participantsById.has(c.user_id)) {
      participantsById.set(c.user_id, {
        id: c.user_id, display_name: c.user.display_name,
        avatar_url: c.user.avatar_url, profile_image_url: c.user.profile_image_url,
      })
    }
  }
  const participants = [...participantsById.values()]

  // Replies can target any message, but the thread only renders one level of
  // nesting — a reply to a reply is grouped under its top-level ancestor so
  // the layout stays a flat, readable indent rather than a deep tree.
  const commentById = new Map(comments.map((c) => [c.id, c]))
  function topAncestorId(c: Comment): string {
    let cur = c
    const seen = new Set<string>()
    while (cur.parent_comment_id && !seen.has(cur.id)) {
      seen.add(cur.id)
      const parent = commentById.get(cur.parent_comment_id)
      if (!parent) break
      cur = parent
    }
    return cur.id
  }
  const topLevelComments = comments.filter((c) => !c.parent_comment_id)
  const repliesByAnchor = new Map<string, Comment[]>()
  for (const c of comments) {
    if (!c.parent_comment_id) continue
    const anchor = topAncestorId(c)
    if (!repliesByAnchor.has(anchor)) repliesByAnchor.set(anchor, [])
    repliesByAnchor.get(anchor)!.push(c)
  }
  for (const list of repliesByAnchor.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  }

  const descriptionEntry: ThreadEntry = { kind: 'description', at: createdAt }
  const entries: ThreadEntry[] = [
    descriptionEntry,
    ...topLevelComments.map((c): ThreadEntry => ({ kind: 'comment', at: c.created_at, comment: c })),
    ...history.map((h): ThreadEntry => ({ kind: 'history', at: h.changed_at, entry: h })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())

  async function submitReply(reassignToCreator = false) {
    if (!text.trim() && pendingFiles.length === 0) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/marketing/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text.trim(), reassign_to: reassignToCreator ? createdBy : undefined }),
      })
      if (!res.ok) return
      const created = await res.json()
      if (pendingFiles.length > 0) {
        await Promise.all(pendingFiles.map(async (file) => {
          const fd = new FormData()
          fd.append('file', file)
          const uploadRes = await fetch('/api/marketing/upload', { method: 'POST', body: fd })
          if (!uploadRes.ok) return
          const uploaded = await uploadRes.json()
          await fetch(`/api/marketing/tasks/${taskId}/comments/${created.id}/attachments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: uploaded.url, label: uploaded.file_name, file_name: uploaded.file_name,
              file_size: uploaded.file_size, mime_type: uploaded.mime_type, is_drive_link: false,
            }),
          })
        }))
      }
      setText('')
      setPendingFiles([])
      await onRefresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {entries.map((e) => {
        if (e.kind === 'description') {
          return (
            <ThreadDescriptionItem
              key="description"
              authorName={createdByName}
              authorEmail={createdByEmail}
              authorAvatarUrl={createdByAvatarUrl}
              authorProfileImageUrl={createdByProfileImageUrl}
              createdAt={createdAt}
              description={description}
              attachments={descriptionAttachments}
              editable={canEditDescription}
              onSave={onSaveDescription}
              onUploadFile={onUploadDescriptionFile}
              onDeleteAttachment={onDeleteDescriptionAttachment}
              uploading={uploadingDescriptionFile}
            />
          )
        }
        if (e.kind === 'comment') {
          return (
            <CommentGroup
              key={e.comment.id}
              comment={e.comment}
              replies={repliesByAnchor.get(e.comment.id) ?? []}
              taskId={taskId}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onRefresh={onRefresh}
              currentUserName={currentUserName}
              currentUserAvatarUrl={currentUserAvatarUrl}
              currentUserProfileImageUrl={currentUserProfileImageUrl}
              assignedTo={assignedTo}
              participants={participants}
            />
          )
        }
        return <ThreadHistoryItem key={e.entry.id} entry={e.entry} />
      })}

      {/* New top-level message composer */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="text-sm font-semibold text-slate-700 mb-3">New Message</div>
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none mb-2"
        />

        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {pendingFiles.map((file, i) => (
              <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full">
                {file.name}
                <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500 leading-none">×</button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => submitReply(false)}
            disabled={submitting || (!text.trim() && pendingFiles.length === 0)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
          >
            <SendGlyph className="h-3.5 w-3.5" />
            {submitting ? 'Sending…' : 'Send'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              setPendingFiles((prev) => [...prev, ...files])
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-purple-700 transition-colors"
          >
            <PaperclipGlyph className="h-3.5 w-3.5" />
            Attach files
          </button>

          {canReassignToCreator && (
            <button
              type="button"
              onClick={() => submitReply(true)}
              disabled={submitting || (!text.trim() && pendingFiles.length === 0)}
              title={`Send and reassign to ${assignerName}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors ml-auto"
            >
              <ReassignGlyph />
              Send & Reassign to {assignerName}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
