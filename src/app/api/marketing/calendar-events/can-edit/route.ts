import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, ok } from '@/lib/api/respond'
import { isMarketingCalendarEditor } from '@/lib/marketing/calendar-access'

// GET /api/marketing/calendar-events/can-edit — lets the client know whether
// to show the "Add Event" button, without exposing group membership another way.
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  const canEdit = await isMarketingCalendarEditor(adminClient, appUser.id, appUser.is_admin)
  return ok({ canEdit })
}
