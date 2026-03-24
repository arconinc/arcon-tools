'use client'

import { useState, KeyboardEvent } from 'react'

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  disabled?: boolean
}

export default function TagInput({ tags, onChange, placeholder = 'Add tag…', disabled = false }: TagInputProps) {
  const [input, setInput] = useState('')

  function addTag(raw: string) {
    const value = raw.trim()
    if (!value || tags.includes(value)) return
    onChange([...tags, value])
    setInput('')
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag))
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(input)
    } else if (e.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className={`flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[42px] bg-white transition-colors ${disabled ? 'bg-slate-50 border-slate-200' : 'border-slate-200 focus-within:border-purple-400'}`}>
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-purple-500 hover:text-purple-700 leading-none"
              aria-label={`Remove ${tag}`}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => { if (input.trim()) addTag(input) }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none text-sm bg-transparent text-slate-700 placeholder-slate-400"
        />
      )}
    </div>
  )
}
