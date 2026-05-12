import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'
import { canAccessDocument } from '@/lib/access'

// GET /api/documents — returns section > folder > document tree filtered by user's access.
// Section/folder access is still gated by required_role (existing behavior).
// Document access uses the new fine-grained permission model (owner + dept + individual).
// drive_url is omitted from the response — clients must call /api/documents/open to get it.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  // Resolve effective user (impersonation aware)
  const { data: realUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!realUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let effectiveUserId = realUser.id
  let isAdmin = realUser.is_admin

  if (isAdmin) {
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get('arcon_impersonate')
    if (impersonateCookie?.value) {
      const { data: target } = await adminClient
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
      adminClient.from('user_roles').select('roles(name)').eq('user_id', effectiveUserId),
      adminClient.from('user_departments').select('department_roles(roles(name))').eq('user_id', effectiveUserId),
    ])
    const roleSet = new Set<string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of (directRoles ?? []) as any[]) if (r.roles?.name) roleSet.add(r.roles.name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const ud of (deptRoles ?? []) as any[]) for (const dr of ud.department_roles ?? []) if (dr.roles?.name) roleSet.add(dr.roles.name)
    roles = [...roleSet]
  }

  // Section/folder required_role gating (unchanged from previous behavior)
  function canAccessSection(required_role: string | null): boolean {
    if (isAdmin) return true
    if (!required_role) return true
    return roles.includes(required_role)
  }

  const [{ data: sections }, { data: folders }, { data: docs }, { data: perms }] = await Promise.all([
    adminClient.from('doc_sections').select('*').order('sort_order').order('name'),
    adminClient.from('doc_folders').select('*').order('sort_order').order('name'),
    adminClient.from('documents').select('*').order('sort_order').order('title'),
    adminClient.from('document_permissions').select('document_id, role_id, user_id'),
  ])

  // Build permission map: docId → { roles, users }
  const permMap = new Map<string, { roles: string[]; users: string[] }>()
  for (const p of perms ?? []) {
    const entry = permMap.get(p.document_id) ?? { roles: [], users: [] }
    if (p.role_id) entry.roles.push(p.role_id)
    if (p.user_id) entry.users.push(p.user_id)
    permMap.set(p.document_id, entry)
  }

  // Role grants in document_permissions are stored as role IDs; resolve to names for the check.
  // We fetch names lazily from a local map built from all roles used in permissions.
  const allRoleIds = new Set([...permMap.values()].flatMap(e => e.roles))
  const roleIdToName = new Map<string, string>()
  if (allRoleIds.size > 0) {
    const { data: roleRows } = await adminClient
      .from('roles')
      .select('id, name')
      .in('id', [...allRoleIds])
    for (const r of roleRows ?? []) roleIdToName.set(r.id, r.name)
  }

  function canSeeDoc(doc: { id: string; owner_id: string | null; required_role: string | null }): boolean {
    // Admins (non-impersonating) see all documents in the tree (metadata only; drive_url stripped below)
    if (isAdmin) return true
    const p = permMap.get(doc.id) ?? { roles: [], users: [] }
    const roleGrants = p.roles.map(id => roleIdToName.get(id)).filter((n): n is string => !!n)
    // Honor legacy required_role if set alongside new system
    if (doc.required_role) roleGrants.push(doc.required_role)
    return canAccessDocument(
      { ownerId: doc.owner_id, roleGrants, userGrants: p.users },
      { id: effectiveUserId, roles }
    )
  }

  const tree = (sections ?? [])
    .filter(s => canAccessSection(s.required_role))
    .map(s => ({
      ...s,
      folders: (folders ?? [])
        .filter(f => f.section_id === s.id && canAccessSection(f.required_role))
        .map(f => ({
          ...f,
          documents: (docs ?? [])
            .filter(d => d.folder_id === f.id && canSeeDoc(d))
            .map(({ drive_url: _omit, ...rest }) => rest), // strip drive_url — use /open endpoint
        })),
    }))

  return NextResponse.json({ sections: tree })
}
