'use client'

import { useEffect, useState } from 'react'

interface HrLink {
  id: string
  title: string
  description: string | null
  url: string
  sort_order: number
}

export default function EmployeeLinksPage() {
  const [links, setLinks] = useState<HrLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/hr/links')
      .then(r => r.json())
      .then(d => { setLinks(d.links ?? []); setLoading(false) })
      .catch(() => { setError('Failed to load links'); setLoading(false) })
  }, [])

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem', color: '#1a1a2e' }}>
        Employee Links
      </h1>
      <p style={{ color: '#6b7280', marginBottom: '2rem', fontSize: '0.95rem' }}>
        Quick access to payroll, benefits, and other employee resources.
      </p>

      {loading && <p style={{ color: '#6b7280' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && links.length === 0 && (
        <p style={{ color: '#6b7280' }}>No links have been added yet.</p>
      )}

      <div style={{ display: 'grid', gap: '1rem' }}>
        {links.map(link => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'block',
              padding: '1.25rem 1.5rem',
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.75rem',
              textDecoration: 'none',
              transition: 'box-shadow 0.15s, border-color 0.15s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = '#7c3aed'
              el.style.boxShadow = '0 4px 12px rgba(124,58,237,0.12)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = '#e5e7eb'
              el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem', color: '#111827', marginBottom: link.description ? '0.25rem' : 0 }}>
                  {link.title}
                </div>
                {link.description && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{link.description}</div>
                )}
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
