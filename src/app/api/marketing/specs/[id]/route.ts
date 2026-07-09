import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { fetchAndStoreOgImage } from '@/lib/specs/fetch-og-image'

type Params = { params: Promise<{ id: string }> }

// GET /api/marketing/specs/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: spec, error } = await adminClient.from('spec_samples').select('*').eq('id', id).single()
  if (error || !spec) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Enrich with names
  const [custRes, contactRes, csrRes, repRes, taskRes, artworkTaskRes, ideaRes] = await Promise.all([
    spec.customer_id
      ? adminClient.from('crm_customers').select('id, name, logo_url, billing_city, billing_state').eq('id', spec.customer_id).single()
      : Promise.resolve({ data: null }),
    spec.contact_id
      ? adminClient.from('crm_contacts').select('id, first_name, last_name, email, phone').eq('id', spec.contact_id).single()
      : Promise.resolve({ data: null }),
    spec.assigned_csr_id
      ? adminClient.from('users').select('id, display_name, avatar_url, profile_image_url').eq('id', spec.assigned_csr_id).single()
      : Promise.resolve({ data: null }),
    spec.sales_rep_id
      ? adminClient.from('users').select('id, display_name, avatar_url, profile_image_url').eq('id', spec.sales_rep_id).single()
      : Promise.resolve({ data: null }),
    spec.linked_task_id
      ? adminClient.from('crm_tasks').select('id, title, status, due_date').eq('id', spec.linked_task_id).single()
      : Promise.resolve({ data: null }),
    spec.artwork_task_id
      ? adminClient.from('crm_tasks').select('id, title, status, due_date').eq('id', spec.artwork_task_id).single()
      : Promise.resolve({ data: null }),
    spec.spec_idea_id
      ? adminClient.from('spec_ideas').select('id, item_name, vendor, image_url, ordering_instructions_html').eq('id', spec.spec_idea_id).single()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    ...spec,
    customer: custRes.data,
    contact: contactRes.data,
    assigned_csr: csrRes.data,
    sales_rep: repRes.data,
    linked_task: taskRes.data,
    artwork_task: artworkTaskRes.data,
    spec_idea: ideaRes.data,
  })
}

// PUT /api/marketing/specs/[id]
export async function PUT(req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const {
    id: _id, created_at: _ca,
    vendor_id: _vid, vendor: _v,
    customer_name: _cn, contact_name: _con, csr_name: _csrn, sales_rep_name: _srn,
    customer: _c, contact: _ct, assigned_csr: _ac, sales_rep: _sr, linked_task: _lt, artwork_task: _at, spec_idea: _si,
    ...rest
  } = body

  const adminClient = createAdminClient()

  // Check if vendor_link is changing so we know whether to re-fetch og:image
  const { data: existing } = await adminClient
    .from('spec_samples')
    .select('vendor_link, item_image_url')
    .eq('id', id)
    .single()

  const { data, error } = await adminClient
    .from('spec_samples')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-fetch og:image if vendor_link changed
  if (
    rest.vendor_link !== undefined &&
    rest.vendor_link !== existing?.vendor_link &&
    rest.vendor_link
  ) {
    fetchAndStoreOgImage(rest.vendor_link, id).catch(() => null)
  }

  return NextResponse.json(data)
}

// DELETE /api/marketing/specs/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const adminClient = createAdminClient()
  const { error } = await adminClient.from('spec_samples').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
