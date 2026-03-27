import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('store_assignments')
    .select('id, store_id, user_id, role, created_at, user:users(id, display_name, email, avatar_url, profile_image_url)')
    .eq('store_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_id, role } = await request.json()
  if (!user_id || !role) return NextResponse.json({ error: 'user_id and role are required' }, { status: 400 })
  if (!['manager', 'sales'].includes(role)) return NextResponse.json({ error: 'role must be manager or sales' }, { status: 400 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('store_assignments')
    .upsert({ store_id: id, user_id, role }, { onConflict: 'store_id,user_id' })
    .select('id, store_id, user_id, role, created_at, user:users(id, display_name, email, avatar_url, profile_image_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const user_id = searchParams.get('user_id')
  if (!user_id) return NextResponse.json({ error: 'user_id is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('store_assignments')
    .delete()
    .eq('store_id', id)
    .eq('user_id', user_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
