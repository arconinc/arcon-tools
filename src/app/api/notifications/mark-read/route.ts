import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const adminClient = createAdminClient()
  const now = new Date().toISOString()

  if (body?.all) {
    const { error } = await adminClient
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', appUser.id)
      .is('read_at', null)
      .is('archived_at', null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (typeof body?.id === 'string' && body.id.length > 0) {
    const { error } = await adminClient
      .from('notifications')
      .update({ read_at: now })
      .eq('id', body.id)
      .eq('user_id', appUser.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Provide id or all=true' }, { status: 400 })
}
