import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/crm/require-user'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/marketing/access-groups/[groupKey]/users - active users belonging to an access-control group
export async function GET(_req: NextRequest, { params }: { params: Promise<{ groupKey: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupKey } = await params
  const adminClient = createAdminClient()

  const { data: group } = await adminClient
    .from('groups')
    .select('id')
    .eq('key', groupKey)
    .eq('is_active', true)
    .maybeSingle()

  if (!group) return NextResponse.json([])

  const { data: memberships, error } = await adminClient
    .from('group_memberships')
    .select('users!group_memberships_user_id_fkey!inner(id, display_name, email)')
    .eq('group_id', group.id)
    .is('users.deactivated_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const users = (memberships ?? [])
    .map((m) => (Array.isArray(m.users) ? m.users[0] : m.users))
    .filter((u): u is { id: string; display_name: string; email: string } => !!u)
    .sort((a, b) => a.display_name.localeCompare(b.display_name))

  return NextResponse.json(users)
}
