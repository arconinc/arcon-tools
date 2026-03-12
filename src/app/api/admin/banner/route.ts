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

// GET — return draft and published configs
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('banner_config')
    .select('*')
    .order('status')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// PUT — save draft slides (admin only)
export async function PUT(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { slides_json } = await request.json()
  if (!Array.isArray(slides_json)) {
    return NextResponse.json({ error: 'slides_json must be an array' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('banner_config')
    .update({ slides_json, updated_at: new Date().toISOString() })
    .eq('status', 'draft')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST — publish (copy draft → published, admin only)
export async function POST() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // Fetch current draft
  const { data: draft, error: draftErr } = await adminClient
    .from('banner_config')
    .select('slides_json')
    .eq('status', 'draft')
    .single()

  if (draftErr || !draft) {
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  }

  // Copy draft slides to published row
  const { data, error } = await adminClient
    .from('banner_config')
    .update({ slides_json: draft.slides_json, updated_at: new Date().toISOString() })
    .eq('status', 'published')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
