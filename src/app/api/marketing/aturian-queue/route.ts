import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError, created, ok } from '@/lib/api/respond'
import { isUserCrmAttachmentUrl } from '@/lib/crm/attachments'
import { resolveAturianQueueAssignees } from '@/lib/crm/aturian-assignees'
import { dispatchNotification, fetchActor } from '@/lib/notifications/dispatch'
import { aturianCustomerQueueNewEntry } from '@/lib/notifications/registry'

const COMMISSIONED_CLIENT_OPTIONS = ['Standard', 'Standard with Split', 'Credit Card Store', 'Non-Credit card store']

// GET /api/marketing/aturian-queue?status=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const adminClient = createAdminClient()
  let query = adminClient.from('aturian_customer_queue').select('*').order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return serverError(error.message)

  const rows = data ?? []
  const userIds = [...new Set(rows.flatMap((r: any) => [r.assigned_to, r.claimed_by, r.created_by]).filter(Boolean))]
  const { data: users } = userIds.length > 0
    ? await adminClient.from('users').select('id, display_name').in('id', userIds)
    : { data: [] }
  const usersMap: Record<string, string> = {}
  for (const u of users ?? []) usersMap[u.id] = u.display_name

  const enriched = rows.map((r: any) => ({
    ...r,
    assigned_user: r.assigned_to ? { id: r.assigned_to, display_name: usersMap[r.assigned_to] ?? null } : null,
    claimed_user: r.claimed_by ? { id: r.claimed_by, display_name: usersMap[r.claimed_by] ?? null } : null,
    created_by_user: r.created_by ? { id: r.created_by, display_name: usersMap[r.created_by] ?? null } : null,
  }))

  return ok({ entries: enriched })
}

// POST /api/marketing/aturian-queue
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const body = await req.json()
  const {
    company_name, assigned_to, is_online_client, online_uses_cc,
    commissioned_client, tax_exempt, tax_certificate_url,
    address1, address2, city, state, zip, phone, website,
    orderer_first_name, orderer_last_name, orderer_email,
    ap_first_name, ap_last_name, ap_email,
  } = body

  if (!company_name?.trim()) return badRequest('Company Name is required')
  if (!COMMISSIONED_CLIENT_OPTIONS.includes(commissioned_client)) return badRequest('Invalid Commissioned Client value')

  const taxCertificateUrl = typeof tax_certificate_url === 'string' ? tax_certificate_url.trim() : ''
  const hasTaxCertificateUrl = taxCertificateUrl.length > 0
  if (tax_exempt === true && !hasTaxCertificateUrl) return badRequest('Tax Certificate is required when Tax Exempt is Yes')
  if (hasTaxCertificateUrl && !isUserCrmAttachmentUrl(taxCertificateUrl, appUser.id)) return badRequest('Invalid tax certificate URL')

  if (orderer_email && ap_email && String(orderer_email).trim().toLowerCase() === String(ap_email).trim().toLowerCase()) {
    return badRequest('AP contact email must differ from orderer email')
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('aturian_customer_queue')
    .insert({
      company_name: company_name.trim(),
      assigned_to: assigned_to || null,
      is_online_client: !!is_online_client,
      online_uses_cc: is_online_client ? !!online_uses_cc : null,
      commissioned_client,
      tax_exempt: !!tax_exempt,
      address1: address1 || null,
      address2: address2 || null,
      city: city || null,
      state: state || null,
      zip: zip || null,
      phone: phone || null,
      website: website || null,
      orderer_first_name: orderer_first_name || null,
      orderer_last_name: orderer_last_name || null,
      orderer_email: orderer_email || null,
      ap_first_name: ap_first_name || null,
      ap_last_name: ap_last_name || null,
      ap_email: ap_email || null,
      status: 'new',
      created_by: appUser.id,
    })
    .select()
    .single()

  if (error) return serverError(error.message)

  if (tax_exempt === true && hasTaxCertificateUrl) {
    const { error: fileError } = await adminClient
      .from('crm_files')
      .insert({
        aturian_queue_id: data.id,
        label: 'Tax Certificate',
        url: taxCertificateUrl,
        added_by: appUser.id,
      })

    if (fileError) {
      await adminClient.from('aturian_customer_queue').delete().eq('id', data.id)
      return serverError(fileError.message)
    }
  }

  const descLines = [
    `Company: ${company_name.trim()}`,
    phone ? `Phone: ${phone}` : null,
    address1 ? `Address: ${[address1, city, state, zip].filter(Boolean).join(', ')}` : null,
  ].filter(Boolean).join('\n')

  const { data: task } = await adminClient
    .from('crm_tasks')
    .insert({
      title: `Add ${company_name.trim()} to Aturian`,
      department: 'Accounting',
      assigned_to: null,
      description: descLines || null,
      status: 'not_started',
      priority: 'medium',
      progress: 0,
      created_by: appUser.id,
      task_owner: appUser.id,
    })
    .select()
    .single()

  if (task) {
    await adminClient.from('aturian_customer_queue').update({ task_id: task.id }).eq('id', data.id)
    data.task_id = task.id
  }

  const actor = await fetchActor(appUser.id)
  const assignees = await resolveAturianQueueAssignees(adminClient)
  if (assignees.length === 0) {
    console.error('[aturian-queue/POST] No queue assignees resolved — no notification sent')
  }
  for (const assignee of assignees) {
    try {
      await dispatchNotification({
        definition: aturianCustomerQueueNewEntry,
        payload: {
          queue_id: data.id,
          company_name: company_name.trim(),
          requestor_name: actor.display_name,
          phone: data.phone ?? null,
          address1: data.address1 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
        },
        recipientSpec: { userId: assignee.id },
        suppressUserIds: [appUser.id],
      })
    } catch (err) {
      console.error('[aturian-queue/POST] notification failed:', err)
      Sentry.captureException(err)
    }
  }

  return created(data)
}
