'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type Notice = { kind: 'success' | 'error'; text: string }

// A confirmation that appears next to the thing that changed. Success fades on
// its own after a few seconds; an error stays until the next action replaces it,
// so the person has time to read it and act.
export function useNotice(successMs = 3000) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const show = useCallback((next: Notice | null) => {
    clearTimeout(timer.current)
    setNotice(next)
    if (next?.kind === 'success') timer.current = setTimeout(() => setNotice(null), successMs)
  }, [successMs])
  return [notice, show] as const
}

export function InlineNotice({ notice }: { notice: Notice | null }) {
  // The live region stays mounted so screen readers announce what appears in it.
  return (
    <span role="status" aria-live="polite" className="text-xs font-medium">
      {notice && (
        <span className={`inline-flex items-center gap-1 ${notice.kind === 'error' ? 'text-red-700' : 'text-green-700'}`}>
          <svg className="h-3 w-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
            {notice.kind === 'error' ? <path d="M12 8v5m0 3h.01M12 3a9 9 0 100 18 9 9 0 000-18z" /> : <path d="M5 13l4 4L19 7" />}
          </svg>
          {notice.text}
        </span>
      )}
    </span>
  )
}
