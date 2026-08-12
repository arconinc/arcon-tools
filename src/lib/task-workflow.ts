import type { CrmTaskStatus } from '@/types'

// Single source of truth for the task-status reassignment logic and the
// UI labels/emphasis for the "next action" buttons. Shared by the PATCH route
// and every task UI surface (detail page, modal, kanban/table row actions) so
// there is exactly one place that knows the rules. Status moves themselves are
// unrestricted — a task can go from any stage to any stage.

export interface TaskAssignmentFields {
  assigned_to: string | null
  created_by: string
  last_worked_by: string | null
}

// Computes the assigned_to/last_worked_by changes a status transition triggers.
// Returns only the keys that should change — spread onto the update payload.
export function computeTransitionPatch(
  task: TaskAssignmentFields,
  _fromStatus: CrmTaskStatus,
  toStatus: CrmTaskStatus,
  actorId: string
): { assigned_to?: string | null; last_worked_by?: string | null } {
  const patch: { assigned_to?: string | null; last_worked_by?: string | null } = {}

  if (toStatus === 'in_progress') {
    // Picking up the task — the actor becomes the current owner.
    patch.assigned_to = actorId
  } else if (toStatus === 'waiting_on_approval') {
    // Whoever was working it is recorded as last_worked_by so a later
    // "Needs Changes" knows who to send it back to; ownership shifts to the requestor.
    patch.last_worked_by = task.assigned_to ?? actorId
    patch.assigned_to = task.created_by
  } else if (toStatus === 'need_changes') {
    // Send it back to whoever last worked it.
    patch.assigned_to = task.last_worked_by ?? task.assigned_to ?? actorId
  } else if (toStatus === 'completed') {
    // Completing always hands the task back to whoever created/assigned it, so
    // they can verify the work before it's truly done — regardless of which
    // status it's completed from.
    patch.assigned_to = task.created_by
  }

  return patch
}

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
    { toStatus: 'need_changes', label: 'Request Changes', emphasis: 'primary' },
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
