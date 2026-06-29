import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AdminUser = { id: string; is_admin: boolean }
type AdminAuth = { admin: AdminUser; response?: undefined } | { admin?: undefined; response: NextResponse }

async function getAdminUser(googleId: string): Promise<AdminUser | null> {
  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', googleId)
    .single()

  return data?.is_admin === true ? data : null
}

async function requireAdmin(): Promise<AdminAuth> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = await getAdminUser(user.id)
  if (!admin) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }

  return { admin }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: group, error: groupError } = await adminClient
    .from('groups')
    .select('id')
    .eq('id', id)
    .single()

  if (groupError || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  const { data: activeUsers, error: usersError } = await adminClient
    .from('users')
    .select('id, display_name, email, avatar_url, profile_image_url, deactivated_at')
    .is('deactivated_at', null)
    .order('display_name')

  if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

  const { data: members, error: membersError } = await adminClient
    .from('group_memberships')
    .select('id, group_id, user_id, source, assigned_by, assigned_at, user:users(id, display_name, email, avatar_url, profile_image_url, deactivated_at)')
    .eq('group_id', id)
    .order('assigned_at', { ascending: false })

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  return NextResponse.json({ users: activeUsers ?? [], members: members ?? [] })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.response) return auth.response

  const { id } = await params
  const body = await request.json()
  const userIds = body.userIds

  if (!Array.isArray(userIds) || !userIds.every((userId) => typeof userId === 'string')) {
    return NextResponse.json({ error: 'userIds must be an array of user IDs' }, { status: 400 })
  }

  const uniqueUserIds = Array.from(new Set(userIds))
  const adminClient = createAdminClient()

  const { data: group, error: groupError } = await adminClient
    .from('groups')
    .select('id')
    .eq('id', id)
    .single()

  if (groupError || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  if (uniqueUserIds.length > 0) {
    const { data: activeUsers, error: usersError } = await adminClient
      .from('users')
      .select('id')
      .in('id', uniqueUserIds)
      .is('deactivated_at', null)

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

    const activeUserIds = new Set((activeUsers ?? []).map((user) => user.id))
    const invalidUserIds = uniqueUserIds.filter((userId) => !activeUserIds.has(userId))
    if (invalidUserIds.length > 0) {
      return NextResponse.json({ error: 'All members must be active users' }, { status: 400 })
    }
  }

  const { error: deleteError } = await adminClient
    .from('group_memberships')
    .delete()
    .eq('group_id', id)

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 })

  if (uniqueUserIds.length > 0) {
    const { error: insertError } = await adminClient
      .from('group_memberships')
      .insert(uniqueUserIds.map((userId) => ({
        group_id: id,
        user_id: userId,
        source: 'manual',
        assigned_by: auth.admin.id,
      })))

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const { data: members, error: membersError } = await adminClient
    .from('group_memberships')
    .select('id, group_id, user_id, source, assigned_by, assigned_at, user:users(id, display_name, email, avatar_url, profile_image_url, deactivated_at)')
    .eq('group_id', id)
    .order('assigned_at', { ascending: false })

  if (membersError) return NextResponse.json({ error: membersError.message }, { status: 500 })

  return NextResponse.json({ members: members ?? [] })
}
