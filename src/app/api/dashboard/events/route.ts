import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  COMPANY_CALENDAR_EVENT_TYPES,
  getCalendarCacheSeconds,
  getCalendarLookaheadDays,
} from '@/lib/company-calendar-config'
import { fetchCompanyCalendarEvents } from '@/lib/google-calendar'
import { CompanyCalendarResponse } from '@/types'

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
    const events = await getCachedCalendarEvents(timeMin, timeMax)
    const response: CompanyCalendarResponse = {
      eventTypes: COMPANY_CALENDAR_EVENT_TYPES,
      events,
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
