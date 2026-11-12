import type { createAdminClient } from '@/lib/supabase/admin'

type AdminClient = ReturnType<typeof createAdminClient>

export type SoftDeleteCounts = { customers: number; contacts: number; opportunities: number }

/**
 * Soft delete a customer. Its contacts and opportunities (rows with customer_id = this customer) are
 * marked deleted in the same request. Rows already deleted keep their original deleted_at.
 * Returns null when the customer does not exist or is already deleted.
 */
export async function softDeleteCustomer(
  adminClient: AdminClient,
  customerId: string,
  deletedAt: string = new Date().toISOString(),
): Promise<SoftDeleteCounts | null> {
  const { data: customer, error: findErr } = await adminClient
    .from('crm_customers')
    .select('id')
    .eq('id', customerId)
    .is('deleted_at', null)
    .maybeSingle()
  if (findErr) throw new Error(findErr.message)
  if (!customer) return null

  const { data: opps, error: oppErr } = await adminClient
    .from('crm_opportunities')
    .update({ deleted_at: deletedAt })
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .select('id')
  if (oppErr) throw new Error(oppErr.message)

  const { data: contacts, error: conErr } = await adminClient
    .from('crm_contacts')
    .update({ deleted_at: deletedAt })
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .select('id')
  if (conErr) throw new Error(conErr.message)

  const { error: custErr } = await adminClient
    .from('crm_customers')
    .update({ deleted_at: deletedAt })
    .eq('id', customerId)
  if (custErr) throw new Error(custErr.message)

  return { customers: 1, contacts: contacts?.length ?? 0, opportunities: opps?.length ?? 0 }
}

/** Soft delete one contact. Returns false when the contact does not exist or is already deleted. */
export async function softDeleteContact(
  adminClient: AdminClient,
  contactId: string,
  deletedAt: string = new Date().toISOString(),
): Promise<boolean> {
  const { data, error } = await adminClient
    .from('crm_contacts')
    .update({ deleted_at: deletedAt })
    .eq('id', contactId)
    .is('deleted_at', null)
    .select('id')
  if (error) throw new Error(error.message)
  return (data?.length ?? 0) > 0
}
