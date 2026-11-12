import { fail, ok } from '@/lib/api/respond'
import { runSyncBatch } from '@/lib/hat-catalog/sync'
import { cronAuthorized } from '@/lib/hat-mockup/guard'

export const runtime = 'nodejs'
// One batch is at most 40 paced requests (~5-7s apart). If the Vercel plan's
// function limit is lower than this, lower REQUESTS_PER_RUN, not the delay.
export const maxDuration = 300

// GET /api/cron/hat-catalog-sync — Vercel cron, nightly window only (see vercel.json)
export async function GET(request: Request) {
  if (!cronAuthorized(request)) return fail(401, 'Unauthorized')
  return ok(await runSyncBatch('cron'))
}
