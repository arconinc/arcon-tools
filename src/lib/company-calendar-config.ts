import {
  CompanyCalendarEvent,
  CompanyCalendarEventType,
  CompanyCalendarEventTypeId,
} from '@/types'

export const DEFAULT_COMPANY_CALENDAR_ID =
  'c_e43e09286b3370fa643da4911f061fad752b339083148635e3c4e53396b98897@group.calendar.google.com'

export const COMPANY_CALENDAR_EVENT_TYPES: CompanyCalendarEventType[] = [
  {
    id: 'birthday',
    label: 'Birthdays',
    color: '#7c3aed',
    accentColor: '#ede9fe',
    googleColorIds: ['3'],
    titlePrefixes: ['[Birthday]', 'Birthday:'],
  },
  {
    id: 'anniversary',
    label: 'Anniversaries',
    color: '#c2410c',
    accentColor: '#ffedd5',
    googleColorIds: ['6'],
    titlePrefixes: ['[Anniversary]', 'Anniversary:'],
  },
  {
    id: 'company',
    label: 'Company Events',
    color: '#1d4ed8',
    accentColor: '#dbeafe',
    googleColorIds: ['7'],
    titlePrefixes: ['[Company]', 'Company:'],
  },
  {
    id: 'pto',
    label: 'Time Off',
    color: '#db2777',
    accentColor: '#fce7f3',
    googleColorIds: [],
    titlePrefixes: ['[PTO]', 'PTO:'],
  },
  {
    id: 'vendor_demo',
    label: 'Vendor Demos',
    color: '#ea580c',
    accentColor: '#ffedd5',
    googleColorIds: [],
    titlePrefixes: [],
  },
]

export function getCompanyCalendarId() {
  return process.env.GOOGLE_CALENDAR_ID || DEFAULT_COMPANY_CALENDAR_ID
}

export function getCalendarLookaheadDays() {
  const parsed = Number.parseInt(process.env.GOOGLE_CALENDAR_LOOKAHEAD_DAYS ?? '180', 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 30), 365) : 180
}

export function getCalendarCacheSeconds() {
  const parsed = Number.parseInt(process.env.GOOGLE_CALENDAR_CACHE_SECONDS ?? '900', 10)
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 60), 3600) : 900
}

export function getEventTypeById(typeId: CompanyCalendarEventTypeId) {
  return COMPANY_CALENDAR_EVENT_TYPES.find((type) => type.id === typeId) ?? COMPANY_CALENDAR_EVENT_TYPES[2]
}

export function classifyCalendarEvent(colorId: string | null, title: string): CompanyCalendarEventType {
  const colorMatch = COMPANY_CALENDAR_EVENT_TYPES.find((type) =>
    colorId ? type.googleColorIds.includes(colorId) : false
  )
  if (colorMatch) return colorMatch

  const trimmedTitle = title.trim().toLowerCase()
  const prefixMatch = COMPANY_CALENDAR_EVENT_TYPES.find((type) =>
    type.titlePrefixes.some((prefix) => trimmedTitle.startsWith(prefix.toLowerCase()))
  )
  if (prefixMatch) return prefixMatch

  if (/\bbirthdays?\b/.test(trimmedTitle)) return getEventTypeById('birthday')
  if (/\banniversar(y|ies)\b/.test(trimmedTitle)) return getEventTypeById('anniversary')

  return getEventTypeById('company')
}

export function stripTypePrefix(title: string, type: CompanyCalendarEventType) {
  const matchedPrefix = type.titlePrefixes.find((prefix) =>
    title.trim().toLowerCase().startsWith(prefix.toLowerCase())
  )
  return matchedPrefix ? title.trim().slice(matchedPrefix.length).trim() : title
}

export function countEventsThisWeek(events: CompanyCalendarEvent[]) {
  const now = new Date()
  const weekEnd = new Date(now)
  weekEnd.setDate(now.getDate() + 7)

  return events.filter((event) => {
    const start = new Date(event.allDay ? `${event.start}T00:00:00` : event.start)
    return start >= startOfLocalDay(now) && start < weekEnd
  }).length
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
