import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/vendors/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: vendor, error } = await adminClient
    .from('crm_vendors')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [contactsRes, filesRes, createdByUserRes] = await Promise.all([
    adminClient.from('crm_contacts').select('id, first_name, last_name, title, email, phone, type_of_contact').eq('vendor_id', id).order('last_name'),
    adminClient.from('crm_files').select('id, label, url, created_at').eq('vendor_id', id).order('created_at', { ascending: false }),
    adminClient.from('users').select('id, display_name, email').eq('id', vendor.created_by).single(),
  ])

  return NextResponse.json({
    ...vendor,
    contacts: contactsRes.data ?? [],
    files: filesRes.data ?? [],
    created_by_user: createdByUserRes.data ?? null,
  })
}

// PATCH /api/crm/vendors/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { id: _id, created_at: _ca, created_by: _cb, ...updates } = body

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_vendors')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/crm/vendors/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_vendors').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
