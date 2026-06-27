import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { canAccessDocument } from '@/lib/access'

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
    const [{ data: directRoles }, { data: deptRoles }] = await Promise.all([
      admin.from('user_roles').select('roles(name)').eq('user_id', effectiveUserId),
      admin.from('user_departments').select('department_roles(roles(name))').eq('user_id', effectiveUserId),
    ])
    const roleSet = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (directRoles ?? []) as any[]) if (r.roles?.name) roleSet.add(r.roles.name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ud of (deptRoles ?? []) as any[]) for (const dr of ud.department_roles ?? []) if (dr.roles?.name) roleSet.add(dr.roles.name)
    roles = [...roleSet]
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
    .select('document_id, role_id, user_id')
    .in('document_id', docs.map(d => d.id))

  // Build permission map: docId → { roles, users }
  const permMap = new Map<string, { roles: string[]; users: string[] }>()
  for (const p of perms ?? []) {
    const entry = permMap.get(p.document_id) ?? { roles: [], users: [] }
    if (p.role_id) entry.roles.push(p.role_id)
    if (p.user_id) entry.users.push(p.user_id)
    permMap.set(p.document_id, entry)
  }

  // Role grants are stored as role IDs; resolve to names for the check.
  const allRoleIds = new Set([...permMap.values()].flatMap(e => e.roles))
  const roleIdToName = new Map<string, string>()
  if (allRoleIds.size > 0) {
    const { data: roleRows } = await admin
      .from('roles')
      .select('id, name')
      .in('id', [...allRoleIds])
    for (const r of roleRows ?? []) roleIdToName.set(r.id, r.name)
  }

  return docs.filter(doc => {
    const p = permMap.get(doc.id) ?? { roles: [], users: [] }
    const roleGrants = p.roles.map(id => roleIdToName.get(id)).filter((n): n is string => !!n)
    if (doc.required_role) roleGrants.push(doc.required_role)
    return canAccessDocument(
      { ownerId: doc.owner_id, roleGrants, userGrants: p.users },
      { id: ctx.effectiveUserId, roles: ctx.roles },
    )
  })
}
