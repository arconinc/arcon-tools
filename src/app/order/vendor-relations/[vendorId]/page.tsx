'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Vendor = { id: string; name: string; phone: string | null; website: string | null }
type Slot = { id: string; start_time: string; end_time: string }

function formatSlot(slot: Slot) {
  const start = new Date(slot.start_time)
  const end = new Date(slot.end_time)
  const dateLabel = start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const startLabel = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const endLabel = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateLabel} · ${startLabel} – ${endLabel}`
}

export default function VendorRelationsSignupPage() {
  const params = useParams<{ vendorId: string }>()
  const vendorId = params.vendorId

  const [loading, setLoading] = useState(true)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [slots, setSlots] = useState<Slot[]>([])
  const [notFound, setNotFound] = useState(false)
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function loadVendor() {
    setLoading(true)
    setErrorMsg('')
    try {
      const res = await fetch(`/api/public/vendor-relations/${vendorId}`)
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setVendor(data.vendor)
      setSlots(data.slots ?? [])
    } catch {
      setErrorMsg('Something went wrong loading this page. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (vendorId) loadVendor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedSlotId) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const res = await fetch('/api/public/vendor-relations/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendor_id: vendorId, slot_id: selectedSlotId, notes }),
      })
      if (res.status === 409) {
        const data = await res.json()
        setErrorMsg(data.error)
        setSelectedSlotId('')
        await loadVendor()
        return
      }
      if (!res.ok) throw new Error('Failed to submit')
      setSubmitted(true)
    } catch {
      setErrorMsg('Something went wrong submitting your request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="vr-page">
      <style>{`
        .vr-page { min-height: 100vh; background: #f7f4fb; display: flex; align-items: flex-start; justify-content: center; padding: 32px 16px; box-sizing: border-box; }
        .vr-card { width: 100%; max-width: 560px; background: #fff; border-radius: 16px; box-shadow: 0 1px 8px rgba(0,0,0,.08); overflow: hidden; }
        .vr-header { background: #6b1e98; padding: 24px 28px; }
        .vr-eyebrow { margin: 0 0 4px; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #e9d5ff; }
        .vr-title { margin: 0; font-size: 22px; font-weight: 800; color: #fff; }
        .vr-body { padding: 24px 28px; }
        .vr-vendor-box { background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
        .vr-vendor-name { margin: 0 0 4px; font-size: 16px; font-weight: 800; color: #111; }
        .vr-vendor-meta { margin: 0; font-size: 13px; color: #555; }
        .vr-section-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin: 0 0 10px; }
        .vr-slot { display: flex; align-items: center; gap: 10px; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px; margin-bottom: 8px; cursor: pointer; font-size: 14px; }
        .vr-slot.selected { border-color: #6b1e98; background: #faf5ff; }
        .vr-textarea { width: 100%; box-sizing: border-box; border: 1px solid #d1d5db; border-radius: 10px; padding: 10px 12px; font-size: 14px; font-family: inherit; resize: vertical; min-height: 90px; margin-top: 6px; }
        .vr-submit { width: 100%; background: #6b1e98; color: #fff; border: none; border-radius: 10px; padding: 12px 16px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 20px; }
        .vr-submit:disabled { opacity: 0.5; cursor: not-allowed; }
        .vr-error { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-bottom: 16px; }
        .vr-empty { color: #6b7280; font-size: 14px; }
      `}</style>
      <div className="vr-card">
        <div className="vr-header">
          <p className="vr-eyebrow">Arcon Vendor Relations</p>
          <h1 className="vr-title">Schedule Your Product Demo</h1>
        </div>
        <div className="vr-body">
          {loading && <p className="vr-empty">Loading…</p>}

          {!loading && notFound && (
            <p>We couldn&apos;t find this vendor invitation. Please contact Ella.</p>
          )}

          {!loading && !notFound && submitted && (
            <p>Thanks! Your demo time slot is booked. We&apos;ll be in touch with any additional details.</p>
          )}

          {!loading && !notFound && !submitted && vendor && (
            <form onSubmit={handleSubmit}>
              <div className="vr-vendor-box">
                <p className="vr-vendor-name">{vendor.name}</p>
                {vendor.phone && <p className="vr-vendor-meta">{vendor.phone}</p>}
                {vendor.website && <p className="vr-vendor-meta">{vendor.website}</p>}
              </div>

              {errorMsg && <div className="vr-error">{errorMsg}</div>}

              <p className="vr-section-label">Choose a Time Slot</p>
              {slots.length === 0 && <p className="vr-empty">No open time slots right now — please contact Ella.</p>}
              {slots.map((slot) => (
                <label key={slot.id} className={`vr-slot${selectedSlotId === slot.id ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="slot"
                    value={slot.id}
                    checked={selectedSlotId === slot.id}
                    onChange={() => setSelectedSlotId(slot.id)}
                  />
                  {formatSlot(slot)}
                </label>
              ))}

              <p className="vr-section-label" style={{ marginTop: 20 }}>Notes (optional)</p>
              <textarea
                className="vr-textarea"
                placeholder="Anything we should know about your visit?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />

              <button type="submit" className="vr-submit" disabled={!selectedSlotId || submitting}>
                {submitting ? 'Submitting…' : 'Book This Time Slot'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
