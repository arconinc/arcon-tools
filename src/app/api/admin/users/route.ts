import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ASSIGNMENT_GROUP_BY_DEPARTMENT, DEPARTMENT_BY_ASSIGNMENT_GROUP } from '@/lib/auth/group-access'

async function requireAdmin(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('is_admin').eq('google_id', googleId).single()
  return data?.is_admin === true
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const includeDeactivated = searchParams.get('include_deactivated') === 'true'

  const adminClient = createAdminClient()
  let query = adminClient
    .from('users')
    .select('id, email, display_name, is_admin, avatar_url, profile_image_url, created_at, last_login_at, birth_date, start_date, google_id, deactivated_at, group_memberships!group_memberships_user_id_fkey(groups(id, key, name, color, is_active, source_type))')
    .order('created_at', { ascending: false })

  if (!includeDeactivated) {
    query = query.is('deactivated_at', null)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const normalized = (data ?? []).map((u) => (({
    ...u,
    department: Array.isArray(u.group_memberships)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? [...new Set(u.group_memberships.map((m: any) => m.groups).filter((group: any) => group?.is_active && group?.source_type === 'assignment_pool').map((group: any) => DEPARTMENT_BY_ASSIGNMENT_GROUP[group.key]).filter(Boolean))]
      : null,
    roles: Array.isArray(u.group_memberships)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? u.group_memberships.map((m: any) => m.groups).filter((group: any) => group?.is_active && group?.source_type === 'role').map((group: any) => group.key).filter(Boolean)
      : [],
    groups: Array.isArray(u.group_memberships)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? u.group_memberships.map((m: any) => m.groups).filter((group: any) => group?.is_active)
      : [],
    group_memberships: undefined,
  })))
  return NextResponse.json(normalized)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, display_name, birth_date, start_date, is_admin } = await request.json()
  if (!email || !display_name) {
    return NextResponse.json({ error: 'email and display_name are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .insert({ email, display_name, birth_date: birth_date ?? null, start_date: start_date ?? null, is_admin: is_admin ?? false })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, is_admin, display_name, birth_date, start_date, department, deactivate } = await request.json()
  const updates: Record<string, unknown> = {}
  if (is_admin !== undefined) updates.is_admin = is_admin
  if (display_name !== undefined) updates.display_name = display_name
  if (birth_date !== undefined) updates.birth_date = birth_date
  if (start_date !== undefined) updates.start_date = start_date
  if (deactivate === true) updates.deactivated_at = new Date().toISOString()
  if (deactivate === false) updates.deactivated_at = null

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (department !== undefined) {
    const nextGroupKeys = Array.isArray(department)
      ? [...new Set(department.map((name: string) => ASSIGNMENT_GROUP_BY_DEPARTMENT[name]).filter((key): key is string => !!key))]
      : []
    const { data: assignmentGroups } = await adminClient
      .from('groups')
      .select('id, key, group_capabilities!inner(capability)')
      .eq('is_active', true)
      .eq('group_capabilities.capability', 'assignment_pool')

    const assignmentGroupIds = (assignmentGroups ?? []).map((group) => group.id)
    if (assignmentGroupIds.length > 0) {
      await adminClient.from('group_memberships').delete().eq('user_id', userId).in('group_id', assignmentGroupIds)
    }

    const groupIdsToInsert = (assignmentGroups ?? [])
      .filter((group) => nextGroupKeys.includes(group.key))
      .map((group) => group.id)

    if (groupIdsToInsert.length > 0) {
      await adminClient.from('group_memberships').insert(
        groupIdsToInsert.map((groupId) => ({ group_id: groupId, user_id: userId, source: 'manual' }))
      )
    }
  }

  return NextResponse.json(data)
}
