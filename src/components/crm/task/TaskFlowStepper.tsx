import type { CrmTaskStatus } from '@/types'
import { getTaskNextActions } from '@/lib/task-workflow'

function firstLastInitial(name?: string | null): string {
  if (!name) return 'Unassigned'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

const STEP_IDX: Record<CrmTaskStatus, number> = {
  not_started: 0,
  in_progress: 1,
  need_changes: 1,
  waiting_on_approval: 2,
  completed: 3,
  waiting_on_client_approval: 2,
}

// Soft-fill button treatment for a clickable step, keyed by that step's own
// color (not the target-status color used on the footer action buttons) —
// this is a passive "you can click this" affordance, not a colored CTA.
const STEP_BUTTON_CLS: Record<number, string> = {
  0: 'bg-slate-100 border-slate-200 hover:bg-slate-200 hover:border-slate-300',
  1: 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300',
  2: 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300',
  3: 'bg-green-50 border-green-200 hover:bg-green-100 hover:border-green-300',
}

function StepCircle({ state, dotCls, ringCls }: { state: 'done' | 'active' | 'upcoming'; dotCls: string; ringCls: string }) {
  if (state === 'done') {
    return (
      <div className="w-5 h-5 rounded-full bg-purple-700 flex items-center justify-center flex-shrink-0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    )
  }
  if (state === 'active') {
    return (
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${dotCls} ${ringCls}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
      </div>
    )
  }
  return <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex-shrink-0" />
}

interface TaskFlowStepperProps {
  status: CrmTaskStatus
  ownerName?: string | null
  requestorName?: string | null
  // Fires with the target status when a clickable step is pressed.
  onAction?: (toStatus: CrmTaskStatus) => void
  disabled?: boolean
  // Same "who it goes to" preview used by the footer action buttons — needed
  // so the Completed step's subLabel matches them (completing from
  // "Not Started"/"In Progress" assigns the actor, not always the requestor).
  describeNext?: (toStatus: CrmTaskStatus) => string | null
}

// "Flow of Work" horizontal stepper: Not Started → In Progress → Waiting on
// Approval → Completed. Needs Changes overlays the In Progress step (same
// index) with a "sent back" badge, since it's a revision loop on that stage
// rather than a distinct forward step. Any step that represents a legal next
// status (per src/lib/task-workflow.ts) renders as a soft-fill button and
// fires that transition on click — there's never more than one legal action
// per step slot, since no two transitions from a given status land on the
// same index.
export function TaskFlowStepper({ status, ownerName, requestorName, onAction, disabled = false, describeNext }: TaskFlowStepperProps) {
  const idx = STEP_IDX[status] ?? 0
  const isNeedChanges = status === 'need_changes'
  const isCompleted = status === 'completed'
  const owner = firstLastInitial(ownerName)
  const requestor = firstLastInitial(requestorName)
  const completedOwner = describeNext?.('completed') ?? requestorName ?? undefined
  const completedTo = firstLastInitial(completedOwner)

  const lineCls = (afterIdx: number) => (idx > afterIdx ? 'bg-purple-700' : 'bg-slate-300')

  const nextActions = onAction ? getTaskNextActions(status) : []
  const actionForStep = (stepIdx: number) => nextActions.find((a) => STEP_IDX[a.toStatus] === stepIdx)

  function Step({
    stepIdx,
    width,
    label,
    subLabel,
    circle,
    badge,
  }: {
    stepIdx: number
    width: string
    label: string
    subLabel: string
    circle: React.ReactNode
    badge?: string
  }) {
    const action = actionForStep(stepIdx)
    const clickable = !!action && !disabled
    const inner = (
      <>
        {circle}
        <div className="text-[10.5px] font-semibold text-slate-900 mt-1.5 text-center whitespace-nowrap">{label}</div>
        <div className="text-[9px] font-medium text-slate-400 mt-0.5 text-center whitespace-nowrap">{subLabel}</div>
        {badge && (
          <div className="absolute top-[26px] mt-4 text-[9.5px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
            {badge}
          </div>
        )}
      </>
    )
    if (clickable) {
      return (
        <button
          type="button"
          onClick={() => onAction!(action!.toStatus)}
          title={`${action!.label} — click to apply`}
          className={`flex flex-col items-center ${width} flex-shrink-0 relative rounded-lg py-1.5 -my-1.5 border transition-colors cursor-pointer ${STEP_BUTTON_CLS[stepIdx]}`}
        >
          {inner}
        </button>
      )
    }
    return (
      <div className={`flex flex-col items-center ${width} flex-shrink-0 relative py-1.5 -my-1.5`}>
        {inner}
      </div>
    )
  }

  return (
    <div className="px-8 py-3 bg-slate-50 border-b border-slate-100">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Flow of Work</div>
      <div className="flex items-start">
        <Step
          stepIdx={0}
          width="w-[136px]"
          label="Not Started"
          subLabel={`→ ${owner}`}
          circle={<StepCircle state={idx === 0 ? 'active' : idx > 0 ? 'done' : 'upcoming'} dotCls="bg-slate-500" ringCls="ring-4 ring-slate-100" />}
        />

        <div className={`flex-1 h-0.5 mt-2.5 ${lineCls(0)}`} />

        <Step
          stepIdx={1}
          width="w-[136px]"
          label="In Progress"
          subLabel="→ assign to me"
          circle={<StepCircle state={idx === 1 ? 'active' : idx > 1 ? 'done' : 'upcoming'} dotCls="bg-blue-600" ringCls="ring-4 ring-blue-100" />}
          badge={isNeedChanges ? '↩ sent back' : undefined}
        />

        <div className={`flex-1 h-0.5 mt-2.5 ${lineCls(1)}`} />

        <Step
          stepIdx={2}
          width="w-[136px]"
          label="Waiting on Approval"
          subLabel={`→ ${requestor}`}
          circle={<StepCircle state={idx === 2 ? 'active' : idx > 2 ? 'done' : 'upcoming'} dotCls="bg-amber-500" ringCls="ring-4 ring-amber-100" />}
        />

        <div className={`flex-1 h-0.5 mt-2.5 ${lineCls(2)}`} />

        <Step
          stepIdx={3}
          width="w-[136px]"
          label="Completed"
          subLabel={`→ ${completedTo}`}
          circle={
            isCompleted ? (
              <div className="w-5 h-5 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-white border-2 border-slate-300 flex-shrink-0" />
            )
          }
        />
      </div>
    </div>
  )
}
