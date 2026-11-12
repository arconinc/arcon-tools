import { ok } from '@/lib/api/respond'
import { runSyncBatch } from '@/lib/hat-catalog/sync'
import { requireAdmin } from '@/lib/hat-mockup/admin-guard'

export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/admin/hat-catalog/sync → one budgeted batch (same pacing and limits as the nightly cron)
export async function POST() {
  const guard = await requireAdmin()
  if (guard.res) return guard.res
  return ok(await runSyncBatch('manual'))
}
