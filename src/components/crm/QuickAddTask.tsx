'use client'

import { useState, useRef } from 'react'

type CreatedTask = {
  id: string
  title: string
  department: string | null
  category: string | null
  priority: string
  status: string
  due_date: string | null
  progress: number
  sort_order?: number | null
}

interface QuickAddTaskProps {
  defaultDepartment?: string
  onTaskCreated: (task: CreatedTask) => void
}

export default function QuickAddTask({ defaultDepartment, onTaskCreated }: QuickAddTaskProps) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const title = value.trim()
    if (!title || adding) return
    setAdding(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { title }
      if (defaultDepartment) {
        body.department = defaultDepartment
      } else {
        body.department = 'General'
        body.category = 'To Do General'
      }
      const res = await fetch('/api/marketing/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      onTaskCreated(created)
      setValue('')
    } catch {
      setError('Task could not be added. Try again.')
    } finally {
      setAdding(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .quick-add-task-input:focus-visible { outline: 2px solid #a855f7; outline-offset: 0; border-color: #6b1e98 !important; }
        .quick-add-task-input::placeholder { color: #6b7280; }
        @media (prefers-reduced-motion: reduce) {
          .quick-add-task-input { transition: none !important; }
        }
      `}</style>
      <svg
        width="15" height="15" fill="none" stroke="currentColor" viewBox="0 0 24 24"
        style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9333ea', pointerEvents: 'none' }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => { setValue(e.target.value); if (error) setError(null) }}
        onKeyDown={handleKeyDown}
        placeholder="Add a task… (press Enter)"
        disabled={adding}
        aria-invalid={!!error}
        aria-describedby={error ? 'quick-add-task-error' : undefined}
        className="quick-add-task-input"
        style={{
          width: '100%', boxSizing: 'border-box',
          paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
          border: `1.5px solid ${error ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 8,
          fontSize: 14, color: '#111', background: '#fff',
          outline: 'none',
          opacity: adding ? 0.6 : 1,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#9333ea' }}
        onBlur={e => { e.currentTarget.style.borderColor = error ? '#fca5a5' : '#e5e7eb' }}
      />
      {error && (
        <div id="quick-add-task-error" role="alert" style={{ marginTop: 6, color: '#dc2626', fontSize: 12, fontWeight: 500 }}>
          {error}
        </div>
      )}
    </div>
  )
}
