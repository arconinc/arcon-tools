import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError, created, ok } from '@/lib/api/respond'

const ACTIVITY_TYPES = new Set(['call', 'email', 'meeting', 'text', 'other'])

type ParentFields = {
  customer_id: string | null
  vendor_id: string | null
  opportunity_id: string | null
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parentCount(parent: ParentFields) {
  return [parent.customer_id, parent.vendor_id, parent.opportunity_id].filter(Boolean).length
}

async function enrichCallLogs(adminClient: ReturnType<typeof createAdminClient>, rows: any[]) {
  const loggedByIds = [...new Set(rows.map((r) => r.logged_by).filter(Boolean))]
  const contactIds = [...new Set(rows.map((r) => r.contact_id).filter(Boolean))]

  const [usersRes, contactsRes] = await Promise.all([
    loggedByIds.length > 0
      ? adminClient.from('users').select('id, display_name, email').in('id', loggedByIds)
      : Promise.resolve({ data: [] }),
    contactIds.length > 0
      ? adminClient.from('crm_contacts').select('id, first_name, last_name, email, phone, title').in('id', contactIds)
      : Promise.resolve({ data: [] }),
  ])

  const usersById: Record<string, any> = {}
  for (const user of usersRes.data ?? []) usersById[user.id] = user

  const contactsById: Record<string, any> = {}
  for (const contact of contactsRes.data ?? []) contactsById[contact.id] = contact

  return rows.map((row) => ({
    ...row,
    logged_by_user: usersById[row.logged_by] ?? null,
    contact: row.contact_id ? (contactsById[row.contact_id] ?? null) : null,
  }))
}

async function validateParent(adminClient: ReturnType<typeof createAdminClient>, parent: ParentFields) {
  if (parent.customer_id) {
    const { data, error } = await adminClient.from('crm_customers').select('id').eq('id', parent.customer_id).maybeSingle()
    if (error) return { ok: false, error: error.message }
    return { ok: !!data, error: data ? null : 'Customer not found' }
  }

  if (parent.vendor_id) {
    const { data, error } = await adminClient.from('crm_vendors').select('id').eq('id', parent.vendor_id).maybeSingle()
    if (error) return { ok: false, error: error.message }
    return { ok: !!data, error: data ? null : 'Supplier not found' }
  }

  if (parent.opportunity_id) {
    const { data, error } = await adminClient.from('crm_opportunities').select('id').eq('id', parent.opportunity_id).maybeSingle()
    if (error) return { ok: false, error: error.message }
    return { ok: !!data, error: data ? null : 'Opportunity not found' }
  }

  return { ok: false, error: 'A customer, supplier, or opportunity is required' }
}

async function getContactSnapshot(adminClient: ReturnType<typeof createAdminClient>, contactId: string | null, parent: ParentFields) {
  if (!contactId) return { ok: true, snapshot: { contact_name_snapshot: null, contact_email_snapshot: null } }

  const { data: contact, error } = await adminClient
    .from('crm_contacts')
    .select('id, first_name, last_name, email, customer_id, vendor_id')
    .eq('id', contactId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!contact) return { ok: false, error: 'Contact not found' }

  if (parent.customer_id && contact.customer_id !== parent.customer_id) {
    return { ok: false, error: 'Contact is not assigned to this customer' }
  }
  if (parent.vendor_id && contact.vendor_id !== parent.vendor_id) {
    return { ok: false, error: 'Contact is not assigned to this supplier' }
  }
  if (parent.opportunity_id) {
    const { data: opportunity, error: oppError } = await adminClient
      .from('crm_opportunities')
      .select('customer_id')
      .eq('id', parent.opportunity_id)
      .maybeSingle()
    if (oppError) return { ok: false, error: oppError.message }
    if (!opportunity || contact.customer_id !== opportunity.customer_id) {
      return { ok: false, error: 'Contact is not assigned to this opportunity customer' }
    }
  }

  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim()
  return {
    ok: true,
    snapshot: {
      contact_name_snapshot: name || null,
      contact_email_snapshot: contact.email ?? null,
    },
  }
}

// GET /api/marketing/call-logs?customer_id=&vendor_id=&opportunity_id=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { searchParams } = new URL(req.url)
  const parent: ParentFields = {
    customer_id: searchParams.get('customer_id'),
    vendor_id: searchParams.get('vendor_id'),
    opportunity_id: searchParams.get('opportunity_id'),
  }

  if (parentCount(parent) !== 1) {
    return badRequest('Provide exactly one customer_id, vendor_id, or opportunity_id')
  }

  const adminClient = createAdminClient()
  const parentCheck = await validateParent(adminClient, parent)
  if (!parentCheck.ok) return badRequest(parentCheck.error ?? 'Invalid call log parent')

  let query = adminClient.from('crm_call_logs').select('*').order('occurred_at', { ascending: false }).order('created_at', { ascending: false })
  if (parent.customer_id) query = query.eq('customer_id', parent.customer_id)
  if (parent.vendor_id) query = query.eq('vendor_id', parent.vendor_id)
  if (parent.opportunity_id) query = query.eq('opportunity_id', parent.opportunity_id)

  const { data, error } = await query
  if (error) return serverError(error.message)

  const callLogs = await enrichCallLogs(adminClient, data ?? [])
  return ok({ call_logs: callLogs })
}

// POST /api/marketing/call-logs
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const body = await req.json()
  const parent: ParentFields = {
    customer_id: cleanString(body.customer_id),
    vendor_id: cleanString(body.vendor_id),
    opportunity_id: cleanString(body.opportunity_id),
  }

  if (parentCount(parent) !== 1) {
    return badRequest('Provide exactly one customer_id, vendor_id, or opportunity_id')
  }

  const activityType = cleanString(body.activity_type) ?? 'call'
  if (!ACTIVITY_TYPES.has(activityType)) return badRequest('Invalid activity type')

  const durationValue = body.duration_minutes
  const durationMinutes = durationValue === null || durationValue === undefined || durationValue === ''
    ? null
    : Number(durationValue)
  if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 0 || durationMinutes > 1440)) {
    return badRequest('Duration must be a whole number of minutes')
  }

  const occurredAt = cleanString(body.occurred_at) ?? new Date().toISOString()
  const occurredDate = new Date(occurredAt)
  if (Number.isNaN(occurredDate.getTime())) return badRequest('Invalid date and time')

  const notes = cleanString(body.notes)
  const outcome = cleanString(body.outcome)
  const nextSteps = cleanString(body.next_steps)
  if (!notes && !outcome && !nextSteps) {
    return badRequest('Add notes, an outcome, or next steps')
  }

  const adminClient = createAdminClient()
  const parentCheck = await validateParent(adminClient, parent)
  if (!parentCheck.ok) return badRequest(parentCheck.error ?? 'Invalid call log parent')

  const contactId = cleanString(body.contact_id)
  const contactSnapshot = await getContactSnapshot(adminClient, contactId, parent)
  if (!contactSnapshot.ok) return badRequest(contactSnapshot.error ?? 'Invalid contact')

  const { data, error } = await adminClient
    .from('crm_call_logs')
    .insert({
      ...parent,
      contact_id: contactId,
      ...contactSnapshot.snapshot,
      activity_type: activityType,
      occurred_at: occurredDate.toISOString(),
      duration_minutes: durationMinutes,
      outcome,
      notes,
      next_steps: nextSteps,
      logged_by: appUser.id,
    })
    .select()
    .single()

  if (error) return serverError(error.message)

  const [callLog] = await enrichCallLogs(adminClient, [data])
  return created(callLog)
}

