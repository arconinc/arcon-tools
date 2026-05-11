import { createAdminClient } from '@/lib/supabase/admin'

export interface RecipientSpec {
  userId?: string | null
  department?: string | null
  admins?: boolean   // send to all active admin users
}

export interface ResolvedRecipient {
  id: string
  email: string
  display_name: string
}

export async function resolveRecipients(spec: RecipientSpec): Promise<ResolvedRecipient[]> {
  const adminClient = createAdminClient()

  let rows: Array<{ id: string; email: string | null; display_name: string | null; deactivated_at: string | null }> = []

  if (spec.userId) {
    const { data } = await adminClient
      .from('users')
      .select('id, email, display_name, deactivated_at')
      .eq('id', spec.userId)
      .limit(1)
    rows = data ?? []
  } else if (spec.department) {
    const { data } = await adminClient
      .from('users')
      .select('id, email, display_name, deactivated_at')
      .contains('department', [spec.department])
    rows = data ?? []
  } else if (spec.admins) {
    const { data } = await adminClient
      .from('users')
      .select('id, email, display_name, deactivated_at')
      .eq('is_admin', true)
    rows = data ?? []
  }

  const seen = new Map<string, ResolvedRecipient>()
  for (const r of rows) {
    if (!r.id || r.deactivated_at) continue
    if (!r.email) continue
    if (seen.has(r.id)) continue
    seen.set(r.id, {
      id: r.id,
      email: r.email,
      display_name: r.display_name ?? r.email,
    })
  }
  return Array.from(seen.values())
}
