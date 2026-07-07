'use client'

import { useState } from 'react'
import { VendorDemoSlot } from '@/types'

interface VendorSlotModalProps {
  onClose: () => void
  onSaved: (slot: VendorDemoSlot) => void
  initialDate?: string
}

export default function VendorSlotModal({ onClose, onSaved, initialDate }: VendorSlotModalProps) {
  const [date, setDate] = useState(initialDate ?? '')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !startTime || !endTime) {
      setError('Date, start time, and end time are required')
      return
    }
    const start = new Date(`${date}T${startTime}`)
    const end = new Date(`${date}T${endTime}`)
    if (end <= start) {
      setError('End time must be after start time')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/marketing/vendor-relations/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_time: start.toISOString(), end_time: end.toISOString() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create time slot')
      onSaved(data as VendorDemoSlot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create time slot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <div className="cal-modal-title">Add Vendor Demo Time Slot</div>
          <button type="button" className="cal-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="cal-modal-body">
          <label className="cal-modal-field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <div className="cal-modal-row">
            <label className="cal-modal-field">
              <span>Start Time</span>
              <input type="time" step={900} value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
            </label>
            <label className="cal-modal-field">
              <span>End Time</span>
              <input type="time" step={900} value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
            </label>
          </div>
          {error && <div className="cal-modal-error">{error}</div>}
          <div className="cal-modal-actions">
            <button type="button" className="cal-modal-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="cal-modal-save" disabled={saving}>{saving ? 'Saving…' : 'Save Time Slot'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
