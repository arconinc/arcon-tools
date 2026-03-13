'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BirthdayEvent } from '@/types'

type BirthdayEventWithColor = BirthdayEvent & { color: string }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function sectionLabel(daysUntil: number): string {
  if (daysUntil < 0) return 'Recent'
  if (daysUntil === 0) return 'Today'
  if (daysUntil <= 6) return 'This Week'
  if (daysUntil <= 13) return 'Next Week'
  if (daysUntil <= 30) return 'This Month'
  return 'Upcoming'
}

function sectionOrder(daysUntil: number): number {
  if (daysUntil < 0) return -1
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
    fetch(`/api/dashboard/birthdays?date=${dateParam}&window=60&lookback=7`)
      .then((r) => r.json())
      .then((d) => {
        if (d.events) setEvents(d.events)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Sort: past events most-recent-first (-1 before -7), then today, then future ascending
  const sorted = [...events].sort((a, b) => {
    if (a.days_until < 0 && b.days_until < 0) return b.days_until - a.days_until
    return a.days_until - b.days_until
  })

  // Group events into sections
  const sections: { label: string; order: number; events: BirthdayEventWithColor[] }[] = []
  const seen = new Map<string, number>()
  for (const e of sorted) {
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
        .bday-date { font-size: 13px; font-weight: 700; color: #555; text-align: center; min-width: 52px; flex-shrink: 0; }
        .bday-badge { font-size: 10px; padding: 2px 8px; border-radius: 3px; font-weight: 700; white-space: nowrap; }
        .badge-today     { background: #f3e8ff; color: #6b1e98; }
        .badge-soon      { background: #f0fdf4; color: #15803d; }
        .badge-ann       { background: #fff7ed; color: #c2410c; }
        .badge-future    { background: #f5f5f5; color: #555; }
        .badge-past      { background: #f5f5f5; color: #999; }
        .badge-milestone { background: #fef3c7; color: #92400e; }
        .badge-legend    { background: #fde68a; color: #78350f; }
        .badge-hof       { background: #ede9fe; color: #5b21b6; }
        .bday-row.milestone-5  { background: #fffbeb; border-left: 3px solid #f59e0b; padding-left: 13px; }
        .bday-row.milestone-10 { background: #fef3c7; border-left: 3px solid #d97706; padding-left: 13px; }
        .bday-row.milestone-15 { background: #faf5ff; border-left: 3px solid #7c3aed; padding-left: 13px; }
        .bday-row.milestone-5  .bday-date { color: #92400e; }
        .bday-row.milestone-10 .bday-date { color: #78350f; }
        .bday-row.milestone-15 .bday-date { color: #6b21a8; }
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
          <div className="bday-empty">No birthdays or anniversaries in the next 2 months.</div>
        ) : (
          [...sections].sort((a, b) => a.order - b.order).map((section) => (
            <div key={section.label}>
              <div className="bday-section-label">{section.label}</div>
              <div className="bday-card">
                {section.events.map((b) => {
                  const isBday = b.type === 'birthday'
                  const sub = isBday ? 'Birthday' : `${b.years}yr Anniversary`
                  const absDays = Math.abs(b.days_until)
                  const badgeText = b.days_until === 0 ? 'Today!' : b.days_until === 1 ? 'Tomorrow' : b.days_until < 0 ? `${absDays} day${absDays === 1 ? '' : 's'} ago` : `${b.days_until} days`
                  const tier = !isBday && b.years ? (b.years >= 15 ? 'hof' : b.years >= 10 ? 'legend' : b.years >= 5 ? 'milestone' : 'standard') : 'standard'
                  const milestoneClass = tier === 'hof' ? 'milestone-15' : tier === 'legend' ? 'milestone-10' : tier === 'milestone' ? 'milestone-5' : ''
                  const badgeClass = b.days_until === 0 ? 'badge-today' : b.days_until < 0 ? 'badge-past' : isBday ? (b.days_until <= 13 ? 'badge-soon' : 'badge-future') : tier === 'hof' ? 'badge-hof' : tier === 'legend' ? 'badge-legend' : tier === 'milestone' ? 'badge-milestone' : b.days_until <= 13 ? 'badge-ann' : 'badge-future'
                  const annIcon = tier === 'hof' ? '👑' : tier === 'legend' ? '🏆' : tier === 'milestone' ? '⭐' : '🥂'
                  return (
                    <div key={b.id} className={`bday-row${milestoneClass ? ` ${milestoneClass}` : ''}`}>
                      <div className="bday-av">{isBday ? '🎂' : annIcon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="bday-name">{b.name}</div>
                        <div className="bday-sub">{sub}</div>
                      </div>
                      <div className="bday-date">{b.date_label}</div>
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
