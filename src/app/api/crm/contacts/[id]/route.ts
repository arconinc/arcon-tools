import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/contacts/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: contact, error } = await adminClient
    .from('crm_contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !contact) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [customerRes, vendorRes, filesRes, entityTagsRes] = await Promise.all([
    contact.customer_id
      ? adminClient.from('crm_customers').select('id, name, website').eq('id', contact.customer_id).single()
      : Promise.resolve({ data: null }),
    contact.vendor_id
      ? adminClient.from('crm_vendors').select('id, name, website').eq('id', contact.vendor_id).single()
      : Promise.resolve({ data: null }),
    adminClient.from('crm_files').select('id, label, url, created_at').eq('contact_id', id).order('created_at', { ascending: false }),
    adminClient
      .from('crm_entity_tags')
      .select('crm_tags(id, name, color)')
      .eq('entity_type', 'contact')
      .eq('entity_id', id),
  ])

  const tags = (entityTagsRes.data ?? []).map((r: any) => r.crm_tags).filter(Boolean)

  return NextResponse.json({
    ...contact,
    customer: customerRes.data ?? null,
    vendor: vendorRes.data ?? null,
    files: filesRes.data ?? [],
    tags,
  })
}

// PATCH /api/crm/contacts/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, tag_ids, tags: _tags, customer: _customer, vendor: _vendor, files: _files, ...updates } = body

  const adminClient = createAdminClient()

  if (Array.isArray(tag_ids)) {
    await adminClient.from('crm_entity_tags').delete().eq('entity_type', 'contact').eq('entity_id', id)
    if (tag_ids.length > 0) {
      await adminClient.from('crm_entity_tags').insert(
        tag_ids.map((tid: string) => ({ tag_id: tid, entity_type: 'contact', entity_id: id }))
      )
    }
    if (Object.keys(updates).length === 0) return NextResponse.json({ ok: true })
  }

  const { data, error } = await adminClient
    .from('crm_contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/crm/contacts/[id] — admin only
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('crm_contacts').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
