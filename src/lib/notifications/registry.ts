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
      lines.push(p.description)
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

// ─── expense_report.submitted ────────────────────────────────────────────────

export interface ExpenseReportSubmittedPayload {
  report_id: string
  period_month: string    // e.g. "2026-05"
  submitter_name: string
}

export const expenseReportSubmitted: NotificationDefinition<ExpenseReportSubmittedPayload> = {
  type: 'expense_report.submitted',
  label: 'Expense report submitted (reviewer)',
  description: 'When an employee submits or re-submits an expense report for review.',
  defaultEmail: true,
  render: (p) => ({
    title: `${p.submitter_name} submitted an expense report for ${p.period_month}`,
    body: 'Ready for your review in The Arc.',
    linkUrl: `/admin/expense-reports/${p.report_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Expense report submitted: ${p.submitter_name} — ${p.period_month}`,
      html: renderGenericEmail({
        preheader: `${p.submitter_name} submitted their ${p.period_month} expense report`,
        heading: 'Expense Report Submitted',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `<strong>${p.submitter_name}</strong> has submitted their expense report for <strong>${p.period_month}</strong> and it is ready for your review.`,
          `Review the line items, leave comments on specific rows, and approve or request changes directly in The Arc.`,
        ],
        ctaText: 'Review in The Arc',
        ctaUrl: `${appUrl()}/admin/expense-reports/${p.report_id}`,
      }),
    }
  },
}

// ─── expense_report.needs_changes ────────────────────────────────────────────

export interface ExpenseReportNeedsChangesPayload {
  report_id: string
  period_month: string
  reviewer_name: string
  comment: string | null
}

export const expenseReportNeedsChanges: NotificationDefinition<ExpenseReportNeedsChangesPayload> = {
  type: 'expense_report.needs_changes',
  label: 'My expense report needs changes',
  description: 'When the reviewer flags your expense report as needing corrections.',
  defaultEmail: true,
  render: (p) => ({
    title: `Your ${p.period_month} expense report needs changes`,
    body: p.comment ?? `Reviewed by ${p.reviewer_name}.`,
    linkUrl: `/expense-reports/${p.report_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Your expense report needs changes — ${p.period_month}`,
      html: renderGenericEmail({
        preheader: `${p.reviewer_name} has requested changes to your ${p.period_month} expense report`,
        heading: 'Expense Report Needs Changes',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `<strong>${p.reviewer_name}</strong> has reviewed your expense report for <strong>${p.period_month}</strong> and has requested some changes.`,
          ...(p.comment ? [`Their note: <em>${p.comment}</em>`] : []),
          `Please open the report in The Arc, make the necessary corrections, and re-submit.`,
        ],
        ctaText: 'Open Expense Report',
        ctaUrl: `${appUrl()}/expense-reports/${p.report_id}`,
      }),
    }
  },
}

// ─── expense_report.approved ─────────────────────────────────────────────────

export interface ExpenseReportApprovedPayload {
  report_id: string
  period_month: string
  reviewer_name: string
}

export const expenseReportApproved: NotificationDefinition<ExpenseReportApprovedPayload> = {
  type: 'expense_report.approved',
  label: 'My expense report was approved',
  description: 'When the reviewer approves your expense report.',
  defaultEmail: true,
  render: (p) => ({
    title: `Your ${p.period_month} expense report has been approved`,
    body: `Approved by ${p.reviewer_name}.`,
    linkUrl: `/expense-reports/${p.report_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Expense report approved — ${p.period_month}`,
      html: renderGenericEmail({
        preheader: `Your ${p.period_month} expense report has been approved`,
        heading: 'Expense Report Approved',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `Your expense report for <strong>${p.period_month}</strong> has been approved by <strong>${p.reviewer_name}</strong>.`,
          `No further action is required on your part.`,
        ],
        ctaText: 'View in The Arc',
        ctaUrl: `${appUrl()}/expense-reports/${p.report_id}`,
      }),
    }
  },
}

// ─── expense_report.submitted_to_payroll ─────────────────────────────────────

export interface ExpenseReportSubmittedToPayrollPayload {
  report_id: string
  period_month: string
  reviewer_name: string
}

export const expenseReportSubmittedToPayroll: NotificationDefinition<ExpenseReportSubmittedToPayrollPayload> = {
  type: 'expense_report.submitted_to_payroll',
  label: 'My expense report was submitted to payroll',
  description: 'When the reviewer submits your approved expense report to payroll.',
  defaultEmail: true,
  render: (p) => ({
    title: `Your ${p.period_month} expense report has been submitted to payroll`,
    body: `Submitted by ${p.reviewer_name}.`,
    linkUrl: `/expense-reports/${p.report_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Expense report submitted to payroll — ${p.period_month}`,
      html: renderGenericEmail({
        preheader: `Your ${p.period_month} expense report has been submitted to payroll`,
        heading: 'Submitted to Payroll',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `Your expense report for <strong>${p.period_month}</strong> has been submitted to payroll by <strong>${p.reviewer_name}</strong>.`,
          `You should expect reimbursement on your next eligible pay cycle.`,
        ],
        ctaText: 'View in The Arc',
        ctaUrl: `${appUrl()}/expense-reports/${p.report_id}`,
      }),
    }
  },
}

