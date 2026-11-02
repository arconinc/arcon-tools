import * as Sentry from '@sentry/nextjs'
import { fail, ok, serverError } from '@/lib/api/respond'
import { createAdminClient } from '@/lib/supabase/admin'
import { cronAuthorized } from '@/lib/hat-mockup/guard'
import { learnStarters } from '@/lib/hat-mockup/starters'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/cron/hat-mockup-starters — nightly: learn starter prompts from saved sessions
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail(401, 'Unauthorized')
  try {
    return ok(await learnStarters(createAdminClient()))
  } catch (err) {
    Sentry.captureException(err)
    return serverError('Could not learn starter prompts')
  }
}
