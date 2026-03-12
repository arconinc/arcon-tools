'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { BannerSlide } from '@/types'

// ── Constants ──────────────────────────────────────────────────────────────────

const EMOJI_LIST = [
  '🎉', '🎊', '🥂', '🎂', '🏆', '🌟', '✨',
  '📅', '📈', '📊', '💼', '🤝', '📋', '✅',
  '👋', '🙌', '👏', '🫶', '❤️', '🔥', '💡',
  '🚀', '📢', '💪',
]

const GRADIENT_OPTIONS: { key: BannerSlide['bg_gradient']; label: string; css: string }[] = [
  { key: 'hs-1', label: 'Purple', css: 'linear-gradient(135deg, #1a0a2e 0%, #4a1575 40%, #7c3aed 70%, #a855f7 100%)' },
  { key: 'hs-2', label: 'Blue',   css: 'linear-gradient(135deg, #0c2340 0%, #1e4d8c 40%, #2563eb 70%, #60a5fa 100%)' },
  { key: 'hs-3', label: 'Green',  css: 'linear-gradient(135deg, #1a2e0c 0%, #2e5c1a 40%, #16a34a 70%, #4ade80 100%)' },
  { key: 'hs-4', label: 'Orange', css: 'linear-gradient(135deg, #2e1a0c 0%, #7c3404 40%, #c2410c 70%, #fb923c 100%)' },
  { key: 'hs-5', label: 'Dark',   css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%)' },
]

