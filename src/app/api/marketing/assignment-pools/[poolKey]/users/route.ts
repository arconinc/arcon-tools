import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/crm/require-user'
import { GROUP_CAPABILITIES } from '@/lib/groups/constants'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/marketing/assignment-pools/[poolKey]/users - active users eligible for an assignment pool
export async function GET(_req: NextRequest, { params }: { params: Promise<{ poolKey: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { poolKey } = await params
  const adminClient = createAdminClient()

  const { data: capabilities, error: capabilitiesError } = await adminClient
    .from('group_capabilities')
    .select('group_id, groups!inner(is_active)')
    .eq('capability', GROUP_CAPABILITIES.ASSIGNMENT_POOL)
    .contains('config', { pool_key: poolKey })
    .eq('groups.is_active', true)

  if (capabilitiesError) return NextResponse.json({ error: capabilitiesError.message }, { status: 500 })

  const groupIds = [...new Set((capabilities ?? []).map((row) => row.group_id).filter(Boolean))]
  if (groupIds.length === 0) return NextResponse.json([])

  const { data: memberships, error: membershipsError } = await adminClient
    .from('group_memberships')
    .select('users!group_memberships_user_id_fkey!inner(id, display_name, email, department, avatar_url, profile_image_url)')
    .in('group_id', groupIds)
    .is('users.deactivated_at', null)

  if (membershipsError) return NextResponse.json({ error: membershipsError.message }, { status: 500 })

  const usersById = new Map<string, {
    id: string
    display_name: string
    email: string
    department: string[] | null
    avatar_url: string | null
    profile_image_url: string | null
  }>()

  for (const membership of memberships ?? []) {
    const user = membership.users
    if (user && !usersById.has(user.id)) usersById.set(user.id, user)
  }

  const users = Array.from(usersById.values()).sort((a, b) => a.display_name.localeCompare(b.display_name))

  return NextResponse.json(users)
}
