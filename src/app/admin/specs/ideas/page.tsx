'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SpecIdea } from '@/types'

export default function AdminSpecIdeasPage() {
  const router = useRouter()
  const [ideas, setIdeas] = useState<SpecIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [vendors, setVendors] = useState<string[]>([])
  const [vendorFilter, setVendorFilter] = useState('')
  const [creating, setCreating] = useState(false)

  const fetchIdeas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '500' })
    if (search) params.set('q', search)
    params.set('active_only', showArchived ? 'false' : '1')
    if (vendorFilter) params.set('vendor', vendorFilter)
    const res = await fetch(`/api/marketing/spec-ideas?${params}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      setIdeas(data)
      const vs = [...new Set(data.map((d: SpecIdea) => d.vendor).filter(Boolean))].sort() as string[]
      setVendors(vs)
    }
    setLoading(false)
  }, [search, showArchived, vendorFilter])

  useEffect(() => { fetchIdeas() }, [fetchIdeas])

  async function handleCreate() {
    setCreating(true)
    const res = await fetch('/api/marketing/spec-ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendor: 'New Vendor', item_name: 'New Item' }),
    })
    const idea = await res.json()
    setCreating(false)
    if (idea?.id) router.push(`/admin/specs/ideas/${idea.id}`)
  }

  const filtered = ideas.filter(i => showArchived ? !i.is_active : i.is_active)

  return (
    <div style={{ padding: '32px 40px' }}>
      <style>{`
        .ai-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; }
        .ai-row:last-child { border-bottom: none; }
        .ai-row:hover { background: #faf9ff; }
        .tag-pill { display: inline-flex; align-items: center; background: #f3f0ff; color: #7c3aed; border-radius: 10px; padding: 2px 8px; font-size: 11px; font-weight: 600; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: '0 0 4px' }}>Spec Ideas</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Manage the product catalog for spec sample creation.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: creating ? .6 : 1 }}
        >
          {creating ? 'Creating…' : '+ New Idea'}
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <svg style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search ideas…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px 8px 30px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' }}
          />
        </div>
        <select
          value={vendorFilter}
          onChange={e => setVendorFilter(e.target.value)}
          style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', background: 'white' }}
        >
          <option value="">All Suppliers</option>
          {vendors.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} style={{ accentColor: '#7c3aed' }} />
          Show Archived
        </label>
      </div>

      {loading ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '48px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#94a3b8', marginBottom: 12 }}>
            {ideas.length === 0 ? 'No spec ideas yet.' : 'No ideas match your filters.'}
          </div>
          {ideas.length === 0 && (
            <button onClick={handleCreate} style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Create the first idea
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 160px 100px 120px 80px 60px', gap: 0, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['', 'Item', 'Supplier', 'Category', 'Price Range', 'Tags', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</div>
            ))}
          </div>
          {filtered.map(idea => (
            <div
              key={idea.id}
              className="ai-row"
              style={{ display: 'grid', gridTemplateColumns: '48px 1fr 160px 100px 120px 80px 60px' }}
              onClick={() => router.push(`/admin/specs/ideas/${idea.id}`)}
            >
              {/* Thumbnail */}
              <div>
                {idea.image_url ? (
                  <img src={idea.image_url} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 6, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                )}
              </div>
              {/* Item info */}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{idea.item_name}</div>
                {idea.item_number && <div style={{ fontSize: 11, color: '#94a3b8' }}>#{idea.item_number}</div>}
                {!idea.is_active && <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, padding: '1px 5px', marginTop: 2, display: 'inline-block' }}>Archived</span>}
              </div>
              <div style={{ fontSize: 13, color: '#7c3aed', fontWeight: 600 }}>{idea.vendor}</div>
              <div style={{ fontSize: 13, color: '#374151' }}>{idea.category ?? '—'}</div>
              <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{idea.price_range ?? '—'}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {idea.tags.slice(0, 2).map(t => (
                  <span key={t} className="tag-pill">{t}</span>
                ))}
                {idea.tags.length > 2 && <span style={{ fontSize: 11, color: '#94a3b8' }}>+{idea.tags.length - 2}</span>}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                <Link
                  href={`/admin/specs/ideas/${idea.id}`}
                  onClick={e => e.stopPropagation()}
                  style={{ padding: '4px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#374151', textDecoration: 'none', fontWeight: 600, background: 'white' }}
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
