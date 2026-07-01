import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, serverError, ok } from '@/lib/api/respond'
import { isMarketingCalendarEditor } from '@/lib/marketing/calendar-access'

type Params = { params: Promise<{ id: string }> }

// DELETE /api/marketing/calendar-events/[id] — marketing_calendar_editors group only
export async function DELETE(_req: Request, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  if (!(await isMarketingCalendarEditor(adminClient, appUser.id, appUser.is_admin))) return forbidden()

  const { id } = await params
  const { error } = await adminClient.from('marketing_calendar_events').delete().eq('id', id)
  if (error) return serverError(error.message)
  return ok({ ok: true })
}
