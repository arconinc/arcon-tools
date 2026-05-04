import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: realUser } = await adminClient
    .from('users')
    .select('id, display_name, is_admin')
    .eq('google_id', user.id)
    .single()

  if (!realUser?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const targetUserId = body?.targetUserId
  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
  }

  const { data: target } = await adminClient
    .from('users')
    .select('id, display_name, is_admin, deactivated_at')
    .eq('id', targetUserId)
    .single()

  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  if (target.is_admin) return NextResponse.json({ error: 'Cannot impersonate an admin' }, { status: 403 })
  if (target.deactivated_at) return NextResponse.json({ error: 'Cannot impersonate a deactivated user' }, { status: 403 })

  const cookieStore = await cookies()
  cookieStore.set('arcon_impersonate', targetUserId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 4,
    path: '/',
  })

  await logAudit({
    userId: realUser.id,
    action: 'impersonation.start',
    status: 'success',
    details: {
      target_user_id: target.id,
      target_user_name: target.display_name,
    },
  })

  return NextResponse.json({ ok: true })
}
