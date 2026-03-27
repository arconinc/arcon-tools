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
    .from('store_contact_links')
    .select('contact:crm_contacts(id, first_name, last_name, email)')
    .eq('store_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map((r: { contact: unknown }) => r.contact))
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { contact_id } = await request.json()
  if (!contact_id) return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('store_contact_links')
    .insert({ store_id: id, contact_id })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const contact_id = searchParams.get('contact_id')
  if (!contact_id) return NextResponse.json({ error: 'contact_id is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('store_contact_links')
    .delete()
    .eq('store_id', id)
    .eq('contact_id', contact_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
