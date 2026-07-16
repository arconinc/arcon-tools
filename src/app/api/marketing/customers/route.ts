import { NextRequest } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError, created, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'
import { dispatchNotification } from '@/lib/notifications/dispatch'
import { customerAddedToAturian } from '@/lib/notifications/registry'
import { resolveAturianAssignee } from '@/lib/crm/aturian-assignees'

const CRM_ATTACHMENTS_BUCKET = 'crm-attachments'

function isUserCrmAttachmentUrl(url: string, userId: string) {
  try {
    const parsedUrl = new URL(url)
    const supabaseUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!)
    const expectedPrefix = `/storage/v1/object/public/${CRM_ATTACHMENTS_BUCKET}/${userId}/`

    return parsedUrl.origin === supabaseUrl.origin && parsedUrl.pathname.startsWith(expectedPrefix)
  } catch {
    return false
  }
}

// GET /api/marketing/customers?search=&status=&assigned_to=&tag_id=&page=1&limit=50
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const status = searchParams.get('status')
  const assignedTo = searchParams.get('assigned_to')
  const tagIds = (searchParams.get('tag_id') ?? '').split(',').filter(Boolean)
  const hasTags = searchParams.get('has_tags') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)))
  const from = (page - 1) * limit
  const to = from + limit - 1

  const adminClient = createAdminClient()

  // If filtering by tag or has_tags, get matching entity IDs first
  let tagFilterIds: string[] | null = null
  if (tagIds.length > 0 || hasTags) {
    let tagQuery = adminClient
      .from('crm_entity_tags')
      .select('entity_id')
      .eq('entity_type', 'customer')
    if (tagIds.length > 0) tagQuery = tagQuery.in('tag_id', tagIds)
    const { data: tagRows } = await tagQuery
    tagFilterIds = [...new Set((tagRows ?? []).map((r: any) => r.entity_id))]
    if (tagFilterIds.length === 0) return ok({ customers: [], total: 0, page, limit })
  }

  const applyFilters = (q: any) => {
    if (search) q = q.ilike('name', `%${search}%`)
    if (status) q = q.eq('client_status', status)
    if (assignedTo) q = q.eq('assigned_to', assignedTo)
    if (tagFilterIds) q = q.in('id', tagFilterIds)
    return q
  }

  const [countRes, dataRes] = await Promise.all([
    applyFilters(adminClient.from('crm_customers').select('*', { count: 'exact', head: true })),
    applyFilters(
      adminClient
        .from('crm_customers')
        .select('id, name, client_status, phone, website, assigned_to, logo_url, created_at, updated_at')
        .order('name')
    ).range(from, to),
  ])

  if (dataRes.error) return serverError(dataRes.error.message)

  const total = countRes.count ?? 0
  const data = dataRes.data

  const rows = (data as any[]) ?? []
  const userIds = [...new Set(rows.map((c: any) => c.assigned_to).filter(Boolean))]
  const custIds = rows.map((c: any) => c.id)

  const [usersRes, entityTagsRes] = await Promise.all([
    userIds.length > 0
      ? adminClient.from('users').select('id, display_name').in('id', userIds)
      : Promise.resolve({ data: [] }),
    custIds.length > 0
      ? adminClient
          .from('crm_entity_tags')
          .select('entity_id, crm_tags(id, name, color)')
          .eq('entity_type', 'customer')
          .in('entity_id', custIds)
      : Promise.resolve({ data: [] }),
  ])

  const usersMap: Record<string, string> = {}
  for (const u of usersRes.data ?? []) usersMap[u.id] = u.display_name

  const tagsMap: Record<string, any[]> = {}
  for (const row of entityTagsRes.data ?? []) {
    const eid = (row as any).entity_id
    const tag = (row as any).crm_tags
    if (!tagsMap[eid]) tagsMap[eid] = []
    if (tag) tagsMap[eid].push(tag)
  }

  const enriched = rows.map((c: any) => ({
    ...c,
    assigned_user_name: c.assigned_to ? (usersMap[c.assigned_to] ?? null) : null,
    tags: tagsMap[c.id] ?? [],
  }))

  return ok({ customers: enriched, total, page, limit })
}

// POST /api/marketing/customers
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const body = await req.json()
  const { name, tag_ids, tax_certificate_url, ...rest } = body
  if (!name?.trim()) return badRequest('Name is required')
  const taxCertificateUrl = typeof tax_certificate_url === 'string' ? tax_certificate_url.trim() : ''
  const hasTaxCertificateUrl = taxCertificateUrl.length > 0
  if (rest.tax_exempt === true && !hasTaxCertificateUrl) return badRequest('Tax Certificate is required when Tax Exempt is Yes')
  if (hasTaxCertificateUrl && !isUserCrmAttachmentUrl(taxCertificateUrl, appUser.id)) return badRequest('Invalid tax certificate URL')

  const safeRest = stripReadOnly(rest, ['tags', 'assigned_user', 'created_by_user', 'contacts', 'opportunities', 'files', 'brand_data'])

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_customers')
    .insert({ name: name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return serverError(error.message)

  if (rest.tax_exempt === true && hasTaxCertificateUrl) {
    const { error: fileError } = await adminClient
      .from('crm_files')
      .insert({
        customer_id: data.id,
        label: 'Tax Certificate',
        url: taxCertificateUrl,
        added_by: appUser.id,
      })

    if (fileError) {
      await adminClient.from('crm_customers').delete().eq('id', data.id)
      return serverError(fileError.message)
    }
  }

  if (Array.isArray(tag_ids) && tag_ids.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      tag_ids.map((tid: string) => ({ tag_id: tid, entity_type: 'customer', entity_id: data.id }))
    )

    // Check if "Add to Aturian" tag is in tag_ids
    const { data: aturianTag } = await adminClient
      .from('crm_tags')
      .select('id')
      .ilike('name', 'add to aturian')
      .single()

    if (aturianTag && tag_ids.includes(aturianTag.id)) {
      const { data: actorUser } = await adminClient
        .from('users')
        .select('display_name, email')
        .eq('id', appUser.id)
        .single()
      const requestorName = actorUser?.display_name ?? actorUser?.email ?? 'Unknown'

      const descLines = [
        `Company: ${name.trim()}`,
        data.phone ? `Phone: ${data.phone}` : null,
        data.billing_address1 ? `Billing Address: ${[data.billing_address1, data.billing_city, data.billing_state, data.billing_zip].filter(Boolean).join(', ')}` : null,
      ].filter(Boolean).join('\n')
      const assignee = await resolveAturianAssignee(adminClient, 'customer')

      const { data: task } = await adminClient
        .from('crm_tasks')
        .insert({
          title: `Add ${name.trim()} to Aturian`,
          department: 'Accounting',
          assigned_to: assignee?.id ?? null,
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
        try {
          await dispatchNotification({
            definition: customerAddedToAturian,
            payload: {
              customer_id: data.id,
              customer_name: name.trim(),
              requestor_name: requestorName,
              phone: data.phone ?? null,
              billing_address1: data.billing_address1 ?? null,
              billing_city: data.billing_city ?? null,
              billing_state: data.billing_state ?? null,
            },
            recipientSpec: assignee ? { userId: assignee.id } : { department: 'Accounting' },
            suppressUserIds: [appUser.id],
          })
        } catch (err) {
          console.error('[customers/POST] aturian notification failed:', err)
          Sentry.captureException(err)
        }
      }
    }
  }

  return created(data)
}
