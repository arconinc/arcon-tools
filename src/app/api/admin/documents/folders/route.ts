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

// GET /api/admin/documents/folders
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('doc_folders')
    .select('*')
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folders: data })
}

// POST /api/admin/documents/folders
export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, section_id, sort_order, required_role } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!section_id) return NextResponse.json({ error: 'section_id is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('doc_folders')
    .insert({ name: name.trim(), section_id, sort_order: sort_order ?? 0, required_role: required_role ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ folder: data }, { status: 201 })
}
