'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BirthdayEvent } from '@/types'

type BirthdayEventWithColor = BirthdayEvent & { color: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function sectionLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today'
  if (daysUntil <= 6) return 'This Week'
  if (daysUntil <= 13) return 'Next Week'
  if (daysUntil <= 30) return 'This Month'
  return 'Upcoming'
}

function sectionOrder(daysUntil: number): number {
  if (daysUntil === 0) return 0
  if (daysUntil <= 6) return 1
  if (daysUntil <= 13) return 2
  if (daysUntil <= 30) return 3
  return 4
}

export default function BirthdaysPage() {
  const [events, setEvents] = useState<BirthdayEventWithColor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const localDate = new Date()
    const dateParam = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`
    fetch(`/api/dashboard/birthdays?date=${dateParam}&window=365`)
      .then((r) => r.json())
      .then((d) => {
        if (d.events) setEvents(d.events)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Group events into sections
  const sections: { label: string; order: number; events: BirthdayEventWithColor[] }[] = []
  const seen = new Map<string, number>()
  for (const e of events) {
    const label = sectionLabel(e.days_until)
    const order = sectionOrder(e.days_until)
    if (!seen.has(label)) {
      seen.set(label, sections.length)
      sections.push({ label, order, events: [] })
    }
    sections[seen.get(label)!].events.push(e)
  }

  return (
    <>
      <style>{`
        .bday-page { padding: 28px 32px; max-width: 760px; margin: 0 auto; }
        .bday-page-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; }
        .bday-back { font-size: 12px; color: #6b1e98; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
        .bday-back:hover { text-decoration: underline; }
        .bday-page-title { font-size: 20px; font-weight: 800; color: #111; }
        .bday-section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #999; margin: 22px 0 8px; }
        .bday-section-label:first-child { margin-top: 0; }
        .bday-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
        .bday-row { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid #f3f4f6; }
        .bday-row:last-child { border-bottom: none; }
        .bday-av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .bday-name { font-size: 13px; font-weight: 600; color: #111; }
        .bday-sub { font-size: 11px; color: #999; margin-top: 1px; }
        .bday-badge { font-size: 10px; padding: 2px 8px; border-radius: 3px; font-weight: 700; white-space: nowrap; margin-left: auto; }
        .badge-today  { background: #f3e8ff; color: #6b1e98; }
        .badge-soon   { background: #f0fdf4; color: #15803d; }
        .badge-ann    { background: #fff7ed; color: #c2410c; }
        .badge-future { background: #f5f5f5; color: #555; }
        .bday-empty { font-size: 13px; color: #bbb; padding: 32px; text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; }
      `}</style>

      <div className="bday-page">
        <div className="bday-page-header">
          <Link href="/dashboard" className="bday-back">← Dashboard</Link>
          <div style={{ width: 1, height: 16, background: '#e5e7eb' }} />
          <div className="bday-page-title">Birthdays &amp; Anniversaries</div>
        </div>

        {loading ? (
          <div className="bday-empty">Loading…</div>
        ) : events.length === 0 ? (
          <div className="bday-empty">No upcoming birthdays or anniversaries in the next year.</div>
        ) : (
          sections.map((section) => (
            <div key={section.label}>
              <div className="bday-section-label">{section.label}</div>
              <div className="bday-card">
                {section.events.map((b) => {
                  const isBday = b.type === 'birthday'
                  const sub = isBday
                    ? `🎂 Birthday · ${b.date_label}`
                    : `🥂 ${b.years}yr Anniversary · ${b.date_label}`
                  const badgeText = b.days_until === 0 ? 'Today!' : b.days_until === 1 ? 'Tomorrow' : `${b.days_until} days`
                  const badgeClass = b.days_until === 0 ? 'badge-today' : b.days_until <= 13 ? (isBday ? 'badge-soon' : 'badge-ann') : 'badge-future'
                  return (
                    <div key={b.id} className="bday-row">
                      <div className="bday-av">{isBday ? '🎂' : '🥂'}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bday-name">{b.name}</div>
                        <div className="bday-sub">{sub}</div>
                      </div>
                      <span className={`bday-badge ${badgeClass}`}>{badgeText}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
