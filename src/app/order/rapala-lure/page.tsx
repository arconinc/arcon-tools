'use client'

import { useRef, useState } from 'react'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

const PRICING_TIERS = [
  { min: 2500, price: 5.25 },
  { min: 1000, price: 5.5 },
  { min: 500, price: 5.65 },
  { min: 300, price: 5.75 },
  { min: 150, price: 6.0 },
]

function getUnitPrice(qty: number): number | null {
  if (qty < 150) return null
  return PRICING_TIERS.find((t) => qty >= t.min)?.price ?? null
}

function calcPricing(qty: number, colors: number, backImprint: boolean, backColors: number) {
  const unitPrice = getUnitPrice(qty)
  if (!unitPrice) return null
  const base = qty * unitPrice
  const artSetup = colors * 50
  const locationFee = backImprint ? 1 : 0
  const extraColorFee = backColors * 0.5
  return { unitPrice, base, artSetup, locationFee, extraColorFee, total: base + artSetup + locationFee + extraColorFee }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

const LURE_OPTIONS = [
  { id: 'bp', name: 'Blue Pearl', image: '/lure_bp.png' },
  { id: 'rh', name: 'Red Head', image: '/lure_rh.png' },
] as const

// ---------------------------------------------------------------------------
// File Upload Zone component
// ---------------------------------------------------------------------------

interface FileZoneProps {
  label: string
  hint?: string
  file: File | null
  onChange: (f: File | null) => void
  required?: boolean
}

function FileZone({ label, hint, file, onChange, required }: FileZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onChange(f)
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
        {label} {required && <span style={{ color: '#6b1e98' }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>{hint}</p>}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragging ? '#6b1e98' : file ? '#a78bfa' : '#d1d5db'}`,
          borderRadius: 8,
          padding: '20px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#faf5ff' : file ? '#fdfbff' : '#fafafa',
          transition: 'all 0.15s',
        }}
      >
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b1e98" strokeWidth="2"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{file.name}</p>
              <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); if (inputRef.current) inputRef.current.value = '' }}
              style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}
              aria-label="Remove file"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" style={{ margin: '0 auto 8px' }}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
              <span style={{ color: '#6b1e98', fontWeight: 500 }}>Click to upload</span> or drag and drop
            </p>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.eps,.ai,.svg,.png,.jpg,.jpeg"
        style={{ display: 'none' }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

interface FormState {
  lureType: string
  firstName: string
  lastName: string
  company: string
  email: string
  phone: string
  quantity: string
  artColors: string
  pantoneColor: string
  backImprint: boolean
  backColors: string
  notes: string
}

const INITIAL: FormState = {
  lureType: '',
  firstName: '', lastName: '', company: '', email: '', phone: '',
  quantity: '', artColors: '1', pantoneColor: '', backImprint: false, backColors: '0', notes: '',
}

export default function RapalaLureOrderPage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [frontFile, setFrontFile] = useState<File | null>(null)
  const [backFile, setBackFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const qty = parseInt(form.quantity, 10) || 0
  const colors = Math.max(1, parseInt(form.artColors, 10) || 1)
  const backColors = Math.max(0, parseInt(form.backColors, 10) || 0)
  const pricing = qty >= 150 ? calcPricing(qty, colors, form.backImprint, backColors) : null

  function set(field: keyof FormState, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.lureType) { setError('Please select a lure style before continuing.'); return }
    if (!frontFile) { setError('Please upload your front artwork file.'); return }

    setSubmitting(true)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, String(v)))
    fd.append('frontArtwork', frontFile)
    if (backFile && form.backImprint) fd.append('backArtwork', backFile)

    try {
      const res = await fetch('/api/public/lure-order', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Something went wrong. Please try again.'); return }
      setSubmitted(true)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ------------------------------------------------------------------
  // Success state
  // ------------------------------------------------------------------
  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f4f5', padding: '40px 16px' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: '56px 48px', maxWidth: 520, width: '100%', textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, color: '#1f2937' }}>Order Received!</h1>
          <p style={{ margin: '0 0 8px', fontSize: 15, color: '#6b7280', lineHeight: 1.6 }}>
            Thank you, <strong>{form.firstName}</strong>! Your lure order request has been submitted successfully.
          </p>
          <p style={{ margin: '0 0 32px', fontSize: 14, color: '#9ca3af', lineHeight: 1.6 }}>
            A confirmation email has been sent to <strong>{form.email}</strong>. A member of our team will be in touch within 1–2 business days.
          </p>
          <div style={{ background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, padding: '16px 20px', textAlign: 'left' }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#6b1e98' }}>Order summary</p>
            <p style={{ margin: 0, fontSize: 14, color: '#7e22ce' }}>
              {LURE_OPTIONS.find((l) => l.id === form.lureType)?.name} · {form.quantity} units — {form.company}
              {pricing ? ` · ${fmt(pricing.total)} estimated` : ''}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------
  // Input helpers
  // ------------------------------------------------------------------
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14,
    color: '#1f2937', background: '#fff', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6,
  }
  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: '#6b1e98', textTransform: 'uppercase',
    letterSpacing: '0.06em', margin: '0 0 16px', paddingBottom: 8,
    borderBottom: '2px solid #f3e8ff',
  }
  const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }

  return (
    <>
      <style>{`
        input:focus, textarea:focus, select:focus { border-color: #6b1e98 !important; box-shadow: 0 0 0 3px rgba(107,30,152,.12); }
        input[type=number]::-webkit-inner-spin-button { opacity: 1; }
        @media (max-width: 600px) { .two-col { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f4f4f5', padding: '40px 16px' }}>
        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', border: '2.5px solid #111', padding: '4px 14px', marginBottom: 8 }}>
            <span style={{ color: '#111', fontSize: 20, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Arcon Inc</span>
            <span style={{ color: '#6b1e98', fontSize: 26, fontWeight: 900, lineHeight: 1, marginLeft: 2 }}>.</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, color: '#6b7280' }}>Rapala Logo Lure Order Form</p>
        </div>

        <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

          {/* ---- Main form card ---- */}
          <form onSubmit={handleSubmit}>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' }}>

              {/* Lure Style */}
              <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                <p style={sectionHeadStyle}>
                  Select Your Lure Style <span style={{ color: '#6b1e98' }}>*</span>
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {LURE_OPTIONS.map((lure) => {
                    const selected = form.lureType === lure.id
                    return (
                      <button
                        key={lure.id}
                        type="button"
                        onClick={() => set('lureType', lure.id)}
                        style={{
                          position: 'relative',
                          border: `2px solid ${selected ? '#6b1e98' : '#e5e7eb'}`,
                          borderRadius: 12,
                          padding: '20px 16px 16px',
                          background: selected ? '#faf5ff' : '#fafafa',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'border-color 0.15s, background 0.15s',
                        }}
                      >
                        {selected && (
                          <div style={{
                            position: 'absolute', top: 10, right: 10,
                            width: 22, height: 22, borderRadius: '50%',
                            background: '#6b1e98', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={lure.image}
                          alt={lure.name}
                          style={{ width: '100%', maxWidth: 180, height: 110, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }}
                        />
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: selected ? '#6b1e98' : '#374151' }}>
                          {lure.name}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Contact */}
              <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                <p style={sectionHeadStyle}>Contact Information</p>
                <div className="two-col" style={{ ...rowStyle, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>First Name <span style={{ color: '#6b1e98' }}>*</span></label>
                    <input style={inputStyle} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required autoComplete="given-name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name <span style={{ color: '#6b1e98' }}>*</span></label>
                    <input style={inputStyle} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required autoComplete="family-name" />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Company <span style={{ color: '#6b1e98' }}>*</span></label>
                  <input style={inputStyle} value={form.company} onChange={(e) => set('company', e.target.value)} required autoComplete="organization" />
                </div>
                <div className="two-col" style={rowStyle}>
                  <div>
                    <label style={labelStyle}>Email <span style={{ color: '#6b1e98' }}>*</span></label>
                    <input style={inputStyle} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="(555) 000-0000" />
                  </div>
                </div>
              </div>

              {/* Order Details */}
              <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                <p style={sectionHeadStyle}>Order Details</p>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Quantity <span style={{ color: '#6b1e98' }}>*</span></label>
                  <input
                    style={inputStyle} type="number" min={150} step={1}
                    value={form.quantity} onChange={(e) => set('quantity', e.target.value)}
                    required placeholder="Minimum 150 units"
                  />
                  {qty > 0 && qty < 150 && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#ef4444' }}>Minimum order is 150 units</p>
                  )}
                  {pricing && (
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b1e98' }}>
                      {fmt(pricing.unitPrice)}/unit at this quantity
                    </p>
                  )}
                </div>

                <div className="two-col" style={{ ...rowStyle, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>Number of Imprint Colors <span style={{ color: '#6b1e98' }}>*</span></label>
                    <input
                      style={inputStyle} type="number" min={1} step={1}
                      value={form.artColors} onChange={(e) => set('artColors', e.target.value)}
                      required
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                      Art setup fee: {colors} color{colors !== 1 ? 's' : ''} × $50.00 = {fmt(colors * 50)}
                    </p>
                  </div>
                  <div>
                    <label style={labelStyle}>Pantone Color(s)</label>
                    <input
                      style={inputStyle}
                      value={form.pantoneColor}
                      onChange={(e) => set('pantoneColor', e.target.value)}
                      placeholder="e.g. PMS 286 C, PMS 032 C"
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                      Separate multiple codes with commas
                    </p>
                  </div>
                </div>

                {/* Back imprint toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: form.backImprint ? 16 : 0 }}>
                  <input
                    type="checkbox"
                    checked={form.backImprint}
                    onChange={(e) => set('backImprint', e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#6b1e98', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>
                    Include back imprint <span style={{ fontWeight: 400, color: '#9ca3af' }}>($1.00 additional location)</span>
                  </span>
                </label>

                {form.backImprint && (
                  <div>
                    <label style={labelStyle}>Back Imprint Colors</label>
                    <input
                      style={inputStyle} type="number" min={0} step={1}
                      value={form.backColors} onChange={(e) => set('backColors', e.target.value)}
                    />
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>
                      Additional color fee: {backColors} × $0.50 = {fmt(backColors * 0.5)}
                    </p>
                  </div>
                )}
              </div>

              {/* Artwork */}
              <div style={{ padding: '28px 32px', borderBottom: '1px solid #f3f4f6' }}>
                <p style={sectionHeadStyle}>Artwork Upload</p>
                <div style={{ marginBottom: form.backImprint ? 20 : 0 }}>
                  <FileZone
                    label="Front Artwork"
                    hint="Vector preferred: .pdf, .eps, .ai — PNG/JPG also accepted. Max 25 MB."
                    file={frontFile}
                    onChange={setFrontFile}
                    required
                  />
                </div>
                {form.backImprint && (
                  <FileZone
                    label="Back Artwork"
                    hint="Only needed if your logo differs from the front. Vector preferred."
                    file={backFile}
                    onChange={setBackFile}
                  />
                )}
              </div>

              {/* Notes */}
              <div style={{ padding: '28px 32px' }}>
                <p style={sectionHeadStyle}>Additional Notes</p>
                <textarea
                  style={{ ...inputStyle, height: 96, resize: 'vertical', fontFamily: 'inherit' }}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Colors, Pantone codes, special instructions, questions…"
                />

                {error && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 14, color: '#dc2626' }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{
                    marginTop: 20, width: '100%', padding: '13px 20px',
                    background: submitting ? '#9ca3af' : '#6b1e98',
                    color: '#fff', border: 'none', borderRadius: 10,
                    fontSize: 15, fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'background 0.15s',
                  }}
                >
                  {submitting && (
                    <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.3)" strokeWidth="4"/>
                      <path fill="rgba(255,255,255,.9)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                  )}
                  {submitting ? 'Submitting…' : 'Submit Order Request'}
                </button>
                <p style={{ margin: '12px 0 0', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                  By submitting you agree to be contacted by Arcon Inc. regarding your order.
                </p>
              </div>
            </div>
          </form>

          {/* ---- Pricing summary sidebar ---- */}
          <div style={{ position: 'sticky', top: 24 }}>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <div style={{ background: '#6b1e98', padding: '16px 20px' }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Pricing Estimate
                </p>
              </div>
              <div style={{ padding: '16px 20px' }}>
                {/* Selected lure preview */}
                {form.lureType && (() => {
                  const lure = LURE_OPTIONS.find((l) => l.id === form.lureType)!
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 12px', background: '#faf5ff', borderRadius: 8, border: '1px solid #e9d5ff' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={lure.image} alt={lure.name} style={{ width: 52, height: 32, objectFit: 'contain' }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Selected style</p>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#6b1e98' }}>{lure.name}</p>
                      </div>
                    </div>
                  )
                })()}
                {/* Tier table */}
                <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Volume Tiers</p>
                {PRICING_TIERS.slice().reverse().map((tier, i) => {
                  const active = qty >= tier.min && (i === PRICING_TIERS.length - 1 || qty < PRICING_TIERS.slice().reverse()[i + 1].min)
                  const nextTier = PRICING_TIERS.slice().reverse()[i + 1]
                  const label = nextTier
                    ? `${tier.min.toLocaleString()}–${(nextTier.min - 1).toLocaleString()}`
                    : `${tier.min.toLocaleString()}+`
                  return (
                    <div key={tier.min} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '6px 10px', borderRadius: 6, marginBottom: 3,
                      background: active ? '#faf5ff' : 'transparent',
                      border: active ? '1px solid #e9d5ff' : '1px solid transparent',
                    }}>
                      <span style={{ fontSize: 13, color: active ? '#6b1e98' : '#6b7280', fontWeight: active ? 600 : 400 }}>{label}</span>
                      <span style={{ fontSize: 13, color: active ? '#6b1e98' : '#374151', fontWeight: active ? 700 : 500 }}>{fmt(tier.price)}</span>
                    </div>
                  )
                })}

                {/* Live breakdown */}
                {pricing ? (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
                    <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.04em' }}>Your Order</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                      <span>{qty.toLocaleString()} × {fmt(pricing.unitPrice)}</span>
                      <span>{fmt(pricing.base)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                      <span>Art setup ({colors} color{colors !== 1 ? 's' : ''})</span>
                      <span>{fmt(pricing.artSetup)}</span>
                    </div>
                    {pricing.locationFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                        <span>Back imprint location</span>
                        <span>{fmt(pricing.locationFee)}</span>
                      </div>
                    )}
                    {pricing.extraColorFee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                        <span>Back colors ({backColors} × $0.50)</span>
                        <span>{fmt(pricing.extraColorFee)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, color: '#6b1e98', marginTop: 10, paddingTop: 10, borderTop: '1px solid #f3f4f6' }}>
                      <span>Estimated Total</span>
                      <span>{fmt(pricing.total)}</span>
                    </div>
                  </div>
                ) : (
                  <p style={{ marginTop: 16, fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>
                    Enter a quantity of 150+ to see your estimate.
                  </p>
                )}

                <div style={{ marginTop: 16, padding: '10px 12px', background: '#f9fafb', borderRadius: 6, fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                  Prices shown are estimates. Final pricing confirmed by Arcon Inc. Sales tax applies in most states.
                </div>
              </div>
            </div>

            {/* Contact info */}
            <div style={{ marginTop: 16, padding: '16px 20px', background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Questions?</p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                Contact Aaron Wheatcraft at{' '}
                <a href="mailto:awheatcraft@arconinc.com" style={{ color: '#6b1e98', textDecoration: 'none' }}>
                  awheatcraft@arconinc.com
                </a>
              </p>
            </div>
          </div>

        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#9ca3af' }}>
          © {new Date().getFullYear()} Arcon Inc. · <a href="https://www.arconinc.com" style={{ color: '#9ca3af' }}>arconinc.com</a>
        </p>
      </div>
    </>
  )
}
