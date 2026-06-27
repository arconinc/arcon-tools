import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  COMPANY_CALENDAR_EVENT_TYPES,
  getCalendarCacheSeconds,
  getCalendarLookaheadDays,
} from '@/lib/company-calendar-config'
import { fetchCompanyCalendarEvents } from '@/lib/google-calendar'
import { CompanyCalendarEvent, CompanyCalendarResponse } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_SECONDS = getCalendarCacheSeconds()

const getCachedCalendarEvents = unstable_cache(
  async (timeMin: string, timeMax: string) => {
    return fetchCompanyCalendarEvents(timeMin, timeMax)
  },
  ['company-calendar-events-v1'],
  { revalidate: CACHE_SECONDS }
)

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { timeMin, timeMax } = getCalendarWindow()
    const [googleEvents, dbBirthdays, dbAnniversaries, dbPto] = await Promise.all([
      getCachedCalendarEvents(timeMin, timeMax),
      fetchDbBirthdayEvents(timeMin, timeMax),
      fetchDbAnniversaryEvents(timeMin, timeMax),
      fetchDbPtoEvents(timeMin, timeMax),
    ])
    const response: CompanyCalendarResponse = {
      eventTypes: COMPANY_CALENDAR_EVENT_TYPES,
      events: [...googleEvents, ...dbBirthdays, ...dbAnniversaries, ...dbPto],
      cachedAt: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[dashboard/events] Google Calendar load failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load calendar events' },
      { status: 500 }
    )
  }
}

async function fetchDbBirthdayEvents(timeMin: string, timeMax: string): Promise<CompanyCalendarEvent[]> {
  const adminClient = createAdminClient()
  const { data: users } = await adminClient
    .from('users')
    .select('id, display_name, birth_date')
    .not('birth_date', 'is', null)
    .is('deactivated_at', null)

  if (!users) return []

  const events: CompanyCalendarEvent[] = []
  const windowStart = timeMin.slice(0, 10)
  const windowEnd = timeMax.slice(0, 10)
  const currentYear = new Date().getFullYear()

  for (const user of users) {
    if (!user.birth_date || !user.display_name) continue
    const [month, day] = user.birth_date.split('-')
    for (const year of [currentYear, currentYear + 1]) {
      const date = `${year}-${month}-${day}`
      if (date >= windowStart && date < windowEnd) {
        events.push({
          id: `db-bday-${user.id}-${year}`,
          title: `🎂 ${formatPossessive(user.display_name)} Birthday`,
          type: 'birthday',
          typeLabel: 'Birthdays',
          start: date,
          end: null,
          allDay: true,
          description: null,
          location: null,
          htmlLink: null,
          googleColorId: '3',
        })
      }
    }
  }

  return events
}

async function fetchDbAnniversaryEvents(timeMin: string, timeMax: string): Promise<CompanyCalendarEvent[]> {
  const adminClient = createAdminClient()
  const { data: users } = await adminClient
    .from('users')
    .select('id, display_name, start_date')
    .not('start_date', 'is', null)
    .is('deactivated_at', null)

  if (!users) return []

  const events: CompanyCalendarEvent[] = []
  const windowStart = timeMin.slice(0, 10)
  const windowEnd = timeMax.slice(0, 10)
  const currentYear = new Date().getFullYear()

  for (const user of users) {
    if (!user.start_date || !user.display_name) continue
    const hireYear = parseInt(user.start_date.slice(0, 4), 10)
    const monthDay = user.start_date.slice(5) // MM-DD
    for (const year of [currentYear, currentYear + 1]) {
      if (year <= hireYear) continue // no anniversary before or on hire year
      const date = `${year}-${monthDay}`
      if (date >= windowStart && date < windowEnd) {
        const yearsCount = year - hireYear
        events.push({
          id: `db-anniversary-${user.id}-${year}`,
          title: `🎉 ${user.display_name} (${yearsCount}yr)`,
          type: 'anniversary',
          typeLabel: 'Anniversaries',
          start: date,
          end: null,
          allDay: true,
          description: null,
          location: null,
          htmlLink: null,
          googleColorId: '6',
        })
      }
    }
  }

  return events
}

async function fetchDbPtoEvents(timeMin: string, timeMax: string): Promise<CompanyCalendarEvent[]> {
  const adminClient = createAdminClient()
  const windowStart = timeMin.slice(0, 10)
  const windowEnd = timeMax.slice(0, 10)

  const { data: rows } = await adminClient
    .from('pto_requests')
    .select('id, user_id, start_date, end_date, start_half_day, end_half_day, users!user_id(display_name)')
    .eq('status', 'approved')
    .lte('start_date', windowEnd)
    .gte('end_date', windowStart)

  if (!rows) return []

  return rows.map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const displayName = (row.users as any)?.display_name ?? 'Employee'
    const halfDay = row.start_half_day || row.end_half_day
    const title = `${displayName} (PTO${halfDay ? ' ½' : ''})`

    // FullCalendar all-day end is exclusive — add 1 day
    const endDate = new Date(row.end_date)
    endDate.setDate(endDate.getDate() + 1)
    const endDateStr = endDate.toISOString().slice(0, 10)

    return {
      id: `pto-${row.id}`,
      title,
      type: 'pto' as const,
      typeLabel: 'Time Off',
      start: row.start_date,
      end: endDateStr,
      allDay: true,
      description: null,
      location: null,
      htmlLink: null,
      googleColorId: null,
    }
  })
}

function getCalendarWindow() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + getCalendarLookaheadDays())

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  }
}

function formatPossessive(name: string) {
  return name.endsWith('s') ? `${name}'` : `${name}'s`
}
