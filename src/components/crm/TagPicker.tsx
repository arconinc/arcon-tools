'use client'

import { useState, useEffect, useRef } from 'react'

export type CrmTagOption = {
  id: string
  name: string
  color: string
}

interface TagPickerProps {
  value: string[]         // selected tag IDs
  onChange: (tagIds: string[]) => void
  allTags?: CrmTagOption[] // if provided, won't fetch
  disabled?: boolean
  placeholder?: string
}

// Palette for auto-assigning colors to new tags (cycles if exhausted)
const TAG_COLORS = [
  '#8b5cf6', '#3b82f6', '#22c55e', '#ef4444',
  '#f97316', '#06b6d4', '#ec4899', '#eab308',
  '#14b8a6', '#64748b',
]

let _colorIdx = 0
function nextColor() {
  const c = TAG_COLORS[_colorIdx % TAG_COLORS.length]
  _colorIdx++
  return c
}

export default function TagPicker({ value, onChange, allTags: propTags, disabled, placeholder }: TagPickerProps) {
  const [allTags, setAllTags] = useState<CrmTagOption[]>(propTags ?? [])
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (propTags) { setAllTags(propTags); return }
    fetch('/api/crm/tags').then((r) => r.json()).then((data) => {
      if (Array.isArray(data)) setAllTags(data)
    })
  }, [propTags])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setInput('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedTags = allTags.filter((t) => value.includes(t.id))
  const filtered = allTags.filter(
    (t) => !value.includes(t.id) && t.name.toLowerCase().includes(input.toLowerCase())
  )
  const exactMatch = allTags.find((t) => t.name.toLowerCase() === input.trim().toLowerCase())

  async function createTag() {
    if (!input.trim() || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: input.trim(), color: nextColor() }),
      })
      const tag = await res.json()
      if (!res.ok) { alert(tag.error ?? 'Failed to create tag'); return }
      setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
      onChange([...value, tag.id])
      setInput('')
    } finally {
      setCreating(false)
    }
  }

  function toggleTag(tagId: string) {
    if (value.includes(tagId)) {
      onChange(value.filter((id) => id !== tagId))
    } else {
      onChange([...value, tagId])
    }
  }

  function removeTag(tagId: string, e: React.MouseEvent) {
    e.stopPropagation()
    onChange(value.filter((id) => id !== tagId))
  }

  const showDropdown = open && !disabled && (filtered.length > 0 || (input.trim() && !exactMatch))

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`min-h-[38px] w-full px-2 py-1.5 border rounded-lg bg-white flex flex-wrap gap-1.5 ${
          disabled ? 'border-slate-100 bg-slate-50 cursor-default' : 'border-slate-200 cursor-text focus-within:ring-2 focus-within:ring-purple-400 focus-within:border-purple-400'
        }`}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus() } }}
      >
        {selectedTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-white leading-none"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => removeTag(tag.id, e)}
                className="opacity-75 hover:opacity-100 ml-0.5 text-sm leading-none"
                aria-label={`Remove ${tag.name}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); if (input.trim() && !exactMatch) createTag() }
              if (e.key === 'Escape') { setOpen(false); setInput('') }
            }}
            placeholder={selectedTags.length === 0 ? (placeholder ?? 'Add tags…') : ''}
            className="flex-1 min-w-[80px] text-sm outline-none bg-transparent placeholder-slate-400"
          />
        )}
        {disabled && selectedTags.length === 0 && (
          <span className="text-sm text-slate-400">{placeholder ?? '—'}</span>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => { toggleTag(tag.id); setInput('') }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 text-left"
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
              <span className="text-sm text-slate-700">{tag.name}</span>
            </button>
          ))}
          {input.trim() && !exactMatch && (
            <button
              type="button"
              onClick={createTag}
              disabled={creating}
              className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-purple-50 text-left border-t border-slate-100 disabled:opacity-60"
            >
              <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm text-purple-700 font-medium">
                {creating ? 'Creating…' : `Create "${input.trim()}"`}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
