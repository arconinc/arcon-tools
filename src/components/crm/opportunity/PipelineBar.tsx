'use client'

import { opportunityStatusBadge } from '@/lib/badges'

type OppStatus = 'open' | 'won' | 'lost' | 'stalled'
type PipelineStage = 'Send Quote' | 'Follow Up on Quote' | 'Quote Accepted' | 'Send Thank You Email'

export const STAGES: PipelineStage[] = [
  'Send Quote',
  'Follow Up on Quote',
  'Quote Accepted',
  'Send Thank You Email',
]

export function PipelineBar({
  currentStage,
  status,
  onStageClick,
  onClose,
  disabled,
}: {
  currentStage: PipelineStage | null
  status: OppStatus
  onStageClick: (stage: PipelineStage) => void
  onClose: (result: 'won' | 'lost') => void
  disabled: boolean
}) {
  const isClosed = status === 'won' || status === 'lost'
  const currentIdx = currentStage ? STAGES.indexOf(currentStage) : -1

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm font-semibold text-slate-700">Pipeline Stage</span>
        {isClosed && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${opportunityStatusBadge(status)}`}>
            {status === 'won' ? '🏆 Won' : '❌ Lost'}
          </span>
        )}
      </div>

      {/* Stage steps */}
      <div className="flex items-center gap-0 mb-4">
        {STAGES.map((stage, idx) => {
          const isActive = stage === currentStage
          const isPast = currentIdx > idx
          const isClickable = !disabled && !isClosed

          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              <button
                onClick={() => isClickable && onStageClick(stage)}
                disabled={!isClickable}
                title={stage}
                className={[
                  'flex-1 px-2 py-2 text-xs font-medium text-center transition-colors rounded-none first:rounded-l-xl last:rounded-r-xl border',
                  isActive
                    ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                    : isPast
                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200',
                  isClickable && !isActive ? 'hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 cursor-pointer' : '',
                  disabled ? 'cursor-default' : '',
                ].join(' ')}
              >
                <span className="block truncate">{stage}</span>
              </button>
              {idx < STAGES.length - 1 && (
                <div className={`w-0 h-0 border-t-[16px] border-b-[16px] border-l-[10px] border-t-transparent border-b-transparent z-10 -mx-0.5 flex-shrink-0 ${
                  isPast || isActive ? 'border-l-purple-200' : 'border-l-slate-200'
                }`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Close Won / Close Lost */}
      {!isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => !disabled && onClose('won')}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
          >
            🏆 Close Won
          </button>
          <button
            onClick={() => !disabled && onClose('lost')}
            disabled={disabled}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50 transition-colors"
          >
            ❌ Close Lost
          </button>
        </div>
      )}
      {isClosed && (
        <div className="flex gap-2">
          <button
            onClick={() => !disabled && onClose('won')}
            disabled={disabled}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Re-open as Open
          </button>
        </div>
      )}
    </div>
  )
}
