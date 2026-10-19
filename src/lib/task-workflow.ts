import type { CrmTaskStatus } from '@/types'

// Single source of truth for the UI labels/emphasis for the "next action"
// buttons, shared by every task UI surface (detail page, modal, kanban/table
// row actions). Status moves are unrestricted — a task can go from any stage
// to any stage — and never change who the task is assigned to.

export const TASK_STATUS_LABELS: Record<CrmTaskStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  waiting_on_approval: 'Waiting on Approval',
  need_changes: 'Needs Changes',
  completed: 'Complete',
  waiting_on_client_approval: 'Waiting on Client Approval',
}

// Tailwind's stock palette (100/700 pairs) matches the Arcon design system
// reference exactly — blue-100 #dbeafe, amber-100 #fef3c7, green-100 #dcfce7,
// red-100 #fee2e2, slate-100 #f1f5f9 — so plain Tailwind classes are used
// throughout rather than inline hex.
export const TASK_STATUS_COLORS: Record<CrmTaskStatus, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  waiting_on_approval: 'bg-amber-100 text-amber-700',
  need_changes: 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  waiting_on_client_approval: 'bg-amber-100 text-amber-700',
}

export interface TaskNextAction {
  toStatus: CrmTaskStatus
  label: string
  emphasis: 'primary' | 'secondary'
}

const TASK_NEXT_ACTIONS: Record<CrmTaskStatus, TaskNextAction[]> = {
  not_started: [
    { toStatus: 'in_progress', label: 'Start Task', emphasis: 'primary' },
    { toStatus: 'waiting_on_approval', label: 'Send for Approval', emphasis: 'secondary' },
    { toStatus: 'completed', label: 'Mark Complete', emphasis: 'secondary' },
  ],
  in_progress: [
    { toStatus: 'waiting_on_approval', label: 'Send for Approval', emphasis: 'primary' },
    { toStatus: 'completed', label: 'Mark Complete', emphasis: 'secondary' },
  ],
  waiting_on_approval: [
    { toStatus: 'in_progress', label: 'Send Back', emphasis: 'primary' },
    { toStatus: 'completed', label: 'Approve & Complete', emphasis: 'secondary' },
  ],
  need_changes: [
    { toStatus: 'in_progress', label: 'Resume Work', emphasis: 'primary' },
    { toStatus: 'waiting_on_approval', label: 'Send for Approval', emphasis: 'secondary' },
  ],
  completed: [],
  waiting_on_client_approval: [],
}

export function getTaskNextActions(status: CrmTaskStatus): TaskNextAction[] {
  return TASK_NEXT_ACTIONS[status] ?? []
}
