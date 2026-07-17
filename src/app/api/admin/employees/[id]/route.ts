import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ASSIGNMENT_GROUP_BY_DEPARTMENT, DEPARTMENT_BY_ASSIGNMENT_GROUP } from '@/lib/auth/group-access'

async function requireAdmin(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('is_admin').eq('google_id', googleId).single()
  return data?.is_admin === true
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('users')
    .select(`
      id, email, display_name, is_admin, google_id,
      birth_date, start_date, phone, address1, address2, city, state, zip,
      job_title, office_location, employment_type, timezone,
      profile_image_url, avatar_url,
      linkedin_url, bio_json, bio_html, skills, interests,
      manager_id, department,
      group_memberships!group_memberships_user_id_fkey(groups(id, key, is_active, source_type))
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const groupDepartments = Array.isArray(data.group_memberships)
    ? data.group_memberships.map((m: any) => m.groups).filter((g: any) => g?.is_active && g?.source_type === 'assignment_pool').map((g: any) => DEPARTMENT_BY_ASSIGNMENT_GROUP[g.key]).filter(Boolean)
    : []
  const directDepartments: string[] = Array.isArray(data.department) ? data.department : []
  return NextResponse.json({
    ...data,
    department: [...new Set([...groupDepartments, ...directDepartments])],
    group_memberships: undefined,
  })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const allowed = [
    'display_name', 'job_title', 'office_location', 'employment_type',
    'manager_id', 'birth_date', 'start_date', 'is_admin',
    'phone', 'linkedin_url', 'timezone',
    'bio_json', 'bio_html', 'skills', 'interests',
    'profile_image_url',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0 && !('department' in body)) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  let data = null
  if (Object.keys(updates).length > 0) {
    const updateResult = await adminClient
      .from('users')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 })
    data = updateResult.data
  }

  if ('department' in body) {
    const deptList: string[] = Array.isArray(body.department) ? body.department : []
    const nextGroupKeys = [...new Set(deptList.map((name: string) => ASSIGNMENT_GROUP_BY_DEPARTMENT[name]).filter((key): key is string => !!key))]
    const directDepts = deptList.filter((name: string) => ASSIGNMENT_GROUP_BY_DEPARTMENT[name] === null)

    const { data: assignmentGroups } = await adminClient
      .from('groups')
      .select('id, key, group_capabilities!inner(capability)')
      .eq('is_active', true)
      .eq('group_capabilities.capability', 'assignment_pool')
    const assignmentGroupIds = (assignmentGroups ?? []).map((group) => group.id)
    if (assignmentGroupIds.length > 0) {
      await adminClient.from('group_memberships').delete().eq('user_id', id).in('group_id', assignmentGroupIds)
    }
    const groupIdsToInsert = (assignmentGroups ?? []).filter((group) => nextGroupKeys.includes(group.key)).map((group) => group.id)
    if (groupIdsToInsert.length > 0) {
      await adminClient.from('group_memberships').insert(groupIdsToInsert.map((groupId) => ({ group_id: groupId, user_id: id, source: 'manual' })))
    }

    await adminClient.from('users').update({ department: directDepts.length > 0 ? directDepts : null }).eq('id', id)
  }
  return NextResponse.json(data ?? { ok: true })
}
