import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'
import { setEntityTags } from '@/lib/crm/tags'

// GET /api/marketing/customers/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: customer, error } = await adminClient
    .from('crm_customers')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !customer) return notFound('Customer not found')

  // Fetch related data in parallel
  const [contactsRes, oppsRes, filesRes, storesRes, assignedUserRes, createdByUserRes, entityTagsRes] = await Promise.all([
    adminClient.from('crm_contacts').select('id, first_name, last_name, title, email, phone, type_of_contact, department').eq('customer_id', id).order('last_name'),
    adminClient.from('crm_opportunities').select('id, name, value, status, pipeline_stage, forecast_close_date, assigned_to').eq('customer_id', id).order('created_at', { ascending: false }),
    adminClient.from('crm_files').select('id, label, url, created_at').eq('customer_id', id).order('created_at', { ascending: false }),
    adminClient.from('store_customer_links').select('stores(id, store_id, store_name, status, is_active)').eq('customer_id', id),
    customer.assigned_to
      ? adminClient.from('users').select('id, display_name, email').eq('id', customer.assigned_to).single()
      : Promise.resolve({ data: null }),
    adminClient.from('users').select('id, display_name, email').eq('id', customer.created_by).single(),
    adminClient
      .from('crm_entity_tags')
      .select('crm_tags(id, name, color)')
      .eq('entity_type', 'customer')
      .eq('entity_id', id),
  ])

  const tags = (entityTagsRes.data ?? []).map((r: any) => r.crm_tags).filter(Boolean)
  const stores = (storesRes.data ?? []).map((r: any) => r.stores).filter(Boolean)

  let brand_data = null
  if (customer.brand_data_id) {
    const { data } = await adminClient.from('crm_brand_data').select('*').eq('id', customer.brand_data_id).single()
    brand_data = data ?? null
  }

  return ok({
    ...customer,
    contacts: contactsRes.data ?? [],
    opportunities: oppsRes.data ?? [],
    files: filesRes.data ?? [],
    stores,
    assigned_user: assignedUserRes.data ?? null,
    created_by_user: createdByUserRes.data ?? null,
    tags,
    brand_data,
  })
}

// PATCH /api/marketing/customers/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const body = await req.json()

  // Extract tag_ids and strip read-only fields + related arrays
  const { tag_ids, ...rest } = body
  const updates = stripReadOnly(rest, ['tags', 'assigned_user', 'created_by_user', 'contacts', 'opportunities', 'files', 'brand_data', 'stores'])

  const adminClient = createAdminClient()

  if (Array.isArray(tag_ids)) {
    await setEntityTags(adminClient, 'customer', id, tag_ids)
    if (Object.keys(updates).length === 0) return ok({ ok: true })
  }

  const { data, error } = await adminClient
    .from('crm_customers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return ok(data)
}

// DELETE /api/marketing/customers/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  if (!appUser.is_admin) return forbidden()

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_customers').delete().eq('id', id)

  if (error) return serverError(error.message)
  return ok({ ok: true })
}
