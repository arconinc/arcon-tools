import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cookies } from 'next/headers'

// GET /api/documents — returns section > folder > document tree filtered by user's roles.
// Each level (section, folder, document) may independently require a role.
// A user must have the required role at each level to see it.
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
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', effectiveUserId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    roles = (userRoles ?? []).map((r: any) => r.roles?.name).filter(Boolean)
  }

  function canAccess(required_role: string | null): boolean {
    if (isAdmin) return true
    if (!required_role) return true
    return roles.includes(required_role)
  }

  const [{ data: sections }, { data: folders }, { data: docs }] = await Promise.all([
    adminClient.from('doc_sections').select('*').order('sort_order').order('name'),
    adminClient.from('doc_folders').select('*').order('sort_order').order('name'),
    adminClient.from('documents').select('*').order('sort_order').order('title'),
  ])

  const tree = (sections ?? [])
    .filter(s => canAccess(s.required_role))
    .map(s => ({
      ...s,
      folders: (folders ?? [])
        .filter(f => f.section_id === s.id && canAccess(f.required_role))
        .map(f => ({
          ...f,
          documents: (docs ?? []).filter(d => d.folder_id === f.id && canAccess(d.required_role)),
        })),
    }))

  return NextResponse.json({ sections: tree })
}
