import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, forbidden, serverError, ok } from '@/lib/api/respond'
import { isVendorRelationsManager } from '@/lib/marketing/vendor-relations-access'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/marketing/vendor-relations/slots/[id] — reschedule an open slot
export async function PATCH(req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  if (!(await isVendorRelationsManager(adminClient, appUser.id, appUser.is_admin))) return forbidden()

  const { id } = await params
  const body = await req.json()
  const startTime = typeof body.start_time === 'string' ? body.start_time : ''
  const endTime = typeof body.end_time === 'string' ? body.end_time : ''

  if (!startTime) return badRequest('Start time is required')
  if (!endTime) return badRequest('End time is required')
  if (new Date(endTime) <= new Date(startTime)) return badRequest('End time must be after start time')

  const { data, error } = await adminClient
    .from('vendor_demo_slots')
    .update({ start_time: startTime, end_time: endTime })
    .eq('id', id)
    .eq('status', 'open')
    .select('*, vendor:crm_vendors(id, name)')
    .single()

  if (error || !data) return badRequest('Only open slots can be rescheduled')
  return ok(data)
}

// DELETE /api/marketing/vendor-relations/slots/[id] — deletes open or reserved slots
export async function DELETE(_req: Request, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  if (!(await isVendorRelationsManager(adminClient, appUser.id, appUser.is_admin))) return forbidden()

  const { id } = await params
  const { error } = await adminClient.from('vendor_demo_slots').delete().eq('id', id)
  if (error) return serverError(error.message)
  return ok({ ok: true })
}
