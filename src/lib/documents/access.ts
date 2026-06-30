import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { canAccessDocument } from '@/lib/access'
import { getUserAccessGroupKeys, normalizeAccessGroupKey } from '@/lib/auth/group-access'

type Admin = ReturnType<typeof createAdminClient>

export interface DocAccessContext {
  effectiveUserId: string
  isAdmin: boolean
  roles: string[]
}

// Resolves the impersonation-aware document access context for the current request.
// Returns null if the request is not authenticated.
// Extracted from /api/documents so the documents tree and universal search share
// one access implementation (no security drift).
export async function getDocAccessContext(admin: Admin): Promise<DocAccessContext | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: realUser } = await admin
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!realUser) return null

  let effectiveUserId = realUser.id
  let isAdmin = realUser.is_admin

  if (isAdmin) {
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get('arcon_impersonate')
    if (impersonateCookie?.value) {
      const { data: target } = await admin
        .from('users')
        .select('id, is_admin')
        .eq('id', impersonateCookie.value)
        .is('deactivated_at', null)
        .single()
      if (target && !target.is_admin) {
        effectiveUserId = target.id
        isAdmin = false
      }
    }
  }

  let roles: string[] = []
  if (!isAdmin) {
    roles = await getUserAccessGroupKeys(admin, effectiveUserId)
  }

  return { effectiveUserId, isAdmin, roles }
}

type DocLike = { id: string; owner_id: string | null; required_role: string | null }

// Filters a list of documents down to those the user in `ctx` may see.
// Admins (non-impersonating) see everything. Reuses canAccessDocument from lib/access.
// Extracted from /api/documents — same permission semantics.
export async function filterAccessibleDocuments<T extends DocLike>(
  admin: Admin,
  docs: T[],
  ctx: DocAccessContext,
): Promise<T[]> {
  if (ctx.isAdmin) return docs
  if (docs.length === 0) return docs

  const { data: perms } = await admin
    .from('document_permissions')
    .select('document_id, group_id, user_id')
    .in('document_id', docs.map(d => d.id))

  // Build permission map: docId → { roles, users }
  const permMap = new Map<string, { roles: string[]; users: string[] }>()
  for (const p of perms ?? []) {
    const entry = permMap.get(p.document_id) ?? { roles: [], users: [] }
    if (p.group_id) entry.roles.push(p.group_id)
    if (p.user_id) entry.users.push(p.user_id)
    permMap.set(p.document_id, entry)
  }

  // Group grants are stored as group IDs; resolve to access group keys for checks.
  const allGroupIds = new Set([...permMap.values()].flatMap(e => e.roles))
  const groupIdToKey = new Map<string, string>()
  if (allGroupIds.size > 0) {
    const { data: groupRows } = await admin
      .from('groups')
      .select('id, key')
      .in('id', [...allGroupIds])
    for (const group of groupRows ?? []) groupIdToKey.set(group.id, group.key)
  }

  return docs.filter(doc => {
    const p = permMap.get(doc.id) ?? { roles: [], users: [] }
    const roleGrants = p.roles.map(id => groupIdToKey.get(id)).filter((n): n is string => !!n)
    const requiredGroup = normalizeAccessGroupKey(doc.required_role)
    if (requiredGroup) roleGrants.push(requiredGroup)
    return canAccessDocument(
      { ownerId: doc.owner_id, roleGrants, userGrants: p.users },
      { id: ctx.effectiveUserId, roles: ctx.roles },
    )
  })
}
