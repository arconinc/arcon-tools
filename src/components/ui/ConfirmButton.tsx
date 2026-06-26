'use client'

import { useEffect, useRef, useState } from 'react'

export interface ConfirmButtonProps {
  /** Label shown in idle state */
  idleLabel: string
  /** Label shown after first click, prompting confirmation */
  confirmLabel?: string
  /** Called on second (confirming) click */
  onConfirm: () => void
  /** Tailwind/style variant controlling color */
  variant?: 'green' | 'yellow' | 'red' | 'purple'
  /** Size variant. Default 'md' */
  size?: 'sm' | 'md'
  /** Whether the button is disabled */
  disabled?: boolean
  /** Optional extra className applied to the button */
  className?: string
  /** How long (ms) the confirm state stays before auto-resetting. Default 3000 */
  timeout?: number
}

const VARIANT_IDLE: Record<string, string> = {
  green:
    'border border-green-300 bg-green-50 text-green-700 hover:bg-green-100',
  yellow:
    'border border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100',
  red: 'border border-red-300 bg-red-50 text-red-600 hover:bg-red-100',
  purple:
    'border border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100',
}

const VARIANT_CONFIRM: Record<string, string> = {
  green:  'border border-green-400 bg-green-100 text-green-800 hover:bg-green-200',
  yellow: 'border border-yellow-400 bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
  red:    'border border-red-400 bg-red-100 text-red-700 hover:bg-red-200',
  purple: 'border border-purple-500 bg-purple-100 text-purple-800 hover:bg-purple-200',
}

export function ConfirmButton({
  idleLabel,
  confirmLabel,
  onConfirm,
  variant = 'green',
  size = 'md',
  disabled = false,
  className = '',
  timeout = 3000,
}: ConfirmButtonProps) {
  const [pending, setPending] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function reset() {
    setPending(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function handleClick() {
    if (disabled) return
    if (!pending) {
      setPending(true)
      timerRef.current = setTimeout(reset, timeout)
    } else {
      reset()
      onConfirm()
    }
  }

  const resolvedConfirmLabel = confirmLabel ?? `Sure? (${idleLabel})`
  const colorClass = pending
    ? (VARIANT_CONFIRM[variant] ?? VARIANT_CONFIRM.green)
    : (VARIANT_IDLE[variant] ?? VARIANT_IDLE.green)
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-xs font-semibold rounded-lg'
    : 'px-4 py-2 text-sm font-semibold rounded-xl'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={[
        sizeClass,
        'transition-colors disabled:opacity-60',
        colorClass,
        className,
      ].join(' ')}
    >
      {pending ? resolvedConfirmLabel : idleLabel}
    </button>
  )
}
