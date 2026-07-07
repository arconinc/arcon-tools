import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, forbidden, serverError, created, ok } from '@/lib/api/respond'
import { isVendorRelationsManager } from '@/lib/marketing/vendor-relations-access'

// GET /api/marketing/vendor-relations/slots — everyone can view
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('vendor_demo_slots')
    .select('*, vendor:crm_vendors(id, name)')
    .order('start_time', { ascending: true })

  if (error) return serverError(error.message)
  return ok({ items: data ?? [] })
}

// POST /api/marketing/vendor-relations/slots — marketing assignment pool only
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const adminClient = createAdminClient()
  if (!(await isVendorRelationsManager(adminClient, appUser.id, appUser.is_admin))) return forbidden()

  const body = await req.json()
  const startTime = typeof body.start_time === 'string' ? body.start_time : ''
  const endTime = typeof body.end_time === 'string' ? body.end_time : ''

  if (!startTime) return badRequest('Start time is required')
  if (!endTime) return badRequest('End time is required')
  if (new Date(endTime) <= new Date(startTime)) return badRequest('End time must be after start time')

  const { data, error } = await adminClient
    .from('vendor_demo_slots')
    .insert({
      start_time: startTime,
      end_time: endTime,
      created_by: appUser.id,
    })
    .select('*, vendor:crm_vendors(id, name)')
    .single()

  if (error) return serverError(error.message)
  return created(data)
}
