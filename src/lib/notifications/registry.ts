import { renderGenericEmail } from './template'

export interface NotificationDefinition<TPayload> {
  type: string
  label: string
  description: string
  defaultEmail: boolean
  render: (payload: TPayload) => { title: string; body: string; linkUrl: string }
  email: (
    payload: TPayload,
    recipient: { display_name: string; email: string }
  ) => { subject: string; html: string }
}

// ─── task_assigned ────────────────────────────────────────────────────────────

export interface TaskAssignedPayload {
  task_id: string
  task_title: string
  actor_id: string
  actor_name: string
  department: string | null
  due_date: string | null
  priority: string | null
  status: string | null
  description: string | null
  fanout_kind: 'user' | 'department'
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://thearc.arconinc.com'
}

function fmtDueDate(d: string | null): string | null {
  if (!d) return null
  // Display the raw date portion if it looks like an ISO timestamp.
  const m = d.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : d
}

export const taskAssigned: NotificationDefinition<TaskAssignedPayload> = {
  type: 'task_assigned',
  label: 'Task assigned to me',
  description: 'When someone assigns you a task, or a task is posted to your department.',
  defaultEmail: false,
  render: (p) => ({
    title:
      p.fanout_kind === 'department'
        ? `New ${p.department} task: ${p.task_title}`
        : `${p.actor_name} assigned you: ${p.task_title}`,
    body: fmtDueDate(p.due_date) ? `Due ${fmtDueDate(p.due_date)}` : 'No due date',
    linkUrl: `/marketing/tasks/${p.task_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    const due = fmtDueDate(p.due_date)
    const lines: string[] = []
    if (p.fanout_kind === 'department') {
      lines.push(`A new task was posted to <strong>${p.department}</strong>.`)
    } else {
      lines.push(`<strong>${p.actor_name}</strong> assigned you a new task.`)
    }
    lines.push(`<strong style="font-size:16px;color:#1e293b">${p.task_title}</strong>`)
    if (p.description) {
      const trimmed = p.description.length > 400 ? p.description.slice(0, 400) + '…' : p.description
      lines.push(trimmed)
    }
    const meta: string[] = []
    if (due) meta.push(`<strong>Due:</strong> ${due}`)
    if (p.priority) meta.push(`<strong>Priority:</strong> ${p.priority}`)
    if (p.status) meta.push(`<strong>Status:</strong> ${p.status}`)
    if (p.department && p.fanout_kind !== 'department') meta.push(`<strong>Department:</strong> ${p.department}`)
    if (meta.length > 0) lines.push(meta.join(' &nbsp;·&nbsp; '))

    return {
      subject:
        p.fanout_kind === 'department'
          ? `[${p.department}] New task: ${p.task_title}`
          : `${p.actor_name} assigned you a task: ${p.task_title}`,
      html: renderGenericEmail({
        preheader: p.task_title,
        heading: p.fanout_kind === 'department' ? 'New department task' : 'New task assigned to you',
        greeting: `Hi ${firstName},`,
        bodyLines: lines,
        ctaText: 'View task',
        ctaUrl: `${appUrl()}/marketing/tasks/${p.task_id}`,
      }),
    }
  },
}

// ─── access_request.new ───────────────────────────────────────────────────────

export interface AccessRequestNewPayload {
  request_id: string
  requester_name: string
  role_label: string
  resource_key: string | null
  message: string | null
}

export const accessRequestNew: NotificationDefinition<AccessRequestNewPayload> = {
  type: 'access_request.new',
  label: 'New access request (admin)',
  description: 'When an employee submits an access request.',
  defaultEmail: true,
  render: (p) => ({
    title: `${p.requester_name} requested ${p.role_label} access`,
    body: p.message ? `"${p.message}"` : 'No message provided.',
    linkUrl: `/admin/access-requests`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Access request: ${p.requester_name} → ${p.role_label}`,
      html: renderGenericEmail({
        preheader: `${p.requester_name} is requesting ${p.role_label} access`,
        heading: 'New Access Request',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `<strong>${p.requester_name}</strong> has requested <strong>${p.role_label}</strong> access.`,
          ...(p.message ? [`Their note: <em>${p.message}</em>`] : []),
        ],
        ctaText: 'Review Request',
        ctaUrl: `${appUrl()}/admin/access-requests`,
      }),
    }
  },
}

// ─── access_request.approved ─────────────────────────────────────────────────

export interface AccessRequestApprovedPayload {
  request_id: string
  role_label: string
  reviewer_name: string
  review_note: string | null
}

export const accessRequestApproved: NotificationDefinition<AccessRequestApprovedPayload> = {
  type: 'access_request.approved',
  label: 'My access request was approved',
  description: 'When an administrator approves your access request.',
  defaultEmail: true,
  render: (p) => ({
    title: `Your ${p.role_label} access request was approved`,
    body: p.review_note ?? `Approved by ${p.reviewer_name}.`,
    linkUrl: `/dashboard`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Access approved: ${p.role_label}`,
      html: renderGenericEmail({
        preheader: `Your request for ${p.role_label} access has been approved`,
        heading: 'Access Request Approved',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `Your request for <strong>${p.role_label}</strong> access has been approved by <strong>${p.reviewer_name}</strong>.`,
          ...(p.review_note ? [`Note: <em>${p.review_note}</em>`] : []),
          `You now have access. Refresh the app to see the updated navigation.`,
        ],
        ctaText: 'Go to Dashboard',
        ctaUrl: `${appUrl()}/dashboard`,
      }),
    }
  },
}

// ─── access_request.denied ───────────────────────────────────────────────────

export interface AccessRequestDeniedPayload {
  request_id: string
  role_label: string
  reviewer_name: string
  review_note: string | null
}

export const accessRequestDenied: NotificationDefinition<AccessRequestDeniedPayload> = {
  type: 'access_request.denied',
  label: 'My access request was denied',
  description: 'When an administrator denies your access request.',
  defaultEmail: true,
  render: (p) => ({
    title: `Your ${p.role_label} access request was not approved`,
    body: p.review_note ?? `Reviewed by ${p.reviewer_name}.`,
    linkUrl: `/dashboard`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Access request update: ${p.role_label}`,
      html: renderGenericEmail({
        preheader: `Your request for ${p.role_label} access was not approved`,
        heading: 'Access Request Not Approved',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `Your request for <strong>${p.role_label}</strong> access was reviewed by <strong>${p.reviewer_name}</strong> and was not approved at this time.`,
          ...(p.review_note ? [`Note: <em>${p.review_note}</em>`] : []),
          `If you have questions, please reach out to your administrator directly.`,
        ],
        ctaText: 'Go to Dashboard',
        ctaUrl: `${appUrl()}/dashboard`,
      }),
    }
  },
}

// ─── Registry ─────────────────────────────────────────────────────────────────
//
// To add a new notification type:
//   1. Define a `<Type>Payload` interface above.
//   2. Export a `const myType: NotificationDefinition<MyPayload> = { ... }`.
//   3. Add it to NOTIFICATION_REGISTRY below.
// No DB seed is needed — the registry key IS the source of truth for the `type` column.

export const NOTIFICATION_REGISTRY = {
  task_assigned: taskAssigned,
  'access_request.new': accessRequestNew,
  'access_request.approved': accessRequestApproved,
  'access_request.denied': accessRequestDenied,
} as const

export type NotificationType = keyof typeof NOTIFICATION_REGISTRY

export function getDefinition(type: string): NotificationDefinition<unknown> | null {
  return (NOTIFICATION_REGISTRY as Record<string, NotificationDefinition<unknown>>)[type] ?? null
}
