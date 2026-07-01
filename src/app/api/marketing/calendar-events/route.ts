import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, forbidden, serverError, created, ok } from '@/lib/api/respond'
import { isMarketingCalendarEditor } from '@/lib/marketing/calendar-access'
import { MarketingCalendarPlatform } from '@/types'

const VALID_PLATFORMS: MarketingCalendarPlatform[] = ['linkedin', 'mailchimp', 'instagram', 'facebook']

// GET /api/marketing/calendar-events — everyone can view
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('marketing_calendar_events')
    .select('*')
    .order('event_date', { ascending: true })

  if (error) return serverError(error.message)
  return ok({ items: data ?? [] })
}

// POST /api/marketing/calendar-events — marketing_calendar_editors group only
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  if (!(await isMarketingCalendarEditor(adminClient, appUser.id, appUser.is_admin))) return forbidden()

  const body = await req.json()
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const eventDate = typeof body.event_date === 'string' ? body.event_date : ''
  const eventTime = typeof body.event_time === 'string' && body.event_time !== '' ? body.event_time : null
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter((p: unknown): p is MarketingCalendarPlatform => VALID_PLATFORMS.includes(p as MarketingCalendarPlatform))
    : []
  const artUrl = typeof body.art_url === 'string' && body.art_url !== '' ? body.art_url : null

  if (!title) return badRequest('Title is required')
  if (!eventDate) return badRequest('Date is required')

  const { data, error } = await adminClient
    .from('marketing_calendar_events')
    .insert({
      title,
      event_date: eventDate,
      event_time: eventTime,
      platforms,
      art_url: artUrl,
      created_by: appUser.id,
    })
    .select()
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
