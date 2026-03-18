/**
 * Shared utilities for the banner strip (ticker) aggregation.
 * Provides helpers for birthdays, anniversaries, and the US holiday calendar.
 */

import { BannerStripItem, TickerConfig, TickerManualItem } from '@/types'

// ── Date helpers ───────────────────────────────────────────────────────────────

export function todayMidnight(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Returns days until the next occurrence of month/day (0 = today). */
export function daysUntilNextOccurrence(month: number, day: number, today: Date): number {
  const thisYear = today.getFullYear()
  const thisOccurrence = new Date(thisYear, month - 1, day)
  const diff = Math.floor((thisOccurrence.getTime() - today.getTime()) / 86400000)
  if (diff >= 0) return diff
  const nextOccurrence = new Date(thisYear + 1, month - 1, day)
  return Math.floor((nextOccurrence.getTime() - today.getTime()) / 86400000)
}

// ── US Holidays ────────────────────────────────────────────────────────────────

interface Holiday {
  month: number
  day: number
  name: string
  emoji: string
}

const US_HOLIDAYS: Holiday[] = [
  { month: 1,  day: 1,  name: "New Year's Day",          emoji: '🎆' },
  { month: 1,  day: 20, name: 'Martin Luther King Jr. Day', emoji: '✊' },
  { month: 2,  day: 14, name: "Valentine's Day",          emoji: '❤️' },
  { month: 2,  day: 17, name: "Presidents' Day",          emoji: '🇺🇸' },
  { month: 3,  day: 17, name: "St. Patrick's Day",        emoji: '🍀' },
  { month: 4,  day: 1,  name: "April Fools' Day",         emoji: '🃏' },
  { month: 5,  day: 26, name: 'Memorial Day',             emoji: '🎗️' },
  { month: 6,  day: 19, name: 'Juneteenth',               emoji: '✊' },
  { month: 6,  day: 20, name: "Father's Day",             emoji: '👨‍👧' },
  { month: 7,  day: 4,  name: 'Independence Day',         emoji: '🇺🇸' },
  { month: 9,  day: 1,  name: 'Labor Day',                emoji: '🛠️' },
  { month: 10, day: 31, name: 'Halloween',                 emoji: '🎃' },
  { month: 11, day: 11, name: 'Veterans Day',             emoji: '🎖️' },
  { month: 11, day: 27, name: 'Thanksgiving',             emoji: '🦃' },
  { month: 12, day: 24, name: 'Christmas Eve',            emoji: '🎄' },
  { month: 12, day: 25, name: 'Christmas',                emoji: '🎄' },
  { month: 12, day: 31, name: "New Year's Eve",           emoji: '🥂' },
]

export function getHolidayItems(today: Date, lookaheadDays: number): BannerStripItem[] {
  return US_HOLIDAYS
    .map((h) => {
      const daysUntil = daysUntilNextOccurrence(h.month, h.day, today)
      return { holiday: h, daysUntil }
    })
    .filter(({ daysUntil }) => daysUntil <= lookaheadDays)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map(({ holiday, daysUntil }) => ({
      id: `holiday-${holiday.month}-${holiday.day}`,
      label: 'Holiday',
      text: daysUntil === 0
        ? `${holiday.emoji} Happy ${holiday.name}!`
        : `${holiday.emoji} ${holiday.name} is ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`,
      href: null,
      source: 'holiday' as const,
    }))
}

// ── Birthday / Anniversary items ───────────────────────────────────────────────

interface UserRow {
  id: string
  display_name: string | null
  birth_date: string | null
  start_date: string | null
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

export function getBirthdayItems(users: UserRow[], today: Date, windowDays: number): BannerStripItem[] {
  const items: BannerStripItem[] = []
  for (const u of users) {
    if (!u.birth_date) continue
    const name = u.display_name || 'Unknown'
    const parts = u.birth_date.split('-').map(Number)
    // birth_date stored as MM-DD (no year); fall back to YYYY-MM-DD for old data
    const [month, day] = parts.length === 2 ? parts : [parts[1], parts[2]]
    if (!month || !day) continue
    const daysUntil = daysUntilNextOccurrence(month, day, today)
    if (daysUntil > windowDays) continue
    const text = daysUntil === 0
      ? `🎂 Happy Birthday ${name}!`
      : `🎂 ${name}'s birthday is ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`
    items.push({ id: `${u.id}-bday`, label: 'Birthday', text, href: null, source: 'birthday' })
  }
  return items.sort((a, b) => {
    // stable sort by days_until is baked into text; sort by name as tiebreaker
    return a.text.localeCompare(b.text)
  })
}

export function getAnniversaryItems(users: UserRow[], today: Date, windowDays: number): BannerStripItem[] {
  const items: BannerStripItem[] = []
  for (const u of users) {
    if (!u.start_date) continue
    const name = u.display_name || 'Unknown'
    const [startYear, month, day] = u.start_date.split('-').map(Number)
    if (!month || !day || !startYear) continue
    const daysUntil = daysUntilNextOccurrence(month, day, today)
    if (daysUntil > windowDays) continue
    const yearOffset = daysUntil < 365 ? 0 : 1
    const years = today.getFullYear() + yearOffset - startYear
    if (years <= 0) continue
    const text = daysUntil === 0
      ? `🥂 Congrats ${name} — ${years} Year${years !== 1 ? 's' : ''}!`
      : `🥂 ${name}'s ${years}-year anniversary is ${daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`}`
    void getInitials(name) // keep import used
    items.push({ id: `${u.id}-ann`, label: 'Anniversary', text, href: null, source: 'anniversary' })
  }
  return items
}

// ── Manual items filter ────────────────────────────────────────────────────────

export function getActiveManualItems(items: TickerManualItem[], today: Date): BannerStripItem[] {
  const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD
  return items
    .filter((item) => {
      if (!item.enabled) return false
      if (item.active_from && item.active_from > todayStr) return false
      if (item.active_until && item.active_until < todayStr) return false
      return true
    })
    .map((item) => ({
      id: item.id,
      label: item.label,
      text: item.text,
      href: item.href,
      source: 'manual' as const,
    }))
}

// ── Article label mapper ───────────────────────────────────────────────────────

export function articleTypeLabel(type: string): string {
  const map: Record<string, string> = {
    COMPANY: 'Company',
    HR: 'HR',
    SALES: 'Sales',
    IT: 'IT',
    FINANCE: 'Finance',
    OPERATIONS: 'Operations',
    GENERAL: 'News',
  }
  return map[type] ?? 'News'
}

// Re-export TickerConfig so aggregation callers don't need a separate import
export type { TickerConfig }
