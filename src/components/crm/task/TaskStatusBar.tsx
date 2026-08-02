'use client'

import type { CrmTaskStatus } from '@/types'
import { TASK_STATUS_LABELS, TASK_STATUS_COLORS, getTaskNextActions } from '@/lib/task-workflow'
import { SendGlyph, CheckCircleGlyph } from '@/components/crm/task/TaskIcons'

interface TaskStatusBarProps {
  currentStatus: CrmTaskStatus
  onAction: (toStatus: CrmTaskStatus) => void
  disabled?: boolean
  // Optional "→ who it goes to" preview shown under each action button.
  describeNext?: (toStatus: CrmTaskStatus) => string | null
}

// Soft-fill button color keyed by the action's TARGET status — Start Task is
// blue (entering In Progress), Send for Approval is amber, Mark Complete is
// green, Request Changes is red — matching the Arcon design system reference.
const ACTION_BUTTON_CLASS: Record<CrmTaskStatus, string> = {
  not_started: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
  in_progress: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  waiting_on_approval: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
  need_changes: 'bg-red-100 text-red-700 hover:bg-red-200',
  completed: 'bg-green-100 text-green-700 hover:bg-green-200',
  waiting_on_client_approval: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
}

// Icon per target status — Send for Approval gets the paper-plane, Mark
// Complete / Approve & Complete get the check-circle. Other transitions
// (Start Task, Request Changes, Resume Work) render without an icon.
const ACTION_ICON: Partial<Record<CrmTaskStatus, React.ReactNode>> = {
  waiting_on_approval: <SendGlyph className="h-3.5 w-3.5" />,
  completed: <CheckCircleGlyph className="h-3.5 w-3.5" />,
}

// Guided workflow control: shows the current status as a read-only badge, then
// only the actions that are legal from that status (see src/lib/task-workflow.ts) —
// not a free-form dropdown.
export function TaskStatusBar({ currentStatus, onAction, disabled = false, describeNext }: TaskStatusBarProps) {
  const actions = getTaskNextActions(currentStatus)

  return (
    <div className="flex flex-col gap-3">
      <span
        className={`inline-flex items-center self-start px-3 py-1 rounded-full text-xs font-semibold ${TASK_STATUS_COLORS[currentStatus]}`}
      >
        {TASK_STATUS_LABELS[currentStatus]}
      </span>

      {actions.length > 0 && (
        <div className="flex flex-col gap-2">
          {actions.map((action) => (
            <button
              key={action.toStatus}
              type="button"
              disabled={disabled}
              onClick={() => onAction(action.toStatus)}
              className={`w-full px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${ACTION_BUTTON_CLASS[action.toStatus]}`}
            >
              <div className="flex items-center gap-1.5">
                {ACTION_ICON[action.toStatus]}
                {action.label}
              </div>
              {describeNext?.(action.toStatus) && (
                <div className="text-[11px] font-normal mt-0.5 opacity-70">
                  → {describeNext(action.toStatus)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
