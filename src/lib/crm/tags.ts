import { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export async function ensureTag(adminClient: AdminClient, name: string, color: string): Promise<string> {
  const { data: existing } = await adminClient
    .from('crm_tags')
    .select('id')
    .eq('name', name)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: created, error } = await adminClient
    .from('crm_tags')
    .insert({ name, color })
    .select('id')
    .single()
  if (error) throw new Error(`Tag creation failed: ${error.message}`)
  return created.id as string
}

export async function applyEntityTag(
  adminClient: AdminClient,
  tagId: string,
  entityId: string,
  entityType: 'contact' | 'customer' | 'vendor' | 'opportunity'
): Promise<void> {
  const { data: existing } = await adminClient
    .from('crm_entity_tags')
    .select('tag_id')
    .eq('tag_id', tagId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .maybeSingle()
  if (!existing) {
    await adminClient
      .from('crm_entity_tags')
      .insert({ tag_id: tagId, entity_type: entityType, entity_id: entityId })
  }
}

export async function setEntityTags(
  adminClient: AdminClient,
  entityType: 'contact' | 'customer' | 'vendor' | 'opportunity',
  entityId: string,
  tagIds: string[]
): Promise<void> {
  await adminClient.from('crm_entity_tags').delete().eq('entity_type', entityType).eq('entity_id', entityId)
  if (tagIds.length > 0) {
    await adminClient.from('crm_entity_tags').insert(
      tagIds.map((tid: string) => ({ tag_id: tid, entity_type: entityType, entity_id: entityId }))
    )
  }
}

export async function upsertCustomer(
  adminClient: AdminClient,
  company: string,
  salespersonId: string
): Promise<string> {
  const { data: existing } = await adminClient
    .from('crm_customers')
    .select('id')
    .ilike('name', company.trim())
    .limit(1)
    .maybeSingle()
  if (existing?.id) return existing.id as string

  const { data: created, error } = await adminClient
    .from('crm_customers')
    .insert({
      name: company.trim(),
      client_status: 'Prospective',
      assigned_to: salespersonId,
      created_by: salespersonId,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Customer creation failed: ${error.message}`)
  return created.id as string
}

export async function upsertContact(
  adminClient: AdminClient,
  contact: {
    first_name: string
    last_name: string
    email: string
    phone?: string
    job_title?: string
    customer_id: string
    salesperson_id: string
    product_showcase_invite?: string
  }
): Promise<string> {
  const normalizedEmail = contact.email.toLowerCase().trim()

  const { data: existing } = await adminClient
    .from('crm_contacts')
    .select('id, customer_id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existing) {
    const updates: Record<string, unknown> = {}
    if (contact.product_showcase_invite) updates.product_showcase_invite = contact.product_showcase_invite
    if (!existing.customer_id) updates.customer_id = contact.customer_id
    if (Object.keys(updates).length > 0) {
      await adminClient.from('crm_contacts').update(updates).eq('id', existing.id)
    }
    return existing.id as string
  }

  const { data: created, error } = await adminClient
    .from('crm_contacts')
    .insert({
      first_name: contact.first_name.trim(),
      last_name: contact.last_name.trim(),
      email: normalizedEmail,
      phone: contact.phone ?? null,
      title: contact.job_title ?? null,
      type_of_contact: 'Customer',
      customer_id: contact.customer_id,
      arcon_salesperson: contact.salesperson_id,
      product_showcase_invite: contact.product_showcase_invite ?? null,
      created_by: contact.salesperson_id,
    })
    .select('id')
    .single()
  if (error) throw new Error(`Contact creation failed: ${error.message}`)
  return created.id as string
}
