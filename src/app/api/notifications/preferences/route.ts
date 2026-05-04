import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { NOTIFICATION_REGISTRY, getDefinition } from '@/lib/notifications/registry'

export async function GET() {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('notification_preferences')
    .select('type, email')
    .eq('user_id', appUser.id)

  const overrides = new Map<string, boolean>()
  for (const row of data ?? []) overrides.set(row.type, !!row.email)

  const definitions = Object.values(NOTIFICATION_REGISTRY).map(def => ({
    type: def.type,
    label: def.label,
    description: def.description,
    email: overrides.has(def.type) ? overrides.get(def.type)! : def.defaultEmail,
  }))

  return NextResponse.json({ preferences: definitions })
}

export async function PUT(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const type = typeof body?.type === 'string' ? body.type : null
  const email = typeof body?.email === 'boolean' ? body.email : null

  if (!type || email === null) {
    return NextResponse.json({ error: 'type (string) and email (boolean) required' }, { status: 400 })
  }
  if (!getDefinition(type)) {
    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('notification_preferences')
    .upsert({
      user_id: appUser.id,
      type,
      email,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,type' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