// ─── expense_report.comment_added ────────────────────────────────────────────

export interface ExpenseReportCommentAddedPayload {
  report_id: string
  period_month: string
  author_name: string
  is_line_item_comment: boolean
  body_excerpt: string
  recipient_is_admin: boolean
}

export const expenseReportCommentAdded: NotificationDefinition<ExpenseReportCommentAddedPayload> = {
  type: 'expense_report.comment_added',
  label: 'Comment added to my expense report',
  description: 'When a comment or reply is added to your expense report.',
  defaultEmail: true,
  render: (p) => ({
    title: `${p.author_name} commented on your ${p.period_month} expense report`,
    body: p.body_excerpt,
    linkUrl: p.recipient_is_admin ? `/admin/expense-reports/${p.report_id}` : `/expense-reports/${p.report_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    const context = p.is_line_item_comment ? 'a specific line item on' : ''
    return {
      subject: `New comment on ${p.period_month} expense report`,
      html: renderGenericEmail({
        preheader: `${p.author_name} left a comment on your expense report`,
        heading: 'New Expense Report Comment',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `<strong>${p.author_name}</strong> left a comment${context ? ` on ${context}` : ' on'} your expense report for <strong>${p.period_month}</strong>.`,
          `<em>&ldquo;${p.body_excerpt}&rdquo;</em>`,
        ],
        ctaText: 'View Comment',
        ctaUrl: p.recipient_is_admin
          ? `${appUrl()}/admin/expense-reports/${p.report_id}`
          : `${appUrl()}/expense-reports/${p.report_id}`,
      }),
    }
  },
}

// ─── task_completed ───────────────────────────────────────────────────────────

export interface TaskCompletedPayload {
  task_id: string
  task_title: string
  actor_id: string
  actor_name: string
  department: string | null
}

export const taskCompleted: NotificationDefinition<TaskCompletedPayload> = {
  type: 'task_completed',
  label: 'My task was completed by someone else',
  description: 'When a task you created is marked complete by another person.',
  defaultEmail: false,
  render: (p) => ({
    title: `${p.actor_name} completed: ${p.task_title}`,
    body: p.department ? `${p.department} task marked complete` : 'Task marked complete',
    linkUrl: `/marketing/tasks/${p.task_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Task completed: ${p.task_title}`,
      html: renderGenericEmail({
        preheader: `${p.actor_name} marked your task complete`,
        heading: 'Task Completed',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `<strong>${p.actor_name}</strong> marked the following task as complete:`,
          `<strong style="font-size:16px;color:#1e293b">${p.task_title}</strong>`,
          ...(p.department ? [`<strong>Department:</strong> ${p.department}`] : []),
        ],
        ctaText: 'View task',
        ctaUrl: `${appUrl()}/marketing/tasks/${p.task_id}`,
      }),
    }
  },
}

// ─── spec.follow_up_due ───────────────────────────────────────────────────────

export interface SpecFollowUpDuePayload {
  spec_id: string
  item_name: string
  customer_name: string
  follow_up_date: string
}

export const specFollowUpDue: NotificationDefinition<SpecFollowUpDuePayload> = {
  type: 'spec.follow_up_due',
  label: 'Spec sample follow-up due',
  description: 'When a spec sample follow-up date arrives.',
  defaultEmail: true,
  render: (p) => ({
    title: `Follow-up due: ${p.customer_name} — ${p.item_name}`,
    body: `Spec follow-up was due ${fmtDueDate(p.follow_up_date) ?? p.follow_up_date}.`,
    linkUrl: `/marketing/specs/${p.spec_id}`,
  }),
  email: (p, recipient) => {
    const firstName = (recipient.display_name ?? '').split(' ')[0] || 'there'
    return {
      subject: `Spec follow-up due: ${p.customer_name} — ${p.item_name}`,
      html: renderGenericEmail({
        preheader: `Follow up on the ${p.item_name} spec sent to ${p.customer_name}`,
        heading: 'Spec Follow-Up Due',
        greeting: `Hi ${firstName},`,
        bodyLines: [
          `A spec sample follow-up is due today for <strong>${p.customer_name}</strong>.`,
          `<strong style="font-size:16px;color:#1e293b">${p.item_name}</strong>`,
          `Reach out to the customer to check if they received the sample and gather their feedback.`,
        ],
        ctaText: 'View Spec',
        ctaUrl: `${appUrl()}/marketing/specs/${p.spec_id}`,
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
  task_completed: taskCompleted,
  'access_request.new': accessRequestNew,
  'access_request.approved': accessRequestApproved,
  'access_request.denied': accessRequestDenied,
  'expense_report.submitted': expenseReportSubmitted,
  'expense_report.needs_changes': expenseReportNeedsChanges,
  'expense_report.approved': expenseReportApproved,
  'expense_report.submitted_to_payroll': expenseReportSubmittedToPayroll,
  'expense_report.comment_added': expenseReportCommentAdded,
  'spec.follow_up_due': specFollowUpDue,
} as const

export type NotificationType = keyof typeof NOTIFICATION_REGISTRY

export function getDefinition(type: string): NotificationDefinition<unknown> | null {
  return (NOTIFICATION_REGISTRY as Record<string, NotificationDefinition<unknown>>)[type] ?? null
}
