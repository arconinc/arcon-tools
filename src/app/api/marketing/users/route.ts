import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { DEPARTMENT_BY_ASSIGNMENT_GROUP } from '@/lib/auth/group-access'

// GET /api/marketing/users — list all users for dropdown use
export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await createAdminClient()
    .from('users')
    .select('id, display_name, email, avatar_url, profile_image_url, group_memberships!group_memberships_user_id_fkey(groups(id, key, is_active, source_type))')
    .is('deactivated_at', null)
    .order('display_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((user) => ({
    ...user,
    department: Array.isArray(user.group_memberships)
      ? [...new Set(user.group_memberships.map((membership: any) => membership.groups).filter((group: any) => group?.is_active && group?.source_type === 'assignment_pool').map((group: any) => DEPARTMENT_BY_ASSIGNMENT_GROUP[group.key]).filter(Boolean))]
      : null,
    group_memberships: undefined,
  })))
}
