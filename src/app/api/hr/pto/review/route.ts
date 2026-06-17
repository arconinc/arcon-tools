import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/hr/pto/review — HR: list all PTO requests (hr role required)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!dbUser.is_admin) {
    const { data: userRoles } = await adminClient
      .from('user_roles')
      .select('roles(name)')
      .eq('user_id', dbUser.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isHr = (userRoles ?? []).some((r: any) => r.roles?.name === 'hr')
    if (!isHr) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await adminClient
    .from('pto_requests')
    .select('*, users!user_id(display_name, email, avatar_url)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [] })
}
