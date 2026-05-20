'use client'

import { useState, useEffect } from 'react'
import { CALENDAR_LINKS, SHOWCASE_EVENT } from '@/lib/product-showcase-config'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Holiday Items',
  'Client Appreciation',
  'Employee Recognition',
  'Apparel',
  'Printed Materials',
  'Custom Packaging',
  'Safety Goals',
  'New Hire Gifting',
  'Other',
]

const NAVY = '#1a2f5e'
const NAVY_DARK = '#0f1e40'
const NAVY_LIGHT = '#e8edf7'
const NAVY_BORDER = '#c5cfdf'

// ICS data URL for client-side download
function buildICSDataUrl(): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Arcon Inc.//Product Showcase 2026//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'DTSTART;TZID=America/Chicago:20260918T110000',
    'DTEND;TZID=America/Chicago:20260918T140000',
    'SUMMARY:Arcon Product Showcase 2026',
    'LOCATION:Union 32 Craft House\\, 2864 Highway 55\\, Eagan\\, MN 55121',
    'DESCRIPTION:Join Arcon Inc. for our annual Product Showcase! Come see this year\'s trending items. Enjoy a meal and beverage on us!',
    'STATUS:CONFIRMED',
    'UID:product-showcase-2026@arconinc.com',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines)}`
}

// ---------------------------------------------------------------------------
// Add to Calendar card
// ---------------------------------------------------------------------------

function AddToCalendarCard() {
  const [icsUrl, setIcsUrl] = useState('')
  useEffect(() => {
    setIcsUrl(buildICSDataUrl())
  }, [])

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '9px 14px', borderRadius: 7, fontSize: 13,
    fontWeight: 600, cursor: 'pointer', textDecoration: 'none',
    transition: 'opacity 0.15s', border: 'none', width: '100%',
    boxSizing: 'border-box', marginBottom: 8,
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' }}>
      <div style={{ background: NAVY, padding: '14px 18px' }}>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Add to Calendar
        </p>
      </div>
      <div style={{ padding: '14px 18px' }}>
        <a
          href={CALENDAR_LINKS.google}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnBase, background: NAVY, color: '#fff' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Google Calendar
        </a>
        <a
          href={CALENDAR_LINKS.outlook}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btnBase, background: NAVY_LIGHT, color: NAVY, border: `1px solid ${NAVY_BORDER}` }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Outlook Calendar
        </a>
        {icsUrl && (
          <a
            href={icsUrl}
            download="arcon-product-showcase-2026.ics"
            style={{ ...btnBase, background: NAVY_LIGHT, color: NAVY, border: `1px solid ${NAVY_BORDER}`, marginBottom: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download .ics
          </a>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Attendee {
  first_name: string
  last_name: string
  email: string
}

interface FormState {
  firstName: string
  lastName: string
  email: string
  company: string
  jobTitle: string
  phone: string
  arconSalespersonId: string
  categories: string[]
  otherCategoryText: string
}

interface SalesPerson {
  id: string
  display_name: string
}

const INITIAL: FormState = {
  firstName: '', lastName: '', email: '', company: '',
  jobTitle: '', phone: '', arconSalespersonId: '',
  categories: [], otherCategoryText: '',
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProductShowcasePage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-populate from URL params (Mailchimp merge tags)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setForm((f) => ({
      ...f,
      firstName: params.get('first_name') || f.firstName,
      lastName: params.get('last_name') || f.lastName,
      email: params.get('email') || f.email,
      company: params.get('company') || f.company,
    }))
  }, [])

  // Fetch Sales employees
  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((data: { id: string; display_name: string; department?: string[] | null }[]) => {
        const sales = data
          .filter((e) => e.department?.includes('Sales'))
          .sort((a, b) => a.display_name.localeCompare(b.display_name))
        setSalesPeople(sales)
      })
      .catch(() => {})
  }, [])

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function toggleCategory(cat: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(cat)
        ? f.categories.filter((c) => c !== cat)
        : [...f.categories, cat],
    }))
  }

  function addAttendee() {
    setAttendees((a) => [...a, { first_name: '', last_name: '', email: '' }])
  }

  function removeAttendee(i: number) {
    setAttendees((a) => a.filter((_, idx) => idx !== i))
  }

  function updateAttendee(i: number, field: keyof Attendee, value: string) {
    setAttendees((a) => a.map((att, idx) => (idx === i ? { ...att, [field]: value } : att)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const allCategories = form.categories.includes('Other') && form.otherCategoryText.trim()
      ? form.categories.filter((c) => c !== 'Other').concat(form.otherCategoryText.trim())
      : form.categories.filter((c) => c !== 'Other')

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/product-showcase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: form.firstName,
          last_name: form.lastName,
          email: form.email,
          company: form.company,
          job_title: form.jobTitle || undefined,
          phone: form.phone || undefined,
          arcon_salesperson_id: form.arconSalespersonId,
          categories: allCategories,
          additional_attendees: attendees,
        }),
      })
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
  // Shared styles
  // ------------------------------------------------------------------
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    border: `1px solid ${NAVY_BORDER}`, borderRadius: 8, fontSize: 14,
    color: '#1f2937', background: '#fff', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6,
  }
  const sectionHeadStyle: React.CSSProperties = {
    fontSize: 13, fontWeight: 700, color: NAVY, textTransform: 'uppercase',
    letterSpacing: '0.07em', margin: '0 0 16px', paddingBottom: 8,
    borderBottom: `2px solid ${NAVY_LIGHT}`,
  }
  const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }

  // ------------------------------------------------------------------
  // Success state
  // ------------------------------------------------------------------
  if (submitted) {
    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap');
          input:focus,select:focus,textarea:focus{border-color:${NAVY}!important;box-shadow:0 0 0 3px rgba(26,47,94,.12)}
        `}</style>
        <div style={{ minHeight: '100vh', background: '#f0f2f7', padding: '40px 16px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '48px 40px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 style={{ margin: '0 0 12px', fontSize: 24, fontWeight: 700, color: NAVY }}>You&rsquo;re registered!</h1>
              <p style={{ margin: '0 0 8px', fontSize: 15, color: '#475569', lineHeight: 1.6 }}>
                Thanks, <strong>{form.firstName}</strong>! We&rsquo;re excited to see you and your team at the Arcon Product Showcase.
              </p>
              <p style={{ margin: '0 0 32px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
                A confirmation email with event details has been sent to <strong>{form.email}</strong>
                {attendees.length > 0 && ` and ${attendees.length} additional attendee${attendees.length > 1 ? 's' : ''}`}.
                We&rsquo;ll be in touch with more details as the event approaches.
              </p>
              <div style={{ background: NAVY_LIGHT, border: `1px solid ${NAVY_BORDER}`, borderRadius: 8, padding: '16px 20px', textAlign: 'left', marginBottom: 24 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: NAVY, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Event Details</p>
                <p style={{ margin: '0 0 2px', fontSize: 14, color: NAVY, fontWeight: 600 }}>{SHOWCASE_EVENT.date} &middot; {SHOWCASE_EVENT.time}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#475569' }}>{SHOWCASE_EVENT.venue}, {SHOWCASE_EVENT.address}</p>
              </div>
            </div>
            <div style={{ position: 'sticky', top: 24 }}>
              <AddToCalendarCard />
            </div>
          </div>
          <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#9ca3af' }}>
            &copy; {new Date().getFullYear()} Arcon Solutions &middot;{' '}
            <a href="https://www.arconinc.com" style={{ color: '#9ca3af' }}>arconinc.com</a>
          </p>
        </div>
      </>
    )
  }

  // ------------------------------------------------------------------
  // Form
  // ------------------------------------------------------------------
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@700&display=swap');
        input:focus,select:focus,textarea:focus{border-color:${NAVY}!important;box-shadow:0 0 0 3px rgba(26,47,94,.12)}
        .showcase-checkbox:checked{accent-color:${NAVY}}
        @media(max-width:700px){.form-grid{grid-template-columns:1fr!important}.sidebar{display:none!important}.sidebar-mobile{display:block!important}}
        .sidebar-mobile{display:none}
      `}</style>

      {/* Stars hero banner */}
      <div style={{
        background: `linear-gradient(135deg, ${NAVY_DARK} 0%, ${NAVY} 60%, #2c4a8a 100%)`,
        padding: '36px 24px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative stars */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.08, backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Arcon Solutions
          </p>
          <h1 style={{ margin: '0 0 4px', fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'Oswald, system-ui, sans-serif', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.1 }}>
            Product Showcase 2026
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: 'rgba(255,255,255,.75)' }}>
            Registration
          </p>
          {/* Ribbon date badge */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0 }}>
            <div style={{ width: 0, height: 0, borderTop: '16px solid transparent', borderBottom: '16px solid transparent', borderRight: `12px solid ${NAVY_DARK}` }} />
            <div style={{ background: NAVY_DARK, padding: '8px 20px' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                September 18<sup>th</sup>, 2026 &nbsp;&middot;&nbsp; 11:00 AM – 2:00 PM CT
              </span>
            </div>
            <div style={{ width: 0, height: 0, borderTop: '16px solid transparent', borderBottom: '16px solid transparent', borderLeft: `12px solid ${NAVY_DARK}` }} />
          </div>
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'rgba(255,255,255,.7)' }}>
            Union 32 Craft House &middot; 2864 Highway 55, Eagan, MN 55121
          </p>
        </div>
      </div>

      <div style={{ background: '#f0f2f7', padding: '32px 16px 48px' }}>
        <div className="form-grid" style={{ maxWidth: 760, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 280px', gap: 24, alignItems: 'start' }}>

          {/* ---- Main form ---- */}
          <form onSubmit={handleSubmit}>

            {/* Mobile event info */}
            <div className="sidebar-mobile" style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 16, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: NAVY }}>Come see this year&rsquo;s trending items.</p>
              <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>Enjoy a meal and beverage on us! &nbsp;🍺</p>
            </div>

            {/* Section 1 — Your Information */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '24px 28px' }}>
                <p style={sectionHeadStyle}>Your Information</p>
                <div style={{ ...rowStyle, marginBottom: 16 }}>
                  <div>
                    <label style={labelStyle}>First Name <span style={{ color: NAVY }}>*</span></label>
                    <input style={inputStyle} value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required autoComplete="given-name" />
                  </div>
                  <div>
                    <label style={labelStyle}>Last Name <span style={{ color: NAVY }}>*</span></label>
                    <input style={inputStyle} value={form.lastName} onChange={(e) => set('lastName', e.target.value)} required autoComplete="family-name" />
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Email Address <span style={{ color: NAVY }}>*</span></label>
                  <input style={inputStyle} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required autoComplete="email" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Company <span style={{ color: NAVY }}>*</span></label>
                  <input style={inputStyle} value={form.company} onChange={(e) => set('company', e.target.value)} required autoComplete="organization" />
                </div>
                <div style={{ ...rowStyle }}>
                  <div>
                    <label style={labelStyle}>Job Title</label>
                    <input style={inputStyle} value={form.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} autoComplete="organization-title" placeholder="Optional" />
                  </div>
                  <div>
                    <label style={labelStyle}>Phone</label>
                    <input style={inputStyle} type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" placeholder="Optional" />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2 — Arcon Contact */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '24px 28px' }}>
                <p style={sectionHeadStyle}>Arcon Contact <span style={{ color: NAVY }}>*</span></p>
                <label style={labelStyle}>Who is your Arcon sales representative?</label>
                <select
                  style={{ ...inputStyle, appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: 36 }}
                  value={form.arconSalespersonId}
                  onChange={(e) => set('arconSalespersonId', e.target.value)}
                  required
                >
                  <option value="">Select a sales contact…</option>
                  {salesPeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>{sp.display_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Section 3 — Categories of Interest */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '24px 28px' }}>
                <p style={sectionHeadStyle}>Categories of Interest</p>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>Select any categories you&rsquo;d like to explore at the showcase (optional).</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
                  {CATEGORIES.map((cat) => (
                    <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        className="showcase-checkbox"
                        checked={form.categories.includes(cat)}
                        onChange={() => toggleCategory(cat)}
                        style={{ width: 16, height: 16, accentColor: NAVY, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 14, color: '#374151' }}>{cat}</span>
                    </label>
                  ))}
                </div>
                {form.categories.includes('Other') && (
                  <div style={{ marginTop: 12 }}>
                    <input
                      style={{ ...inputStyle }}
                      placeholder="Please describe…"
                      value={form.otherCategoryText}
                      onChange={(e) => set('otherCategoryText', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Section 4 — Additional Attendees */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ padding: '24px 28px' }}>
                <p style={sectionHeadStyle}>Additional Attendees</p>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280' }}>
                  Bringing colleagues? Add them here — they&rsquo;ll each receive a confirmation email too.
                </p>

                {attendees.map((att, i) => (
                  <div key={i} style={{ background: NAVY_LIGHT, border: `1px solid ${NAVY_BORDER}`, borderRadius: 10, padding: '16px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>Attendee {i + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeAttendee(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, display: 'flex', alignItems: 'center' }}
                        aria-label="Remove attendee"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                    <div style={{ ...rowStyle, marginBottom: 10 }}>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 13 }}>First Name <span style={{ color: NAVY }}>*</span></label>
                        <input style={{ ...inputStyle, fontSize: 13 }} value={att.first_name} onChange={(e) => updateAttendee(i, 'first_name', e.target.value)} required />
                      </div>
                      <div>
                        <label style={{ ...labelStyle, fontSize: 13 }}>Last Name <span style={{ color: NAVY }}>*</span></label>
                        <input style={{ ...inputStyle, fontSize: 13 }} value={att.last_name} onChange={(e) => updateAttendee(i, 'last_name', e.target.value)} required />
                      </div>
                    </div>
                    <div>
                      <label style={{ ...labelStyle, fontSize: 13 }}>Email Address <span style={{ color: NAVY }}>*</span></label>
                      <input style={{ ...inputStyle, fontSize: 13 }} type="email" value={att.email} onChange={(e) => updateAttendee(i, 'email', e.target.value)} required />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addAttendee}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', color: NAVY, background: NAVY_LIGHT,
                    border: `1px dashed ${NAVY_BORDER}`, transition: 'background 0.15s',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Attendee
                </button>
              </div>
            </div>

            {/* Submit */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', padding: '24px 28px' }}>
              {error && (
                <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 14, color: '#dc2626' }}>
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%', padding: '14px 20px',
                  background: submitting ? '#9ca3af' : NAVY,
                  color: '#fff', border: 'none', borderRadius: 10,
                  fontSize: 16, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'background 0.15s', letterSpacing: '0.03em',
                }}
              >
                {submitting && (
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.3)" strokeWidth="4"/>
                    <path fill="rgba(255,255,255,.9)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                )}
                {submitting ? 'Registering…' : 'Register Now'}
              </button>
              <p style={{ margin: '12px 0 0', fontSize: 12, color: '#9ca3af', textAlign: 'center' }}>
                By registering you agree to be contacted by Arcon Solutions regarding this event.
              </p>
            </div>
          </form>

          {/* ---- Sidebar ---- */}
          <div className="sidebar" style={{ position: 'sticky', top: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Event details card */}
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,.07)', overflow: 'hidden' }}>
              <div style={{ background: NAVY, padding: '14px 18px' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Event Details
                </p>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: NAVY }}>
                  {SHOWCASE_EVENT.date}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 14, color: '#475569' }}>
                  {SHOWCASE_EVENT.time}
                </p>
                <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  {SHOWCASE_EVENT.venue}
                </p>
                <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
                  {SHOWCASE_EVENT.address}
                </p>
                <a
                  href="https://maps.google.com/?q=Union+32+Craft+House+2864+Highway+55+Eagan+MN"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 13, color: NAVY, fontWeight: 600, textDecoration: 'none' }}
                >
                  Get Directions →
                </a>
                <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${NAVY_LIGHT}` }}>
                  <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>Come see this year&rsquo;s trending items.</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>Enjoy a meal and beverage on us!</p>
                </div>
              </div>
            </div>

            <AddToCalendarCard />

          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#9ca3af' }}>
          &copy; {new Date().getFullYear()} Arcon Solutions &middot;{' '}
          <a href="https://www.arconinc.com" style={{ color: '#9ca3af' }}>arconinc.com</a>
        </p>
      </div>
    </>
  )
}
