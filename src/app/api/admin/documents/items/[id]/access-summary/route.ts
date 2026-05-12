import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  return appUser?.is_admin ? appUser : null
}

// GET /api/admin/documents/items/[id]/access-summary
// Resolves who currently has access: owner + all users matching department grants + individual grants.
// Called lazily when an admin expands the "Who has access" panel in the UI.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id: docId } = await params
  const adminClient = createAdminClient()

  const [docResult, permsResult] = await Promise.all([
    adminClient
      .from('documents')
      .select('owner_id, users!documents_owner_id_fkey(id, display_name, email)')
      .eq('id', docId)
      .single(),
    adminClient
      .from('document_permissions')
      .select('role_id, user_id')
      .eq('document_id', docId),
  ])

  if (!docResult.data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const doc = docResult.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner: { id: string; display_name: string; email: string } | null = (doc as any).users ?? null

  const perms = permsResult.data ?? []
  const roleGrantIds = perms.map(p => p.role_id).filter((r): r is string => !!r)
  const userGrantIds = new Set(perms.map(p => p.user_id).filter((u): u is string => !!u))

  const open_to_all = roleGrantIds.length === 0 && userGrantIds.size === 0

  if (open_to_all) {
    const resolved_users = owner ? [{ ...owner, via: 'owner' as const }] : []
    return NextResponse.json({ owner, open_to_all: true, resolved_users })
  }

  // Find all users who have at least one of the granted roles (directly or via department)
  // by querying user_roles and user_departments → department_roles.
  const [directRoleUsersResult, deptRoleUsersResult, individualUsersResult] = await Promise.all([
    // Users with a direct role grant
    adminClient
      .from('user_roles')
      .select('user_id, users!user_roles_user_id_fkey(id, display_name, email)')
      .in('role_id', roleGrantIds)
      .is('users.deactivated_at', null),
    // Users in departments that carry one of the granted roles
    adminClient
      .from('user_departments')
      .select('user_id, users!user_departments_user_id_fkey(id, display_name, email), department_roles!inner(role_id)')
      .in('department_roles.role_id', roleGrantIds)
      .is('users.deactivated_at', null),
    // Individually granted users
    userGrantIds.size > 0
      ? adminClient
          .from('users')
          .select('id, display_name, email')
          .in('id', [...userGrantIds])
          .is('deactivated_at', null)
      : Promise.resolve({ data: [] }),
  ])

  const seen = new Map<string, { id: string; display_name: string; email: string; via: 'owner' | 'role' | 'individual' }>()

  if (owner) seen.set(owner.id, { ...owner, via: 'owner' })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of directRoleUsersResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (r as any).users
    if (u && !seen.has(u.id)) seen.set(u.id, { id: u.id, display_name: u.display_name, email: u.email, via: 'role' })
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of deptRoleUsersResult.data ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const u = (r as any).users
    if (u && !seen.has(u.id)) seen.set(u.id, { id: u.id, display_name: u.display_name, email: u.email, via: 'role' })
  }
  for (const u of individualUsersResult.data ?? []) {
    if (!seen.has(u.id)) seen.set(u.id, { id: u.id, display_name: u.display_name, email: u.email, via: 'individual' })
  }

  const resolved_users = [...seen.values()].sort((a, b) => {
    const order = { owner: 0, role: 1, individual: 2 } as const
    return order[a.via] - order[b.via] || a.display_name.localeCompare(b.display_name)
  })

  return NextResponse.json({ owner, open_to_all: false, resolved_users })
}
