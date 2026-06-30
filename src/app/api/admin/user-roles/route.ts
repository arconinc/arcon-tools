import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/user-roles?userId=<id> — get a user's current access groups
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

  const { data: accessGroups } = await adminClient
    .from('groups')
    .select('id, key, name, color, group_capabilities!inner(capability)')
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'access_control')

  const accessGroupById = new Map((accessGroups ?? []).map((group) => [group.id, group]))
  const accessGroupIds = [...accessGroupById.keys()]
  if (accessGroupIds.length === 0) return NextResponse.json([])

  const { data } = await adminClient
    .from('group_memberships')
    .select('group_id')
    .eq('user_id', userId)
    .in('group_id', accessGroupIds)

  return NextResponse.json((data ?? []).map((row) => {
    const group = accessGroupById.get(row.group_id)
    return {
      role_id: row.group_id,
      roles: group ? { id: group.id, name: group.key, label: group.name, color: group.color } : null,
    }
  }))
}

// PUT /api/admin/user-roles — replace a user's access group set
// Body: { userId: string, roleIds: string[] } where roleIds are access group IDs.
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const { userId, roleIds } = body ?? {}

  if (!userId || !Array.isArray(roleIds)) {
    return NextResponse.json({ error: 'userId and roleIds[] are required' }, { status: 400 })
  }

  const { data: accessGroups } = await adminClient
    .from('groups')
    .select('id, group_capabilities!inner(capability)')
    .eq('is_active', true)
    .eq('group_capabilities.capability', 'access_control')

  const accessGroupIds = new Set((accessGroups ?? []).map((group) => group.id))
  const nextGroupIds = roleIds.filter((groupId: string) => accessGroupIds.has(groupId))

  if (accessGroupIds.size > 0) {
    await adminClient
      .from('group_memberships')
      .delete()
      .eq('user_id', userId)
      .in('group_id', [...accessGroupIds])
  }

  if (nextGroupIds.length > 0) {
    await adminClient.from('group_memberships').insert(
      nextGroupIds.map((groupId: string) => ({ user_id: userId, group_id: groupId, source: 'role', assigned_by: dbUser.id }))
    )
  }

  return NextResponse.json({ ok: true })
}
