import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCalendarCacheSeconds } from '@/lib/company-calendar-config'
import { fetchCompanyCalendarEvents } from '@/lib/google-calendar'
import { CalendarCountdownEvent } from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_SECONDS = getCalendarCacheSeconds()
const LOOKAHEAD_DAYS = 365

const getCachedEvents = unstable_cache(
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
    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000).toISOString()

    const allEvents = await getCachedEvents(timeMin, timeMax)

    const countdownEvents: CalendarCountdownEvent[] = allEvents
      .filter(e => e.description && /countdown/i.test(e.description))
      .filter(e => new Date(e.start) > now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .map(e => ({ id: e.id, title: e.title, start: e.start }))

    return NextResponse.json({ events: countdownEvents })
  } catch (error) {
    console.error('[countdown] Calendar fetch failed:', error)
    return NextResponse.json({ events: [] })
  }
}
