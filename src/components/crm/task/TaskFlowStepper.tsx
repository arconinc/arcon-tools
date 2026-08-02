import type { CrmTaskStatus } from '@/types'
import { getTaskNextActions } from '@/lib/task-workflow'

function firstLastInitial(name?: string | null): string {
  if (!name) return 'Unassigned'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export const FLOW_STEP_IDX: Record<CrmTaskStatus, number> = {
  not_started: 0,
  in_progress: 1,
  need_changes: 1,
  waiting_on_approval: 2,
  completed: 3,
  waiting_on_client_approval: 2,
}

export const FLOW_STEP_COUNT = 4

// "N of 4" for the Task Information sidebar — 1-indexed to read naturally.
export function flowStepLabel(status: CrmTaskStatus): string {
  return `${(FLOW_STEP_IDX[status] ?? 0) + 1} of ${FLOW_STEP_COUNT}`
}

const STEP_IDX = FLOW_STEP_IDX

// Per-step accent used for: the active box's border/bg, and the ring color on
// an upcoming step's circle (so "Waiting on Approval" reads amber and
// "Completed" reads green even before they're reached — matches reference).
const STEP_ACCENT: Record<number, { box: string; dot: string; ring: string; upcomingRing: string }> = {
  0: { box: 'border-slate-300 bg-slate-50', dot: 'bg-slate-500', ring: 'ring-4 ring-slate-100', upcomingRing: 'border-slate-300' },
  1: { box: 'border-blue-300 bg-blue-50', dot: 'bg-blue-600', ring: 'ring-4 ring-blue-100', upcomingRing: 'border-blue-300' },
  2: { box: 'border-amber-300 bg-amber-50', dot: 'bg-amber-500', ring: 'ring-4 ring-amber-100', upcomingRing: 'border-amber-300' },
  3: { box: 'border-green-300 bg-green-50', dot: 'bg-green-600', ring: 'ring-4 ring-green-100', upcomingRing: 'border-green-300' },
}

function ArrowSeparator() {
  return (
    <svg className="h-4 w-4 text-slate-300 flex-shrink-0 mt-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  )
}

function StepCircle({ state, stepIdx }: { state: 'done' | 'active' | 'upcoming'; stepIdx: number }) {
  const accent = STEP_ACCENT[stepIdx]
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
      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${accent.dot} ${accent.ring}`}>
        <div className="w-1.5 h-1.5 rounded-full bg-white" />
      </div>
    )
  }
  return <div className={`w-5 h-5 rounded-full bg-white border-2 ${accent.upcomingRing} flex-shrink-0`} />
}

function Step({
  stepIdx,
  isActive,
  clickable,
  onClick,
  label,
  subLabel,
  circle,
  badge,
}: {
  stepIdx: number
  isActive: boolean
  clickable: boolean
  onClick?: () => void
  label: string
  subLabel: string
  circle: React.ReactNode
  badge?: string
}) {
  const accent = STEP_ACCENT[stepIdx]
  const boxCls = isActive
    ? `${accent.box} shadow-sm`
    : clickable
    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
    : 'border-slate-200 bg-white'

  const inner = (
    <>
      {circle}
      <div className="text-[10.5px] font-semibold text-slate-900 mt-1.5 text-center whitespace-nowrap">{label}</div>
      <div className="text-[9px] font-medium text-slate-400 mt-0.5 text-center whitespace-nowrap">{subLabel}</div>
      {badge && (
        <div className="mt-1 text-[9.5px] font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
          {badge}
        </div>
      )}
    </>
  )

  const sharedCls = `flex flex-col items-center flex-1 min-w-[110px] rounded-xl border px-2 py-2.5 transition-colors ${boxCls}`

  if (clickable) {
    return (
      <button type="button" onClick={onClick} className={`${sharedCls} cursor-pointer`}>
        {inner}
      </button>
    )
  }
  return <div className={sharedCls}>{inner}</div>
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

// "Flow of Work" stepper: Not Started → In Progress → Waiting on Approval →
// Completed, rendered as bordered boxes (current step gets its accent color,
// others stay neutral) joined by chevrons. Needs Changes overlays the In
// Progress box (same index) with a "sent back" badge, since it's a revision
// loop on that stage rather than a distinct forward step. Any step that
// represents a legal next status (per src/lib/task-workflow.ts) is clickable
// and fires that transition — there's never more than one legal action per
// step slot, since no two transitions from a given status land on the same index.
export function TaskFlowStepper({ status, ownerName, requestorName, onAction, disabled = false, describeNext }: TaskFlowStepperProps) {
  const idx = STEP_IDX[status] ?? 0
  const isNeedChanges = status === 'need_changes'
  const isCompleted = status === 'completed'
  const owner = firstLastInitial(ownerName)
  const requestor = firstLastInitial(requestorName)
  const completedOwner = describeNext?.('completed') ?? requestorName ?? undefined
  const completedTo = firstLastInitial(completedOwner)

  const nextActions = onAction ? getTaskNextActions(status) : []
  const actionForStep = (stepIdx: number) => nextActions.find((a) => STEP_IDX[a.toStatus] === stepIdx)

  return (
    <div className="px-8 py-3 bg-slate-50 border-b border-slate-100">
      <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Flow of Work</div>
      <div className="flex items-start gap-2">
        <Step
          stepIdx={0}
          isActive={idx === 0}
          clickable={!!actionForStep(0) && !disabled}
          onClick={() => onAction?.(actionForStep(0)!.toStatus)}
          label="Not Started"
          subLabel={`→ ${owner}`}
          circle={<StepCircle state={idx === 0 ? 'active' : idx > 0 ? 'done' : 'upcoming'} stepIdx={0} />}
        />

        <ArrowSeparator />

        <Step
          stepIdx={1}
          isActive={idx === 1}
          clickable={!!actionForStep(1) && !disabled}
          onClick={() => onAction?.(actionForStep(1)!.toStatus)}
          label="In Progress"
          subLabel="→ assign to me"
          circle={<StepCircle state={idx === 1 ? 'active' : idx > 1 ? 'done' : 'upcoming'} stepIdx={1} />}
          badge={isNeedChanges ? '↩ sent back' : undefined}
        />

        <ArrowSeparator />

        <Step
          stepIdx={2}
          isActive={idx === 2}
          clickable={!!actionForStep(2) && !disabled}
          onClick={() => onAction?.(actionForStep(2)!.toStatus)}
          label="Waiting on Approval"
          subLabel={`→ ${requestor}`}
          circle={<StepCircle state={idx === 2 ? 'active' : idx > 2 ? 'done' : 'upcoming'} stepIdx={2} />}
        />

        <ArrowSeparator />

        <Step
          stepIdx={3}
          isActive={idx === 3}
          clickable={!!actionForStep(3) && !disabled}
          onClick={() => onAction?.(actionForStep(3)!.toStatus)}
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
              <StepCircle state="upcoming" stepIdx={3} />
            )
          }
        />
      </div>
    </div>
  )
}
