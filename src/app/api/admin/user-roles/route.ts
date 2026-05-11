import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/user-roles?userId=<id> — get a user's current roles
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

  const { data } = await adminClient
    .from('user_roles')
    .select('role_id, roles(id, name, label, color)')
    .eq('user_id', userId)

  return NextResponse.json(data ?? [])
}

// PUT /api/admin/user-roles — replace a user's role set
// Body: { userId: string, roleIds: string[] }
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

  // Delete all existing roles for this user, then insert the new set
  await adminClient.from('user_roles').delete().eq('user_id', userId)

  if (roleIds.length > 0) {
    await adminClient.from('user_roles').insert(
      roleIds.map((roleId: string) => ({ user_id: userId, role_id: roleId, granted_by: dbUser.id }))
    )
  }

  return NextResponse.json({ ok: true })
}
