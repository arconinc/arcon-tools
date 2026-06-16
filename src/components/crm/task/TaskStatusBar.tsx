'use client'

import type { TaskStatus } from '@/hooks/useTask'

export const STATUSES: { value: TaskStatus; label: string; cls: string }[] = [
  { value: 'not_started', label: 'Not Started', cls: 'bg-slate-100 text-slate-600' },
  { value: 'in_progress', label: 'In Progress', cls: 'bg-blue-100 text-blue-700' },
  { value: 'completed', label: 'Completed', cls: 'bg-green-100 text-green-700' },
  { value: 'waiting_on_approval', label: 'Waiting on Approval', cls: 'bg-yellow-100 text-yellow-700' },
  { value: 'waiting_on_client_approval', label: 'Waiting on Client Approval', cls: 'bg-orange-100 text-orange-700' },
  { value: 'need_changes', label: 'Need Changes', cls: 'bg-red-100 text-red-600' },
]

const STATUS_ORDER_VALUES = [
  'not_started', 'in_progress', 'waiting_on_approval',
  'waiting_on_client_approval', 'need_changes', 'completed',
] as const

const STATUS_COLORS: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress: '#60a5fa',
  waiting_on_approval: '#fbbf24',
  waiting_on_client_approval: '#fb923c',
  need_changes: '#f87171',
  completed: '#4ade80',
}

export function TaskStatusBar({
  currentStatus,
  onStatusClick,
  disabled,
}: {
  currentStatus: string
  onStatusClick: (status: string) => void
  disabled: boolean
}) {
  const currentIdx = STATUS_ORDER_VALUES.indexOf(currentStatus as typeof STATUS_ORDER_VALUES[number])
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', height: 36 }}>
      {STATUS_ORDER_VALUES.map((s, idx) => {
        const isActive = s === currentStatus
        const isPast = currentIdx > idx
        const isFirst = idx === 0
        const isLast = idx === STATUS_ORDER_VALUES.length - 1
        const statusLabel = STATUSES.find((st) => st.value === s)?.label ?? s
        const isClickable = !disabled && !isActive
        const bg = isActive ? STATUS_COLORS[s] : isPast ? '#ede9fe' : '#f8fafc'
        const textColor = isActive ? '#fff' : isPast ? '#6d28d9' : '#94a3b8'
        const triangleColor = isActive ? STATUS_COLORS[s] : isPast ? '#ddd6fe' : '#e2e8f0'
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'stretch', flex: 1, minWidth: 0 }}>
            <button
              type="button"
              onClick={() => isClickable && onStatusClick(s)}
              disabled={!isClickable}
              title={statusLabel}
              style={{
                flex: 1,
                minWidth: 0,
                background: bg,
                color: textColor,
                border: 'none',
                cursor: isClickable ? 'pointer' : 'default',
                fontSize: 11,
                fontWeight: isActive ? 700 : 600,
                padding: '0 6px',
                transition: 'filter 0.12s',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textAlign: 'center',
                borderRadius: isFirst ? '8px 0 0 8px' : isLast ? '0 8px 8px 0' : 0,
              }}
              onMouseEnter={(e) => { if (isClickable) (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(0.88)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.filter = '' }}
            >
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {statusLabel}
              </span>
            </button>
            {!isLast && (
              <div style={{
                width: 0, height: 0, flexShrink: 0,
                borderTop: '18px solid transparent',
                borderBottom: '18px solid transparent',
                borderLeft: `10px solid ${triangleColor}`,
                zIndex: 2,
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
