'use client'

import { useState } from 'react'
import { MarketingCalendarEvent, MarketingCalendarPlatform } from '@/types'
import { SocialIcon } from '@/components/ui'

const PLATFORM_OPTIONS: { value: MarketingCalendarPlatform; label: string }[] = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'mailchimp', label: 'MailChimp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
]

interface CalendarEventModalProps {
  onClose: () => void
  onSaved: (event: MarketingCalendarEvent) => void
  initialDate?: string
}

export default function CalendarEventModal({ onClose, onSaved, initialDate }: CalendarEventModalProps) {
  const [title, setTitle] = useState('')
  const [eventDate, setEventDate] = useState(initialDate ?? '')
  const [eventTime, setEventTime] = useState('')
  const [platforms, setPlatforms] = useState<MarketingCalendarPlatform[]>([])
  const [artFile, setArtFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePlatform(value: MarketingCalendarPlatform) {
    setPlatforms((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !eventDate) {
      setError('Title and date are required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let artUrl: string | null = null
      if (artFile) {
        const formData = new FormData()
        formData.append('file', artFile)
        const uploadRes = await fetch('/api/marketing/calendar-events/upload', { method: 'POST', body: formData })
        const uploadData = await uploadRes.json()
        if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Failed to upload art')
        artUrl = uploadData.url
      }

      const res = await fetch('/api/marketing/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          event_date: eventDate,
          event_time: eventTime || null,
          platforms,
          art_url: artUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create event')
      onSaved(data as MarketingCalendarEvent)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="cal-modal-overlay" onClick={onClose}>
      <div className="cal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cal-modal-header">
          <div className="cal-modal-title">Add Marketing Event</div>
          <button type="button" className="cal-modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit} className="cal-modal-body">
          <label className="cal-modal-field">
            <span>Title</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <div className="cal-modal-row">
            <label className="cal-modal-field">
              <span>Date</span>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
            </label>
            <label className="cal-modal-field">
              <span>Time (optional)</span>
              <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} />
            </label>
          </div>
          <div className="cal-modal-field">
            <span>Platforms</span>
            <div className="cal-modal-platforms">
              {PLATFORM_OPTIONS.map((opt) => (
                <label key={opt.value} className={`cal-modal-platform ${platforms.includes(opt.value) ? 'active' : ''}`}>
                  <input
                    type="checkbox"
                    checked={platforms.includes(opt.value)}
                    onChange={() => togglePlatform(opt.value)}
                  />
                  <SocialIcon name={opt.value} />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <label className="cal-modal-field">
            <span>Art (optional)</span>
            <input type="file" accept="image/*" onChange={(e) => setArtFile(e.target.files?.[0] ?? null)} />
          </label>
          {error && <div className="cal-modal-error">{error}</div>}
          <div className="cal-modal-actions">
            <button type="button" className="cal-modal-cancel" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="cal-modal-save" disabled={saving}>{saving ? 'Saving…' : 'Save Event'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
