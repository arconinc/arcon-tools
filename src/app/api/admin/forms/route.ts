import { NextRequest, NextResponse } from 'next/server'
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

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data: forms, error } = await adminClient
    .from('forms')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forms })
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, category, file_url, file_size_bytes, mime_type, description, states_covered } = body

  if (!name || !category || !file_url) {
    return NextResponse.json(
      { error: 'Missing required fields: name, category, file_url' },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()
  const { data: form, error } = await adminClient
    .from('forms')
    .insert([{
      name,
      category,
      file_url,
      file_size_bytes: file_size_bytes || null,
      mime_type: mime_type || 'application/pdf',
      description: description || null,
      states_covered: states_covered || [],
      created_by: admin.id,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, name, description, is_active, states_covered } = body
  if (!id) return NextResponse.json({ error: 'Missing form id' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data: form, error } = await adminClient
    .from('forms')
    .update({ name, description, is_active, states_covered, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ form })
}

export async function DELETE(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'Missing form id' }, { status: 400 })

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('forms')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
