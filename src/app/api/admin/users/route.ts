import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('is_admin').eq('google_id', googleId).single()
  return data?.is_admin === true
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .select('id, email, display_name, is_admin, avatar_url, created_at, last_login_at, birth_date, start_date, google_id')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { email, display_name, birth_date, start_date, is_admin } = await request.json()
  if (!email || !display_name) {
    return NextResponse.json({ error: 'email and display_name are required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .insert({ email, display_name, birth_date: birth_date ?? null, start_date: start_date ?? null, is_admin: is_admin ?? false })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A user with that email already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, is_admin, display_name, birth_date, start_date } = await request.json()
  const updates: Record<string, unknown> = {}
  if (is_admin !== undefined) updates.is_admin = is_admin
  if (display_name !== undefined) updates.display_name = display_name
  if (birth_date !== undefined) updates.birth_date = birth_date
  if (start_date !== undefined) updates.start_date = start_date

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
