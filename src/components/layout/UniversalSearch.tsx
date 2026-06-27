'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SearchResult, SearchResultType } from '@/lib/search/sources'

const TYPE_LABEL: Record<SearchResultType, string> = {
  customer: 'Customer',
  contact: 'Contact',
  vendor: 'Supplier',
  document: 'Document',
}

function TypeIcon({ type }: { type: SearchResultType }) {
  const common = { width: 16, height: 16, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24', strokeWidth: 2 } as const
  switch (type) {
    case 'contact':
      return (
        <svg {...common}><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
      )
    case 'customer':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 9h0M9 13h0M9 17h0M15 9h0M15 13h0M15 17h0" /></svg>
      )
    case 'vendor':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M1 3h13v10H1zM14 6h4l3 3v4h-7zM5.5 16.5a2 2 0 100 4 2 2 0 000-4zM17.5 16.5a2 2 0 100 4 2 2 0 000-4z" /></svg>
      )
    case 'document':
      return (
        <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h8" /></svg>
      )
  }
}

export default function UniversalSearch() {
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  // Debounced, abortable fetch
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        const data = await res.json()
        setResults(Array.isArray(data.results) ? data.results : [])
        setHighlight(0)
        setOpen(true)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setResults([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => { clearTimeout(t); controller.abort() }
  }, [query])

  // Outside-click close
  useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  function goUrl(url: string) {
    router.push(url)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  function go(r: SearchResult) {
    goUrl(r.url)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); return }
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); const r = results[highlight]; if (r) go(r) }
  }

  const showPanel = open && query.trim().length >= 2

  return (
    <div ref={ref} style={{ flex: 1, position: 'relative' }}>
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none' }}
        >
          <circle cx="11" cy="11" r="8" strokeWidth={2} />
          <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={e => { e.currentTarget.style.borderColor = '#9333ea'; e.currentTarget.style.background = '#fff'; if (results.length) setOpen(true) }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.background = '#f9f9f9' }}
          onKeyDown={onKeyDown}
          placeholder="Search the site…"
          style={{
            width: '100%',
            padding: '7px 12px 7px 32px',
            border: '1px solid #e5e7eb',
            borderRadius: 7,
            fontSize: 13,
            color: '#333',
            background: '#f9f9f9',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, background 0.15s',
          }}
        />
      </div>

      {showPanel && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 100,
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
            overflow: 'hidden',
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {loading ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>Searching…</div>
          ) : results.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#94a3b8' }}>No results for &ldquo;{query.trim()}&rdquo;</div>
          ) : (
            results.map((r, i) => {
              const hasContactMeta = r.type === 'contact' && (r.contactTitle || (r.organizations?.length ?? 0) > 0)
              return (
                <div
                  key={`${r.type}-${r.id}`}
                  onMouseDown={() => go(r)}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    borderTop: i === 0 ? 'none' : '1px solid #f1f5f9',
                    background: i === highlight ? '#faf5ff' : '#fff',
                  }}
                >
                  <span style={{ color: '#9333ea', flexShrink: 0, display: 'flex' }}><TypeIcon type={r.type} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                    {hasContactMeta ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, minWidth: 0, flexWrap: 'wrap' }}>
                        {r.contactTitle && (
                          <span style={{ maxWidth: 160, padding: '2px 6px', borderRadius: 999, background: '#f1f5f9', color: '#475569', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.contactTitle}
                          </span>
                        )}
                        {r.organizations?.map(organization => (
                          <button
                            key={organization.url}
                            type="button"
                            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); goUrl(organization.url) }}
                            style={{ maxWidth: 180, padding: '2px 7px', borderRadius: 999, border: '1px solid #e9d5ff', background: '#faf5ff', color: '#7e22ce', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer' }}
                            title={`Open ${organization.name}`}
                          >
                            {organization.name}
                          </button>
                        ))}
                      </span>
                    ) : r.subtitle && (
                      <span style={{ display: 'block', fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.subtitle}</span>
                    )}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 600, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: 0.3 }}>{TYPE_LABEL[r.type]}</span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
