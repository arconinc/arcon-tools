import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError, created, ok } from '@/lib/api/respond'
import { resolveAturianSupplierQueueAssignees } from '@/lib/crm/aturian-assignees'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { aturianSupplierQueueNewEntry } from '@/lib/notifications/registry'
import { getTeamIdByKey } from '@/lib/team-assignment'
import { formatPhone } from '@/lib/phone'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// GET /api/marketing/aturian-supplier-queue?status=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const adminClient = createAdminClient()
  let query = adminClient.from('aturian_supplier_queue').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return serverError(error.message)

  const rows = data ?? []
  const userIds = [...new Set(rows.flatMap((r: any) => [r.requestor_id, r.claimed_by, r.created_by, r.completed_by]).filter(Boolean))]
  const { data: users } = userIds.length > 0
    ? await adminClient.from('users').select('id, display_name').in('id', userIds)
    : { data: [] }
  const usersMap: Record<string, string> = {}
  for (const u of users ?? []) usersMap[u.id] = u.display_name

  const enriched = rows.map((r: any) => ({
    ...r,
    requestor_user: r.requestor_id ? { id: r.requestor_id, display_name: usersMap[r.requestor_id] ?? null } : null,
    claimed_user: r.claimed_by ? { id: r.claimed_by, display_name: usersMap[r.claimed_by] ?? null } : null,
    created_by_user: r.created_by ? { id: r.created_by, display_name: usersMap[r.created_by] ?? null } : null,
    completed_by_user: r.completed_by ? { id: r.completed_by, display_name: usersMap[r.completed_by] ?? null } : null,
  }))

  return ok({ entries: enriched })
}

// POST /api/marketing/aturian-supplier-queue
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const body = await req.json()
  const {
    requestor_id, company_name, phone, website,
    mailing_address1, mailing_address2, mailing_city, mailing_state, mailing_zip,
    address1, address2, city, state, zip,
    orders_email, ap_email, art_email, sales_rep, paperwork_notes,
    paperwork_file_path, paperwork_file_name,
  } = body

  if (!requestor_id?.trim()) return badRequest('Requestor is required')
  if (!company_name?.trim()) return badRequest('Full Supplier Company Name is required')
  if (!mailing_address1?.trim()) return badRequest('Supplier Mailing Address is required')
  if (!mailing_city?.trim()) return badRequest('Supplier Mailing City is required')
  if (!mailing_state?.trim()) return badRequest('Supplier Mailing State is required')
  if (!mailing_zip?.trim()) return badRequest('Supplier Mailing ZIP is required')
  if (!address1?.trim()) return badRequest('Billing Address Line 1 is required')
  if (!city?.trim()) return badRequest('Billing City is required')
  if (!state?.trim()) return badRequest('Billing State is required')
  if (!zip?.trim()) return badRequest('Billing ZIP is required')
  if (!website?.trim()) return badRequest('Website is required')
  if (!phone?.trim()) return badRequest('Phone is required')
  if (!formatPhone(phone)) return badRequest('Phone must be a valid 10-digit US number')
  if (!ap_email?.trim()) return badRequest('AP Email is required')
  if (!EMAIL_RE.test(ap_email.trim())) return badRequest('AP Email must be a valid email address')
  if (!orders_email?.trim()) return badRequest('Orders Email is required')
  if (!EMAIL_RE.test(orders_email.trim())) return badRequest('Orders Email must be a valid email address')
  if (!art_email?.trim()) return badRequest('Art Email is required')
  if (!EMAIL_RE.test(art_email.trim())) return badRequest('Art Email must be a valid email address')
  if (!sales_rep?.trim()) return badRequest('Sales Rep Name and Email is required')
  if (!paperwork_notes?.trim()) return badRequest('Paperwork notes are required')

  const adminClient = createAdminClient()
  const assignees = await resolveAturianSupplierQueueAssignees(adminClient)

  const { data, error } = await adminClient
    .from('aturian_supplier_queue')
    .insert({
      requestor_id: requestor_id.trim(),
      company_name: company_name.trim(),
      phone: phone.trim(),
      website: website.trim(),
      mailing_address1: mailing_address1.trim(),
      mailing_address2: mailing_address2 || null,
      mailing_city: mailing_city.trim(),
      mailing_state: mailing_state.trim(),
      mailing_zip: mailing_zip.trim(),
      address1: address1.trim(),
      address2: address2 || null,
      city: city.trim(),
      state: state.trim(),
      zip: zip.trim(),
      orders_email: orders_email.trim(),
      ap_email: ap_email.trim(),
      art_email: art_email.trim(),
      sales_rep: sales_rep.trim(),
      paperwork_notes: paperwork_notes.trim(),
      paperwork_file_path: paperwork_file_path || null,
      paperwork_file_name: paperwork_file_name || null,
      status: 'new',
      created_by: appUser.id,
    })
    .select()
    .single()

  if (error) return serverError(error.message)

  const descLines = [
    `Company: ${company_name.trim()}`,
    `Phone: ${phone.trim()}`,
    `Address: ${[address1, city, state, zip].filter(Boolean).join(', ')}`,
  ].join('\n')

  const teamId = await getTeamIdByKey(adminClient, 'accounting')

  const { data: task } = await adminClient
    .from('crm_tasks')
    .insert({
      title: `Add ${company_name.trim()} to Aturian`,
      department: 'Accounting',
      team_id: teamId,
      assigned_to: assignees[0]?.id || null,
      description: descLines,
      status: 'not_started',
      priority: 'medium',
      progress: 0,
      created_by: appUser.id,
      task_owner: appUser.id,
    })
    .select()
    .single()

  if (task) {
    await adminClient.from('aturian_supplier_queue').update({ task_id: task.id }).eq('id', data.id)
    data.task_id = task.id
  }

  if (assignees.length > 0) {
    try {
      const actor = await fetchActor(appUser.id)
      await dispatchNotification({
        definition: aturianSupplierQueueNewEntry,
        payload: {
          queue_id: data.id,
          company_name: company_name.trim(),
          requestor_name: actor.display_name,
          phone: data.phone ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
        },
        recipientSpec: { userIds: assignees.map((a) => a.id) },
        suppressUserIds: [appUser.id],
      })
    } catch (err) {
      console.error('[aturian-supplier-queue/POST] notification failed:', err)
      Sentry.captureException(err)
    }
  }

  return created(data)
}
