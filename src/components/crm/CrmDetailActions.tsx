'use client'

import { useEffect, useRef, useState } from 'react'

interface CrmDetailActionsProps {
  onCreateTask: () => void
  extraAction?: { label: string; href: string }
}

export function CrmDetailActions({ onCreateTask, extraAction }: CrmDetailActionsProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-300 text-slate-700 text-sm font-semibold rounded-lg hover:bg-slate-50 transition-colors"
      >
        Actions
        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onCreateTask()
            }}
            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-700"
          >
            Create Task
          </button>
          {extraAction && (
            <a
              href={extraAction.href}
              onClick={() => setTimeout(() => setOpen(false), 0)}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-purple-50 hover:text-purple-700"
            >
              {extraAction.label}
            </a>
          )}
        </div>
      )}
    </div>
  )
}
