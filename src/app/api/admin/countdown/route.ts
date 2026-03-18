import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  const { data: appUser } = await adminClient
    .from('users')
    .select('id, is_admin')
    .eq('google_id', user.id)
    .single()

  return appUser?.is_admin ? appUser : null
}

// GET — return countdown config (admin only)
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('countdown_config')
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT — update countdown config (admin only)
export async function PUT(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { enabled, label, target_date } = body

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 })
  }
  if (typeof label !== 'string' || label.trim() === '') {
    return NextResponse.json({ error: 'label is required' }, { status: 400 })
  }
  if (typeof target_date !== 'string') {
    return NextResponse.json({ error: 'target_date is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Upsert — update the single row (or insert if missing)
  const { data: existing } = await adminClient
    .from('countdown_config')
    .select('id')
    .single()

  let result
  if (existing) {
    const { data, error } = await adminClient
      .from('countdown_config')
      .update({ enabled, label: label.trim(), target_date, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  } else {
    const { data, error } = await adminClient
      .from('countdown_config')
      .insert({ enabled, label: label.trim(), target_date })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    result = data
  }

  return NextResponse.json(result)
}
