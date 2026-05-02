'use client'

import { useEffect } from 'react'

export function TaskCreatedToast({
  show,
  onClose,
  message = 'Task created successfully.',
}: {
  show: boolean
  onClose: () => void
  message?: string
}) {
  useEffect(() => {
    if (!show) return
    const timeout = window.setTimeout(onClose, 3500)
    return () => window.clearTimeout(timeout)
  }, [show, onClose])

  if (!show) return null

  return (
    <div className="fixed bottom-5 right-5 z-[60] max-w-sm rounded-xl border border-green-200 bg-white px-4 py-3 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m5 13 4 4L19 7" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900">{message}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
