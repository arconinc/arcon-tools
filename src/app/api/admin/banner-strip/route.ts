import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TickerConfig } from '@/types'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('google_id', user.id)
    .single()

  return data?.is_admin ? user : null
}

// GET — return current ticker_config
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('ticker_config')
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT — update ticker_config (partial update supported)
export async function PUT(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: Partial<TickerConfig> = await req.json()

  // Strip read-only fields
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, updated_at, ...updates } = body

  const adminClient = createAdminClient()

  // Get existing row id
  const { data: existing } = await adminClient
    .from('ticker_config')
    .select('id')
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'ticker_config row not found' }, { status: 404 })
  }

  const { data, error } = await adminClient
    .from('ticker_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', existing.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
