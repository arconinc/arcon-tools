import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, forbidden, notFound, serverError, ok } from '@/lib/api/respond'
import { stripReadOnly } from '@/lib/api/sanitize'
import { setEntityTags } from '@/lib/crm/tags'
import { withAssigneeNames } from '@/lib/crm/task-enrich'
import { softDeleteContact } from '@/lib/crm/soft-delete'

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
    .is('deleted_at', null)
    .single()

  if (error || !contact) return notFound('Contact not found')

  const [customerRes, vendorRes, filesRes, tasksRes, entityTagsRes] = await Promise.all([
    contact.customer_id
      ? adminClient.from('crm_customers').select('id, name, website').eq('id', contact.customer_id).single()
      : Promise.resolve({ data: null }),
    contact.vendor_id
      ? adminClient.from('crm_vendors').select('id, name, website').eq('id', contact.vendor_id).single()
      : Promise.resolve({ data: null }),
    adminClient.from('crm_files').select('id, label, url, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
    adminClient
      .from('crm_tasks')
      .select('id, title, status, priority, due_date, category, assigned_to')
      .eq('contact_id', id)
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(10),
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
    tasks: await withAssigneeNames(adminClient, tasksRes.data ?? []),
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
  const updates = stripReadOnly(rest, ['tags', 'customer', 'vendor', 'files', 'tasks', 'customer_name', 'vendor_name'])

  const adminClient = createAdminClient()

  if (Array.isArray(tag_ids)) {
    await setEntityTags(adminClient, 'contact', id, tag_ids)
    if (Object.keys(updates).length === 0) return ok({ ok: true })
  }

  const { data, error } = await adminClient
    .from('crm_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single()

  if (error) return serverError(error.message)
  return ok(data)
}

// DELETE /api/marketing/contacts/[id] — admin only. Soft delete: sets deleted_at. Nothing is removed from the table.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()
  if (!appUser.is_admin) return forbidden()

  const { id } = await params
  const adminClient = createAdminClient()
  try {
    const deleted = await softDeleteContact(adminClient, id)
    if (!deleted) return notFound('Contact not found')
    return ok({ ok: true })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Delete failed')
  }
}
