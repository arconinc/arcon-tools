import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEPARTMENT_BY_ASSIGNMENT_GROUP } from '@/lib/auth/group-access'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  const adminClient = createAdminClient()
  let query = adminClient
    .from('users')
    .select('id, email, display_name, job_title, office_location, employment_type, profile_image_url, avatar_url, start_date, phone, bio_html, department, group_memberships!group_memberships_user_id_fkey(groups(id, key, is_active, source_type))')
    .is('deactivated_at', null)
    .order('display_name')

  if (q) {
    query = query.or(`display_name.ilike.%${q}%,job_title.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((employee) => ({
    ...employee,
    department: [...new Set([
      ...(Array.isArray(employee.group_memberships) ? employee.group_memberships.map((m: any) => m.groups).filter((g: any) => g?.is_active && g?.source_type === 'assignment_pool').map((g: any) => DEPARTMENT_BY_ASSIGNMENT_GROUP[g.key]).filter(Boolean) : []),
      ...(Array.isArray(employee.department) ? employee.department : []),
    ])],
    group_memberships: undefined,
  })))
}
