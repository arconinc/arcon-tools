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

  const [docResult, permsResult, allUsersResult] = await Promise.all([
    adminClient
      .from('documents')
      .select('owner_id, users!documents_owner_id_fkey(id, display_name, email)')
      .eq('id', docId)
      .single(),
    adminClient
      .from('document_permissions')
      .select('department, user_id')
      .eq('document_id', docId),
    adminClient
      .from('users')
      .select('id, display_name, email, department')
      .is('deactivated_at', null),
  ])

  if (!docResult.data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const doc = docResult.data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const owner: { id: string; display_name: string; email: string } | null = (doc as any).users ?? null

  const perms = permsResult.data ?? []
  const allUsers = allUsersResult.data ?? []

  const departmentGrants = perms.map(p => p.department).filter((d): d is string => !!d)
  const userGrantIds = new Set(perms.map(p => p.user_id).filter((u): u is string => !!u))

  const open_to_all = departmentGrants.length === 0 && userGrantIds.size === 0

  // When open to all, just return the owner — the UI will show an "all users" banner.
  if (open_to_all) {
    const resolved_users = owner ? [{ ...owner, via: 'owner' as const }] : []
    return NextResponse.json({ owner, open_to_all: true, resolved_users })
  }

  // Deduplicate by user ID, tracking how access was granted
  const seen = new Map<string, { id: string; display_name: string; email: string; via: 'owner' | 'department' | 'individual' }>()

  if (owner) {
    seen.set(owner.id, { ...owner, via: 'owner' })
  }

  for (const u of allUsers) {
    if (seen.has(u.id)) continue

    // Department grant
    if (departmentGrants.length > 0 && u.department) {
      const depts: string[] = Array.isArray(u.department) ? u.department : [u.department]
      if (departmentGrants.some(d => depts.includes(d))) {
        seen.set(u.id, { id: u.id, display_name: u.display_name, email: u.email, via: 'department' })
        continue
      }
    }

    // Individual grant
    if (userGrantIds.has(u.id)) {
      seen.set(u.id, { id: u.id, display_name: u.display_name, email: u.email, via: 'individual' })
    }
  }

  const resolved_users = [...seen.values()].sort((a, b) => {
    const order = { owner: 0, department: 1, individual: 2 } as const
    return order[a.via] - order[b.via] || a.display_name.localeCompare(b.display_name)
  })

  return NextResponse.json({ owner, open_to_all: false, resolved_users })
}
