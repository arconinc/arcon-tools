import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'
import { setEntityTags } from '@/lib/crm/tags'

// GET /api/marketing/contacts/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: contact, error } = await adminClient
    .from('crm_contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !contact) return notFound('Contact not found')

  const [customerRes, vendorRes, filesRes, entityTagsRes] = await Promise.all([
    contact.customer_id
      ? adminClient.from('crm_customers').select('id, name, website').eq('id', contact.customer_id).single()
      : Promise.resolve({ data: null }),
    contact.vendor_id
      ? adminClient.from('crm_vendors').select('id, name, website').eq('id', contact.vendor_id).single()
      : Promise.resolve({ data: null }),
    adminClient.from('crm_files').select('id, label, url, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
    adminClient
      .from('crm_entity_tags')
      .select('crm_tags(id, name, color)')
      .eq('entity_type', 'contact')
      .eq('entity_id', id),
  ])

  const tags = (entityTagsRes.data ?? []).map((r: any) => r.crm_tags).filter(Boolean)

  return ok({
    ...contact,
    customer: customerRes.data ?? null,
    vendor: vendorRes.data ?? null,
    files: filesRes.data ?? [],
    tags,
  })
}

// PATCH /api/marketing/contacts/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const { id } = await params
  const body = await req.json()
  const { tag_ids, ...rest } = body
  const updates = stripReadOnly(rest, ['tags', 'customer', 'vendor', 'files', 'customer_name', 'vendor_name'])

  const adminClient = createAdminClient()

  if (Array.isArray(tag_ids)) {
    await setEntityTags(adminClient, 'contact', id, tag_ids)
    if (Object.keys(updates).length === 0) return ok({ ok: true })
  }

  const { data, error } = await adminClient
    .from('crm_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return serverError(error.message)
  return ok(data)
}

// DELETE /api/marketing/contacts/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  if (!appUser.is_admin) return forbidden()

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_contacts').delete().eq('id', id)

  if (error) return serverError(error.message)
  return ok({ ok: true })
}
