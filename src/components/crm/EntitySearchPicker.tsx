'use client'

import { useState, useEffect, useRef } from 'react'

type Result = { id: string; name: string }

type EntitySearchPickerProps = {
  label: string
  apiPath: string
  resultsKey: string
  value: string | null
  displayName: string | null
  onSelect: (id: string | null, name: string | null) => void
  required?: boolean
  placeholder?: string
  disabled?: boolean
}

export default function EntitySearchPicker({
  label,
  apiPath,
  resultsKey,
  value,
  displayName,
  onSelect,
  required,
  placeholder = 'Search…',
  disabled,
}: EntitySearchPickerProps) {
  const [inputText, setInputText] = useState(displayName ?? '')
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const skipSearch = useRef(false)

  // Sync inputText when an external value/displayName is set (e.g. edit mode pre-population)
  useEffect(() => {
    if (value && displayName) {
      skipSearch.current = true
      setInputText(displayName)
    } else if (!value) {
      skipSearch.current = true
      setInputText('')
    }
  }, [value, displayName])

  // Debounced search
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return }
    if (value) return // already selected; don't search
    const q = inputText.trim()
    if (!q) { setResults([]); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`${apiPath}?search=${encodeURIComponent(q)}&limit=20`)
        const data = await res.json()
        setResults(Array.isArray(data[resultsKey]) ? data[resultsKey] : [])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [inputText]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleClear() {
    skipSearch.current = true
    setInputText('')
    setResults([])
    setOpen(false)
    onSelect(null, null)
  }

  const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white pr-16"

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-0.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input
          type="text"
          value={inputText}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          onChange={(e) => {
            setInputText(e.target.value)
            if (value) onSelect(null, null) // clear selection when user starts retyping
          }}
          onFocus={() => { if (results.length > 0 && !value) setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={inputCls + (disabled ? ' opacity-50 cursor-not-allowed' : '')}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {loading && <span className="text-xs text-slate-400 whitespace-nowrap">Searching…</span>}
          {value && !disabled && (
            <button
              type="button"
              onMouseDown={handleClear}
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {open && results.length > 0 && (
          <ul className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto text-sm">
            {results.map((r) => (
              <li
                key={r.id}
                onMouseDown={() => {
                  skipSearch.current = true
                  setInputText(r.name)
                  setOpen(false)
                  setResults([])
                  onSelect(r.id, r.name)
                }}
                className="px-3 py-2 cursor-pointer hover:bg-purple-50 hover:text-purple-800"
              >
                {r.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
