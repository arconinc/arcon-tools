import { createAdminClient } from '@/lib/supabase/admin'
import { ASSIGNMENT_GROUP_BY_DEPARTMENT } from '@/lib/auth/group-access'

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
    const groupKey = ASSIGNMENT_GROUP_BY_DEPARTMENT[spec.department]
    if (groupKey) {
      const { data } = await adminClient
        .from('group_memberships')
        .select('users!group_memberships_user_id_fkey(id, email, display_name, deactivated_at), groups!group_memberships_group_id_fkey!inner(key, is_active)')
        .eq('groups.key', groupKey)
        .eq('groups.is_active', true)
      rows = (data ?? []).flatMap((membership) => {
        const users = membership.users
        return Array.isArray(users) ? users : users ? [users] : []
      }) as typeof rows
    }
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
