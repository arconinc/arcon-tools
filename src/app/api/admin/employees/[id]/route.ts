import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('is_admin').eq('google_id', googleId).single()
  return data?.is_admin === true
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('users')
    .select(`
      id, email, display_name, is_admin, google_id,
      birth_date, start_date, phone, address1, address2, city, state, zip,
      job_title, team, office_location, employment_type, timezone,
      profile_image_url, avatar_url,
      linkedin_url, bio_json, bio_html, skills, interests,
      manager_id
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const body = await request.json()

  const allowed = [
    'display_name', 'job_title', 'team', 'office_location', 'employment_type',
    'manager_id', 'birth_date', 'start_date', 'is_admin',
    'phone', 'linkedin_url', 'timezone',
    'bio_json', 'bio_html', 'skills', 'interests',
    'profile_image_url',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
