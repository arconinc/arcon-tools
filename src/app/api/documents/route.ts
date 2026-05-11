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
    .select('id, is_admin, department')
    .eq('google_id', user.id)
    .single()
  if (!realUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let effectiveUserId = realUser.id
  let isAdmin = realUser.is_admin
  let effectiveDepartment: string[] | null = realUser.department

  if (isAdmin) {
    const cookieStore = await cookies()
    const impersonateCookie = cookieStore.get('arcon_impersonate')
    if (impersonateCookie?.value) {
      const { data: target } = await adminClient
        .from('users')
        .select('id, is_admin, department')
        .eq('id', impersonateCookie.value)
        .is('deactivated_at', null)
        .single()
      if (target && !target.is_admin) {
        effectiveUserId = target.id
        isAdmin = false
        effectiveDepartment = target.department
      }
    }
  }

  let roles: string[] = []
  if (!isAdmin) {
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', effectiveUserId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    roles = (userRoles ?? []).map((r: any) => r.roles?.name).filter(Boolean)
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
    adminClient.from('document_permissions').select('document_id, department, user_id'),
  ])

  // Build permission map: docId → { depts, users }
  const permMap = new Map<string, { depts: string[]; users: string[] }>()
  for (const p of perms ?? []) {
    const entry = permMap.get(p.document_id) ?? { depts: [], users: [] }
    if (p.department) entry.depts.push(p.department)
    if (p.user_id) entry.users.push(p.user_id)
    permMap.set(p.document_id, entry)
  }

  function canSeeDoc(doc: { id: string; owner_id: string | null; required_role: string | null }): boolean {
    // Admins (non-impersonating) see all documents in the tree (metadata only; drive_url stripped below)
    if (isAdmin) return true
    const p = permMap.get(doc.id) ?? { depts: [], users: [] }
    return canAccessDocument(
      { ownerId: doc.owner_id, requiredRole: doc.required_role, departmentGrants: p.depts, userGrants: p.users },
      { id: effectiveUserId, roles, department: effectiveDepartment }
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
