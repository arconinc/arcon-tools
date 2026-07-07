import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'
import { setEntityTags } from '@/lib/crm/tags'

// GET /api/marketing/vendors/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: vendor, error } = await adminClient
    .from('crm_vendors')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !vendor) return notFound('Vendor not found')

  const [contactsRes, filesRes, createdByUserRes, entityTagsRes] = await Promise.all([
    adminClient.from('crm_contacts').select('id, first_name, last_name, title, email, phone, type_of_contact, created_at').eq('vendor_id', id).order('last_name'),
    adminClient.from('crm_files').select('id, label, url, created_at').eq('vendor_id', id).order('created_at', { ascending: false }),
    adminClient.from('users').select('id, display_name, email').eq('id', vendor.created_by).single(),
    adminClient
      .from('crm_entity_tags')
      .select('crm_tags(id, name, color)')
      .eq('entity_type', 'vendor')
      .eq('entity_id', id),
  ])

  const tags = (entityTagsRes.data ?? []).map((r: any) => r.crm_tags).filter(Boolean)

  let brand_data = null
  if (vendor.brand_data_id) {
    const { data } = await adminClient.from('crm_brand_data').select('*').eq('id', vendor.brand_data_id).single()
    brand_data = data ?? null
  }

  return ok({
    ...vendor,
    contacts: contactsRes.data ?? [],
    files: filesRes.data ?? [],
    created_by_user: createdByUserRes.data ?? null,
    tags,
    brand_data,
  })
}

// PATCH /api/marketing/vendors/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const body = await req.json()
  const { tag_ids, ...rest } = body
  const updates = stripReadOnly(rest, ['tags', 'contacts', 'files', 'created_by_user', 'brand_data'])

  const adminClient = createAdminClient()

  if (Array.isArray(tag_ids)) {
    await setEntityTags(adminClient, 'vendor', id, tag_ids)
    if (Object.keys(updates).length === 0) return ok({ ok: true })
  }

  const { data, error } = await adminClient
    .from('crm_vendors')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return ok(data)
}

// DELETE /api/marketing/vendors/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  if (!appUser.is_admin) return forbidden()

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_vendors').delete().eq('id', id)

  if (error) return serverError(error.message)
  return ok({ ok: true })
}
