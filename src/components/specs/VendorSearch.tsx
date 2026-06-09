'use client'

import { useState, useEffect } from 'react'

export type VendorOption = { id: string; name: string }

interface VendorSearchProps {
  value: VendorOption | null
  onChange: (v: VendorOption | null) => void
  /** Extra CSS class for the root element */
  className?: string
  /** Input placeholder text */
  placeholder?: string
}

/**
 * Search-and-select for crm_vendors filtered to specialty=Promo.
 * Shows a searchable dropdown when no vendor is selected, and a
 * dismissible pill when one is chosen.
 */
export function VendorSearch({
  value,
  onChange,
  className,
  placeholder = 'Search Promo vendors…',
}: VendorSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<VendorOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/marketing/vendors?search=${encodeURIComponent(query)}&product_line=Promo&limit=20`
      )
      const data = await res.json()
      setResults(Array.isArray(data.vendors) ? data.vendors : [])
      setLoading(false)
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  if (value) {
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#f3f0ff',
          border: '1px solid #7c3aed',
          borderRadius: 8,
          padding: '7px 12px',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#1e293b', flex: 1 }}>
          {value.name}
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#7c3aed',
            cursor: 'pointer',
            padding: 0,
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className={className} style={{ position: 'relative' }}>
      <input
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: 14,
          color: '#1e293b',
          width: '100%',
          outline: 'none',
          background: 'white',
          boxSizing: 'border-box',
        }}
        placeholder={placeholder}
        value={query}
        onChange={e => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && (loading || results.length > 0 || query.trim()) && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,.08)',
            zIndex: 50,
            maxHeight: 220,
            overflowY: 'auto',
            marginTop: 4,
          }}
        >
          {loading ? (
            <div style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '10px 14px', fontSize: 13, color: '#94a3b8' }}>
              No Promo vendors found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            results.map(v => (
              <div
                key={v.id}
                onMouseDown={() => {
                  onChange(v)
                  setQuery('')
                  setOpen(false)
                }}
                style={{
                  padding: '10px 14px',
                  cursor: 'pointer',
                  fontSize: 14,
                  color: '#1e293b',
                  borderBottom: '1px solid #f1f5f9',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}
              >
                {v.name}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
