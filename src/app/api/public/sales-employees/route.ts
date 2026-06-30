import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('group_memberships')
    .select('users!group_memberships_user_id_fkey(id, display_name), groups!group_memberships_group_id_fkey!inner(key, is_active)')
    .eq('groups.key', 'sales')
    .eq('groups.is_active', true)
    .is('users.deactivated_at', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? [])
    .flatMap((membership) => Array.isArray(membership.users) ? membership.users : membership.users ? [membership.users] : [])
    .sort((a, b) => a.display_name.localeCompare(b.display_name)))
}
