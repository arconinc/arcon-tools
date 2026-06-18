'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { SpecIdea } from '@/types'
import { VendorSearch, VendorOption } from '@/components/specs/VendorSearch'

const TiptapEditor = dynamic(() => import('@/components/news/TiptapEditor').then(m => ({ default: m.TiptapEditor })), { ssr: false })

// ─── Types / helpers ─────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const trimmed = input.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed])
    setInput('')
  }
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 10px', display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 42, background: 'white' }}>
      {tags.map(t => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f3f0ff', color: '#7c3aed', borderRadius: 10, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
          {t}
          <button type="button" onClick={() => onChange(tags.filter(x => x !== t))} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } }}
        onBlur={add}
        placeholder={tags.length === 0 ? 'Add tags (Enter to add)…' : ''}
        style={{ border: 'none', outline: 'none', fontSize: 13, flex: 1, minWidth: 120, background: 'transparent' }}
      />
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AdminSpecIdeaEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [idea, setIdea] = useState<SpecIdea | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [vendor, setVendor] = useState('')
  const [vendorOption, setVendorOption] = useState<VendorOption | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemNumber, setItemNumber] = useState('')
  const [vendorUrl, setVendorUrl] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState('')
  const [notes, setNotes] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [instructionsJson, setInstructionsJson] = useState<Record<string, unknown> | null>(null)
  const [instructionsHtml, setInstructionsHtml] = useState('')

  // Image state
  const [primaryImage, setPrimaryImage] = useState<string | null>(null)
  const [galleryImages, setGalleryImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [fetchingUrl, setFetchingUrl] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const primaryFileRef = useRef<HTMLInputElement>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/marketing/spec-ideas/${id}`)
      .then(r => r.json())
      .then((d: SpecIdea) => {
        setIdea(d)
        setVendor(d.vendor)
        setVendorOption(d.vendor_id ? { id: d.vendor_id, name: d.vendor } : null)
        setItemName(d.item_name)
        setItemNumber(d.item_number ?? '')
        setVendorUrl(d.vendor_url ?? '')
        setCategory(d.category ?? '')
        setTags(d.tags ?? [])
        setPriceRange(d.price_range ?? '')
        setNotes(d.notes ?? '')
        setIsActive(d.is_active)
        setPrimaryImage(d.image_url ?? null)
        setGalleryImages(d.image_urls ?? [])
        if (d.ordering_instructions_json) setInstructionsJson(d.ordering_instructions_json)
        setLoading(false)
      })
  }, [id])

  const save = useCallback(async (overrides?: Partial<SpecIdea>) => {
    setSaving(true)
    setSaved(false)
    setError(null)
    const body = {
      vendor: vendorOption?.name || vendor || 'Unknown',
      vendor_id: vendorOption?.id ?? null,
      item_name: itemName || 'New Item',
      item_number: itemNumber || null,
      vendor_url: vendorUrl || null,
      category: category || null,
      tags,
      price_range: priceRange || null,
      notes: notes || null,
      is_active: isActive,
      ordering_instructions_json: instructionsJson,
      ordering_instructions_html: instructionsHtml || null,
      ...overrides,
    }
    const res = await fetch(`/api/marketing/spec-ideas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const updated = await res.json()
    if (res.ok) {
      setIdea(prev => prev ? { ...prev, ...updated } : null)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } else {
      setError(updated.error ?? 'Save failed')
    }
    setSaving(false)
  }, [vendor, itemName, itemNumber, vendorUrl, category, tags, priceRange, notes, isActive, instructionsJson, instructionsHtml, id])

  async function uploadImage(file: File, primary: boolean) {
    setUploadingImage(true)
    setImageError(null)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('primary', primary ? '1' : '0')
    const res = await fetch(`/api/marketing/spec-ideas/${id}/upload`, { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingImage(false)
    if (!res.ok) { setImageError(data.error ?? 'Upload failed'); return }
    if (primary) {
      setPrimaryImage(data.image_url)
    } else {
      setGalleryImages(prev => [...prev, data.added_url])
    }
  }

  async function fetchImageFromUrl(url: string, primary: boolean) {
    if (!url.trim()) return
    setFetchLoading(true)
    setImageError(null)
    const res = await fetch(`/api/marketing/spec-ideas/${id}/fetch-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, primary }),
    })
    const data = await res.json()
    setFetchLoading(false)
    if (!res.ok) { setImageError(data.error ?? 'Fetch failed'); return }
    if (primary) setPrimaryImage(data.image_url)
    else setGalleryImages(prev => [...prev, data.added_url])
    setFetchingUrl('')
  }

  async function removeGalleryImage(url: string) {
    const updated = galleryImages.filter(u => u !== url)
    setGalleryImages(updated)
    await fetch(`/api/marketing/spec-ideas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_urls: updated }),
    })
  }

  if (loading) return <div style={{ padding: 48, color: '#94a3b8', fontSize: 14 }}>Loading…</div>
  if (!idea) return <div style={{ padding: 48, color: '#ef4444', fontSize: 14 }}>Idea not found.</div>

  return (
    <div style={{ padding: '28px 40px', maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        .ei-label { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 5px; display: block; }
        .ei-input { border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 14px; width: 100%; box-sizing: border-box; outline: none; }
        .ei-input:focus { border-color: #7c3aed; }
        .image-thumb { position: relative; width: 100px; height: 100px; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; cursor: pointer; flex-shrink: 0; }
        .image-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .image-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,.6); border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Link href="/admin/specs/ideas" style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>← Spec Ideas</Link>
        <span style={{ color: '#e2e8f0' }}>›</span>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b', flex: 1 }}>{itemName || 'Untitled Idea'}</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!isActive && (
            <span style={{ background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>Archived</span>
          )}
          {saved && <span style={{ color: '#16a34a', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
          {error && <span style={{ color: '#dc2626', fontSize: 13 }}>{error}</span>}
          <button
            onClick={() => save()}
            disabled={saving}
            style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Basic info */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 20px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Basic Info</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <label className="ei-label">Item Name *</label>
                <input className="ei-input" value={itemName} onChange={e => setItemName(e.target.value)} placeholder="20oz Stainless Tumbler" />
              </div>
              <div>
                <label className="ei-label">Item Number</label>
                <input className="ei-input" value={itemNumber} onChange={e => setItemNumber(e.target.value)} placeholder="HP-1234" />
              </div>
              <div>
                <label className="ei-label">Vendor *</label>
                <VendorSearch
                  value={vendorOption}
                  onChange={v => {
                    setVendorOption(v)
                    if (v) setVendor(v.name)
                  }}
                />
                {!vendorOption && vendor && (
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Currently: {vendor} — search to link to CRM vendor</div>
                )}
              </div>
              <div>
                <label className="ei-label">Category</label>
                <input className="ei-input" value={category} onChange={e => setCategory(e.target.value)} placeholder="Drinkware, Journals…" list="category-list" />
                <datalist id="category-list">
                  {['Drinkware', 'Apparel', 'Bags', 'Journals / Notebooks', 'Trade Show', 'Tech', 'Outdoor', 'Awards', 'Holiday', 'Branded'].map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="ei-label">Price Range</label>
                <input className="ei-input" value={priceRange} onChange={e => setPriceRange(e.target.value)} placeholder="$4.00 – $8.00" />
              </div>
              <div>
                <label className="ei-label">Vendor URL</label>
                <input className="ei-input" type="url" value={vendorUrl} onChange={e => setVendorUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="ei-label">Tags</label>
              <TagInput tags={tags} onChange={setTags} />
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>Press Enter or comma to add each tag</div>
            </div>
            <div>
              <label className="ei-label">Notes</label>
              <textarea className="ei-input" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Internal notes for CSRs…" style={{ resize: 'vertical' }} />
            </div>
          </div>

          {/* Ordering instructions */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '20px 20px' }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Ordering Instructions</h2>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8' }}>Step-by-step instructions for ordering from this vendor. Visible to CSRs when creating a spec.</p>
            <TiptapEditor
              content={instructionsJson ?? undefined}
              onChange={(json, html) => { setInstructionsJson(json); setInstructionsHtml(html) }}
              placeholder="1. Go to vendor portal at...\n2. Search for item #...\n3. Select these options..."
              minHeight="180px"
            />
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Primary image */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Primary Image</h2>
            {primaryImage ? (
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <img src={primaryImage} alt="" style={{ width: '100%', borderRadius: 8, objectFit: 'cover', maxHeight: 200 }} />
                <button
                  onClick={() => { setPrimaryImage(null); save({ image_url: null }) }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}
                >
                  ×
                </button>
              </div>
            ) : (
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 8, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, color: '#94a3b8', fontSize: 13 }}>
                No image
              </div>
            )}

            {/* Upload button */}
            <input ref={primaryFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file, true)
              e.target.value = ''
            }} />
            <button
              onClick={() => primaryFileRef.current?.click()}
              disabled={uploadingImage}
              style={{ width: '100%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 7, padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}
            >
              {uploadingImage ? 'Uploading…' : '↑ Upload Image'}
            </button>

            {/* URL fetch */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="url"
                placeholder="Paste image URL…"
                value={fetchingUrl}
                onChange={e => setFetchingUrl(e.target.value)}
                style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 7, padding: '6px 8px', fontSize: 12, outline: 'none' }}
              />
              <button
                onClick={() => fetchImageFromUrl(fetchingUrl, true)}
                disabled={!fetchingUrl.trim() || fetchLoading}
                style={{ background: '#7c3aed', color: 'white', border: 'none', borderRadius: 7, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0, opacity: !fetchingUrl.trim() ? .5 : 1 }}
              >
                {fetchLoading ? '…' : 'Fetch'}
              </button>
            </div>
          </div>

          {/* Gallery */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Gallery</h2>
            {galleryImages.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                {galleryImages.map(url => (
                  <div key={url} className="image-thumb">
                    <img src={url} alt="" />
                    <button
                      className="image-remove"
                      onClick={() => removeGalleryImage(url)}
                      style={{ background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: '50%', width: 20, height: 20, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, position: 'absolute', top: 4, right: 4 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input ref={galleryFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => {
              const file = e.target.files?.[0]
              if (file) uploadImage(file, false)
              e.target.value = ''
            }} />
            <button
              onClick={() => galleryFileRef.current?.click()}
              disabled={uploadingImage}
              style={{ width: '100%', background: 'white', border: '1px dashed #cbd5e1', borderRadius: 7, padding: '7px', fontSize: 12, color: '#64748b', cursor: 'pointer', marginBottom: 8 }}
            >
              {uploadingImage ? 'Uploading…' : '+ Add Image'}
            </button>

            {imageError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 6, padding: '6px 10px', fontSize: 12, marginTop: 6 }}>{imageError}</div>
            )}
          </div>

          {/* Status */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '16px 16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>Status</h2>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: '#7c3aed', cursor: 'pointer' }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{isActive ? 'Active' : 'Archived'}</div>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>{isActive ? 'Visible to CSRs' : 'Hidden from spec creation flow'}</div>
              </div>
            </label>
          </div>

          {/* Record info */}
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>Record Info</div>
            <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div>Created {new Date(idea.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div>Updated {new Date(idea.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>

          <button
            onClick={() => save()}
            disabled={saving}
            style={{ width: '100%', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