function newSlide(): BannerSlide {
  return {
    id: crypto.randomUUID(),
    pre_heading: '',
    headline: '',
    emoji: '',
    subhead: '',
    bg_type: 'gradient',
    bg_gradient: 'hs-1',
    bg_image_url: null,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BannerAdminPage() {
  const [slides, setSlides] = useState<BannerSlide[]>([])
  const [publishedSlides, setPublishedSlides] = useState<BannerSlide[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [hasUnsaved, setHasUnsaved] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load draft + published on mount
  useEffect(() => {
    fetch('/api/admin/banner')
      .then((r) => r.json())
      .then((data: Array<{ status: string; slides_json: BannerSlide[] }>) => {
        if (Array.isArray(data)) {
          const draft = data.find((c) => c.status === 'draft')
          const pub = data.find((c) => c.status === 'published')
          setSlides(draft?.slides_json ?? [])
          setPublishedSlides(pub?.slides_json ?? [])
        }
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load banner configuration')
        setLoading(false)
      })
  }, [])

  const saveDraft = useCallback(async (updated: BannerSlide[]) => {
    setSaving(true)
    const res = await fetch('/api/admin/banner', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slides_json: updated }),
    })
    setSaving(false)
    if (res.ok) {
      setHasUnsaved(true)
    }
  }, [])

  function scheduleSave(updated: BannerSlide[]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDraft(updated), 600)
  }

  function updateSlide(id: string, changes: Partial<BannerSlide>) {
    const updated = slides.map((s) => s.id === id ? { ...s, ...changes } : s)
    setSlides(updated)
    scheduleSave(updated)
  }

  function addSlide() {
    const updated = [...slides, newSlide()]
    setSlides(updated)
    scheduleSave(updated)
  }

  function removeSlide(id: string) {
    if (!confirm('Remove this slide?')) return
    const updated = slides.filter((s) => s.id !== id)
    setSlides(updated)
    scheduleSave(updated)
  }

  function moveSlide(id: string, dir: -1 | 1) {
    const idx = slides.findIndex((s) => s.id === id)
    if (idx + dir < 0 || idx + dir >= slides.length) return
    const updated = [...slides]
    ;[updated[idx], updated[idx + dir]] = [updated[idx + dir], updated[idx]]
    setSlides(updated)
    scheduleSave(updated)
  }

  async function publishLive() {
    if (!confirm('Publish these slides to the live dashboard?')) return
    setPublishing(true)
    const res = await fetch('/api/admin/banner', { method: 'POST' })
    setPublishing(false)
    if (res.ok) {
      setPublishedSlides(slides)
      setHasUnsaved(false)
    } else {
      setError('Publish failed — please try again')
    }
  }

  const isDirty = hasUnsaved || JSON.stringify(slides) !== JSON.stringify(publishedSlides)

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((n) => <div key={n} className="h-32 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        /* Reuse dashboard hero CSS for the preview */
        .be-hero { position: relative; height: 480px; overflow: hidden; flex-shrink: 0; border-radius: 12px; }
        .be-hero-slides { display: flex; height: 100%; transition: transform 0.7s cubic-bezier(0.77,0,0.18,1); }
        .be-hero-slide { min-width: 100%; height: 100%; position: relative; display: flex; align-items: flex-end; overflow: hidden; background-size: cover; background-position: center; }
        .hs-1 { background: linear-gradient(135deg, #1a0a2e 0%, #4a1575 40%, #7c3aed 70%, #a855f7 100%); }
        .hs-2 { background: linear-gradient(135deg, #0c2340 0%, #1e4d8c 40%, #2563eb 70%, #60a5fa 100%); }
        .hs-3 { background: linear-gradient(135deg, #1a2e0c 0%, #2e5c1a 40%, #16a34a 70%, #4ade80 100%); }
        .hs-4 { background: linear-gradient(135deg, #2e1a0c 0%, #7c3404 40%, #c2410c 70%, #fb923c 100%); }
        .hs-5 { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%); }
        .be-hero-slide::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%); }
        .be-caption { position: relative; z-index: 10; padding: 0 28px 22px; width: 100%; }
        .be-eyebrow { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.6); margin-bottom: 4px; }
        .be-title { font-size: 22px; font-weight: 800; color: #fff; line-height: 1.2; margin-bottom: 4px; text-shadow: 0 1px 4px rgba(0,0,0,0.4); }
        .be-sub { font-size: 13px; color: rgba(255,255,255,0.75); font-weight: 500; }
        .be-arrow { position: absolute; top: 50%; transform: translateY(-50%); z-index: 20; width: 36px; height: 36px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; backdrop-filter: blur(4px); }
        .be-prev { left: 14px; }
        .be-next { right: 14px; }
        .be-dots { position: absolute; bottom: 14px; right: 24px; display: flex; gap: 6px; z-index: 20; }
        .be-dot { width: 6px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.35); cursor: pointer; transition: 0.2s background, 0.3s width; }
        .be-dot.active { background: #fff; width: 18px; }
        /* Slide thumbnail gradient strip */
        .grad-thumb { width: 32px; height: 24px; border-radius: 4px; flex-shrink: 0; }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 px-8 pt-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Edit Banner</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage hero carousel slides. Changes auto-save as draft and won&apos;t go live until you publish.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saving && <span className="text-xs text-slate-400">Saving…</span>}
            {isDirty && !saving && (
              <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
                Unpublished changes
              </span>
            )}
            <button
              onClick={() => { setPreviewIndex(0); setShowPreview(true) }}
              className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors"
            >
              Preview
            </button>
            <button
              onClick={publishLive}
              disabled={publishing}
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {publishing ? 'Publishing…' : 'Publish Live'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-8 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {/* Slides */}
        <div className="px-8 space-y-4 pb-8">
          {slides.length === 0 && (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center">
              <div className="text-3xl mb-3">🖼️</div>
              <p className="text-slate-500 text-sm font-medium">No slides yet.</p>
              <p className="text-slate-400 text-xs mt-1">Click &quot;Add Slide&quot; below to get started.</p>
            </div>
          )}

          {slides.map((slide, idx) => (
            <SlideCard
              key={slide.id}
              slide={slide}
              index={idx}
              total={slides.length}
              onChange={(changes) => updateSlide(slide.id, changes)}
              onRemove={() => removeSlide(slide.id)}
              onMove={(dir) => moveSlide(slide.id, dir)}
            />
          ))}

          <button
            onClick={addSlide}
            className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 text-sm font-medium rounded-2xl hover:border-purple-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Slide
          </button>
        </div>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          slides={slides}
          initialIndex={previewIndex}
          onClose={() => setShowPreview(false)}
          onPublish={publishLive}
          publishing={publishing}
        />
      )}
    </>
  )
}

// ── SlideCard ─────────────────────────────────────────────────────────────────

function SlideCard({
  slide, index, total, onChange, onRemove, onMove,
}: {
  slide: BannerSlide
  index: number
  total: number
  onChange: (c: Partial<BannerSlide>) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const [showEmoji, setShowEmoji] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    setUploading(true)

    const form = new FormData()
    form.append('file', file)
    const res = await fetch('/api/admin/banner/upload', { method: 'POST', body: form })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setUploadError(data.error ?? 'Upload failed')
      return
    }
    onChange({ bg_image_url: data.url })
  }

  const gradientCss = GRADIENT_OPTIONS.find((g) => g.key === slide.bg_gradient)?.css ?? GRADIENT_OPTIONS[0].css

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 bg-slate-50">
        {/* Gradient/image thumb */}
        <div
          className="grad-thumb"
          style={{
            background: slide.bg_type === 'image' && slide.bg_image_url
              ? `url(${slide.bg_image_url}) center/cover`
              : gradientCss,
          }}
        />
        <span className="text-sm font-semibold text-slate-700 flex-1">
          Slide {index + 1}
          {slide.headline && (
            <span className="font-normal text-slate-400"> — {slide.headline}{slide.emoji ? ` ${slide.emoji}` : ''}</span>
          )}
        </span>
        {/* Reorder */}
        <div className="flex gap-1">
          <button
            onClick={() => onMove(-1)}
            disabled={index === 0}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            title="Move up"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" /></svg>
          </button>
          <button
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-100 transition-colors"
            title="Move down"
          >
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
        <button
          onClick={onRemove}
          className="text-xs font-medium text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Card body */}
      <div className="grid grid-cols-2 gap-6 p-5">
        {/* Left — text fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Pre-heading
            </label>
            <input
              type="text"
              value={slide.pre_heading}
              onChange={(e) => onChange({ pre_heading: e.target.value })}
              placeholder="e.g. 5 YEAR ANNIVERSARY"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <p className="text-xs text-slate-400 mt-1">Displayed as a small label above the headline.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Headline
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={slide.headline}
                onChange={(e) => onChange({ headline: e.target.value })}
                placeholder="e.g. Congrats Cami Johnson — 5 Years!"
                className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
              />
              {/* Emoji picker toggle */}
              <div className="relative">
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  className="h-full px-3 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                  title="Pick emoji"
                >
                  {slide.emoji || '😀'}
                </button>
                {showEmoji && (
                  <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-3 w-52">
                    <div className="grid grid-cols-6 gap-1 mb-2">
                      {EMOJI_LIST.map((em) => (
                        <button
                          key={em}
                          onClick={() => {
                            onChange({ emoji: slide.emoji === em ? '' : em })
                            setShowEmoji(false)
                          }}
                          className={`text-lg rounded p-1 hover:bg-slate-100 transition-colors ${slide.emoji === em ? 'bg-purple-100 ring-1 ring-purple-400' : ''}`}
                        >
                          {em}
                        </button>
                      ))}
                    </div>
                    {slide.emoji && (
                      <button
                        onClick={() => { onChange({ emoji: '' }); setShowEmoji(false) }}
                        className="w-full text-xs text-red-500 hover:text-red-700 py-1 border-t border-slate-100 mt-1"
                      >
                        Clear emoji
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1">Emoji will be appended after the headline text.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Subhead
            </label>
            <input
              type="text"
              value={slide.subhead}
              onChange={(e) => onChange({ subhead: e.target.value })}
              placeholder="e.g. Thank you for five incredible years with Arcon"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
          </div>
        </div>

        {/* Right — background */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Background
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => onChange({ bg_type: 'gradient' })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  slide.bg_type === 'gradient'
                    ? 'bg-purple-700 border-purple-700 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Gradient
              </button>
              <button
                onClick={() => onChange({ bg_type: 'image' })}
                className={`flex-1 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  slide.bg_type === 'image'
                    ? 'bg-purple-700 border-purple-700 text-white'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Image
              </button>
            </div>

            {slide.bg_type === 'gradient' && (
              <div className="flex gap-2 flex-wrap">
                {GRADIENT_OPTIONS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => onChange({ bg_gradient: g.key })}
                    title={g.label}
                    style={{ background: g.css }}
                    className={`w-10 h-8 rounded-lg transition-all ${
                      slide.bg_gradient === g.key
                        ? 'ring-2 ring-purple-600 ring-offset-2 scale-110'
                        : 'opacity-70 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            )}

            {slide.bg_type === 'image' && (
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                {slide.bg_image_url ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200" style={{ height: 100 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={slide.bg_image_url}
                      alt="Background"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="absolute bottom-2 right-2 text-xs bg-black/60 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-black/80 transition-colors"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full h-24 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                  >
                    {uploading ? (
                      <span>Uploading…</span>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span>Upload image</span>
                      </>
                    )}
                  </button>
                )}
                {uploadError && (
                  <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">
                  Recommended: <strong>1440 × 480px</strong> · JPEG, PNG, or WebP · Max 5MB
                </p>
                {slide.bg_image_url && (
                  <button
                    onClick={() => onChange({ bg_image_url: null })}
                    className="text-xs text-red-500 hover:text-red-700 mt-1"
                  >
                    Remove image
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Mini preview */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Preview
            </label>
            <div
              className="rounded-xl overflow-hidden flex items-end"
              style={{
                height: 96,
                background: slide.bg_type === 'image' && slide.bg_image_url
                  ? `url(${slide.bg_image_url}) center/cover`
                  : (GRADIENT_OPTIONS.find((g) => g.key === slide.bg_gradient)?.css ?? GRADIENT_OPTIONS[0].css),
                position: 'relative',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)' }} />
              <div style={{ position: 'relative', zIndex: 1, padding: '8px 12px', width: '100%' }}>
                {slide.pre_heading && (
                  <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.6)', marginBottom: 2 }}>
                    {slide.pre_heading}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 2 }}>
                  {slide.headline || <span style={{ opacity: 0.4 }}>Headline</span>}
                  {slide.emoji ? ` ${slide.emoji}` : ''}
                </div>
                {slide.subhead && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>{slide.subhead}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PreviewModal ──────────────────────────────────────────────────────────────

function PreviewModal({
  slides, initialIndex, onClose, onPublish, publishing,
}: {
  slides: BannerSlide[]
  initialIndex: number
  onClose: () => void
  onPublish: () => void
  publishing: boolean
}) {
  const [current, setCurrent] = useState(initialIndex)

  useEffect(() => {
    if (slides.length === 0) return
    const t = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 4800)
    return () => clearInterval(t)
  }, [slides.length])

  function goTo(i: number) {
    setCurrent(((i % slides.length) + slides.length) % slides.length)
  }

  const slide = slides[current]

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)' }}
    >
      <div className="w-full max-w-4xl">
        {/* Modal header */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-white font-semibold text-sm">
            Preview — {slides.length} slide{slides.length !== 1 ? 's' : ''}
            <span className="text-white/50 font-normal ml-2">(auto-advances every 4.8s)</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onPublish}
              disabled={publishing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
            >
              {publishing ? 'Publishing…' : 'Publish Live'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-white/30 text-white text-sm font-medium rounded-xl hover:bg-white/10 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {slides.length === 0 ? (
          <div className="be-hero flex items-center justify-center" style={{ background: '#1a1a2e' }}>
            <p className="text-white/50 text-sm">No slides to preview.</p>
          </div>
        ) : (
          <div className="be-hero">
            <div
              className="be-hero-slides"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {slides.map((s) => (
                <div
                  key={s.id}
                  className={`be-hero-slide${s.bg_type === 'gradient' ? ` ${s.bg_gradient}` : ''}`}
                  style={s.bg_type === 'image' && s.bg_image_url
                    ? { backgroundImage: `url(${s.bg_image_url})` }
                    : undefined}
                >
                  <div className="be-caption">
                    {s.pre_heading && <div className="be-eyebrow">{s.pre_heading}</div>}
                    <div className="be-title">
                      {s.headline || <em style={{ opacity: 0.4 }}>No headline</em>}
                      {s.emoji ? ` ${s.emoji}` : ''}
                    </div>
                    {s.subhead && <div className="be-sub">{s.subhead}</div>}
                  </div>
                </div>
              ))}
            </div>

            {/* Arrows */}
            <div className="be-arrow be-prev" onClick={() => goTo(current - 1)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            <div className="be-arrow be-next" onClick={() => goTo(current + 1)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>

            {/* Dots */}
            <div className="be-dots">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={`be-dot${i === current ? ' active' : ''}`}
                  onClick={() => goTo(i)}
                />
              ))}
            </div>

            {/* Slide counter */}
            <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 20, background: 'rgba(0,0,0,0.4)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
              {current + 1} / {slides.length}
            </div>
          </div>
        )}

        {/* Slide thumbnails */}
        {slides.length > 0 && (
          <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => goTo(i)}
                className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${i === current ? 'border-white scale-105' : 'border-transparent opacity-60 hover:opacity-100'}`}
                style={{
                  width: 80,
                  height: 48,
                  background: s.bg_type === 'image' && s.bg_image_url
                    ? `url(${s.bg_image_url}) center/cover`
                    : (GRADIENT_OPTIONS.find((g) => g.key === s.bg_gradient)?.css ?? GRADIENT_OPTIONS[0].css),
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
