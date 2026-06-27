'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SpecIdea } from '@/types'

function IdeaCard({ idea, onSelect }: { idea: SpecIdea; onSelect: (idea: SpecIdea) => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow .15s', boxShadow: hovered ? '0 4px 20px rgba(0,0,0,.1)' : 'none', display: 'flex', flexDirection: 'column' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(idea)}
    >
      <div style={{ position: 'relative', background: '#f8fafc', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {idea.image_url ? (
          <img src={idea.image_url} alt={idea.item_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path strokeLinecap="round" d="M21 15l-5-5L5 21"/></svg>
        )}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(124,58,237,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button style={{ background: 'white', color: '#7c3aed', border: 'none', borderRadius: 8, padding: '8px 18px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              Create Spec from This
            </button>
          </div>
        )}
      </div>
      <div style={{ padding: '14px 16px', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b', lineHeight: 1.3 }}>{idea.item_name}</div>
          <span style={{ background: '#f3f0ff', color: '#7c3aed', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>{idea.vendor}</span>
        </div>
        {idea.item_number && <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>Item #{idea.item_number}</div>}
        {idea.price_range && <div style={{ fontSize: 13, color: '#374151', fontWeight: 600 }}>{idea.price_range}</div>}
        {idea.category && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{idea.category}</div>}
        {idea.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
            {idea.tags.slice(0, 3).map(tag => (
              <span key={tag} style={{ background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '2px 6px', fontSize: 11, fontWeight: 500 }}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function IdeaDrawer({ idea, onClose, onCreateSpec }: { idea: SpecIdea; onClose: () => void; onCreateSpec: (idea: SpecIdea) => void }) {
  const allImages = [idea.image_url, ...idea.image_urls].filter(Boolean) as string[]
  const [activeImg, setActiveImg] = useState(0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }} onClick={onClose}>
      <div style={{ flex: 1, background: 'rgba(0,0,0,.4)' }} />
      <div
        style={{ width: 480, background: 'white', height: '100%', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,.15)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>{idea.item_name}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        {/* Images */}
        {allImages.length > 0 && (
          <div style={{ padding: '16px 24px' }}>
            <div style={{ background: '#f8fafc', borderRadius: 12, height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }}>
              <img src={allImages[activeImg]} alt={idea.item_name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            {allImages.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {allImages.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    onClick={() => setActiveImg(i)}
                    style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: i === activeImg ? '2px solid #7c3aed' : '2px solid transparent', flexShrink: 0 }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Details */}
        <div style={{ padding: '0 24px 24px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, marginBottom: 16 }}>
            <tbody>
              {[
                ['Item Name', idea.item_name],
                ['Item #', idea.item_number],
                ['Supplier', idea.vendor],
                ['Price Range', idea.price_range],
                ['Category', idea.category],
              ].map(([label, value]) => value ? (
                <tr key={label}>
                  <td style={{ padding: '6px 0', color: '#64748b', fontWeight: 500, width: 120, verticalAlign: 'top' }}>{label}</td>
                  <td style={{ padding: '6px 0', color: '#1e293b' }}>{value}</td>
                </tr>
              ) : null)}
            </tbody>
          </table>

          {idea.vendor_url && (
            <a href={idea.vendor_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12 }}>
              View on vendor site ↗
            </a>
          )}

          {idea.tags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>TAGS</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {idea.tags.map(tag => (
                  <span key={tag} style={{ background: '#f1f5f9', color: '#475569', borderRadius: 4, padding: '3px 8px', fontSize: 12, fontWeight: 500 }}>{tag}</span>
                ))}
              </div>
            </div>
          )}

          {idea.notes && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>NOTES</div>
              <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{idea.notes}</p>
            </div>
          )}

          {idea.ordering_instructions_html && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 8 }}>ORDERING INSTRUCTIONS</div>
              <div
                className="prose prose-sm"
                style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}
                dangerouslySetInnerHTML={{ __html: idea.ordering_instructions_html }}
              />
            </div>
          )}

          <button
            onClick={() => onCreateSpec(idea)}
            style={{ width: '100%', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '13px 0', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}
          >
            Create Spec from This
          </button>
        </div>
      </div>
    </div>
  )
}

const CATEGORIES = ['Drinkware', 'Bags', 'Tech', 'Apparel', 'Office', 'Journals', 'Trade Show', 'Outdoor', 'Other']

export default function SpecIdeasLibrary() {
  const router = useRouter()
  const [ideas, setIdeas] = useState<SpecIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [vendors, setVendors] = useState<string[]>([])
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedIdea, setSelectedIdea] = useState<SpecIdea | null>(null)

  const fetchIdeas = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (selectedVendors.length === 1) params.set('vendor', selectedVendors[0])
    if (selectedCategories.length === 1) params.set('category', selectedCategories[0])
    try {
      const data = await fetch(`/api/marketing/spec-ideas?${params}`).then(r => r.json())
      const list: SpecIdea[] = Array.isArray(data) ? data : []
      setIdeas(list)
      // Extract unique vendors
      const vs = [...new Set(list.map(i => i.vendor).filter(Boolean))] as string[]
      setVendors(vs.sort())
    } finally {
      setLoading(false)
    }
  }, [search, selectedVendors, selectedCategories])

  useEffect(() => {
    const t = setTimeout(() => fetchIdeas(), 250)
    return () => clearTimeout(t)
  }, [fetchIdeas])

  const toggleVendor = (v: string) =>
    setSelectedVendors(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  const toggleCategory = (c: string) =>
    setSelectedCategories(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])

  // Client-side filter for multi-vendor/category when multiple selected
  const filtered = ideas.filter(idea => {
    if (selectedVendors.length > 1 && !selectedVendors.includes(idea.vendor)) return false
    if (selectedCategories.length > 1 && idea.category && !selectedCategories.includes(idea.category)) return false
    return true
  })

  const handleCreateSpec = (idea: SpecIdea) => {
    router.push(`/marketing/specs/new?ideaId=${idea.id}`)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 60px)' }}>
      <style>{`
        .filter-section { margin-bottom: 20px; }
        .filter-title { font-size: 12px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 10px; display: flex; justify-content: space-between; }
        .filter-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #374151; padding: 3px 0; cursor: pointer; }
        .filter-check:hover { color: #7c3aed; }
        .filter-check input { cursor: pointer; accent-color: #7c3aed; }
        .filter-count { color: #94a3b8; font-size: 12px; margin-left: auto; }
        .ideas-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        .empty-ideas { text-align: center; padding: 80px 24px; color: #94a3b8; grid-column: 1/-1; }
      `}</style>

      {/* Sidebar */}
      <div style={{ width: 260, background: 'white', borderRight: '1px solid #e2e8f0', padding: '24px 20px', overflowY: 'auto', flexShrink: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 20 }}>Filters</div>

        {/* Supplier */}
        <div className="filter-section">
          <div className="filter-title">
            <span>Supplier</span>
            {selectedVendors.length > 0 && (
              <button onClick={() => setSelectedVendors([])} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Clear</button>
            )}
          </div>
          {vendors.slice(0, 8).map(v => (
            <label key={v} className="filter-check">
              <input type="checkbox" checked={selectedVendors.includes(v)} onChange={() => toggleVendor(v)} />
              <span style={{ flex: 1 }}>{v}</span>
              <span className="filter-count">{ideas.filter(i => i.vendor === v).length}</span>
            </label>
          ))}
        </div>

        {/* Category */}
        <div className="filter-section">
          <div className="filter-title">
            <span>Category</span>
            {selectedCategories.length > 0 && (
              <button onClick={() => setSelectedCategories([])} style={{ background: 'none', border: 'none', color: '#7c3aed', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Clear</button>
            )}
          </div>
          {CATEGORIES.map(c => (
            <label key={c} className="filter-check">
              <input type="checkbox" checked={selectedCategories.includes(c)} onChange={() => toggleCategory(c)} />
              <span style={{ flex: 1 }}>{c}</span>
              <span className="filter-count">{ideas.filter(i => i.category === c).length}</span>
            </label>
          ))}
        </div>

        {(selectedVendors.length > 0 || selectedCategories.length > 0) && (
          <button
            onClick={() => { setSelectedVendors([]); setSelectedCategories([]) }}
            style={{ width: '100%', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 0', color: '#64748b', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}
          >
            Clear All Filters
          </button>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>Spec Ideas Library</h1>
            <p style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>{loading ? 'Loading…' : `${filtered.length} idea${filtered.length !== 1 ? 's' : ''} found`}</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link
              href="/marketing/specs/new"
              style={{ background: '#7c3aed', color: 'white', padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
            >
              + New Spec
            </Link>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 24 }}>
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></svg>
          <input
            type="text"
            placeholder="Search ideas by name, item #, vendor, category, or tags…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px 10px 38px', fontSize: 14, color: '#1e293b', outline: 'none', boxSizing: 'border-box', background: 'white' }}
          />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: '#94a3b8' }}>Loading ideas…</div>
        ) : (
          <div className="ideas-grid">
            {filtered.length === 0 ? (
              <div className="empty-ideas">
                <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No ideas found</p>
                <p style={{ fontSize: 14 }}>Try adjusting your filters or search query.</p>
              </div>
            ) : (
              filtered.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onSelect={setSelectedIdea} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      {selectedIdea && (
        <IdeaDrawer
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onCreateSpec={(idea) => {
            setSelectedIdea(null)
            handleCreateSpec(idea)
          }}
        />
      )}
    </div>
  )
}
