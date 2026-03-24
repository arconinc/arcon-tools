'use client'

import { useState, useRef } from 'react'

type CreatedTask = {
  id: string
  title: string
  category: string | null
  priority: string
  status: string
  due_date: string | null
  progress: number
}

interface QuickAddTaskProps {
  onTaskCreated: (task: CreatedTask) => void
}

export default function QuickAddTask({ onTaskCreated }: QuickAddTaskProps) {
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    const title = value.trim()
    if (!title || adding) return
    setAdding(true)
    try {
      const res = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category: 'To Do General' }),
      })
      if (!res.ok) throw new Error('Failed')
      const created = await res.json()
      onTaskCreated(created)
      setValue('')
    } catch {
      // no-op
    } finally {
      setAdding(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ position: 'relative' }}>
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
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task… (press Enter)"
        disabled={adding}
        style={{
          width: '100%', boxSizing: 'border-box',
          paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
          border: '1.5px solid #e5e7eb', borderRadius: 9,
          fontSize: 14, color: '#111', background: '#fff',
          outline: 'none',
          opacity: adding ? 0.6 : 1,
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#9333ea' }}
        onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb' }}
      />
    </div>
  )
}
