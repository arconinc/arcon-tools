import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin(googleId: string) {
  const adminClient = createAdminClient()
  const { data } = await adminClient.from('users').select('is_admin').eq('google_id', googleId).single()
  return data?.is_admin === true
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { data: store, error } = await adminClient
    .from('stores')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !store) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [assignmentsRes, customerRes, contactsRes, tasksRes] = await Promise.all([
    adminClient
      .from('store_assignments')
      .select('id, store_id, user_id, role, created_at, user:users(id, display_name, email, avatar_url, profile_image_url)')
      .eq('store_id', id),
    adminClient
      .from('store_customer_links')
      .select('customer:crm_customers(id, name)')
      .eq('store_id', id)
      .maybeSingle(),
    adminClient
      .from('store_contact_links')
      .select('contact:crm_contacts(id, first_name, last_name, email)')
      .eq('store_id', id),
    adminClient
      .from('crm_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', id)
      .neq('status', 'completed'),
  ])

  return NextResponse.json({
    ...store,
    assignments: assignmentsRes.data ?? [],
    customer: customerRes.data?.customer ?? null,
    contacts: (contactsRes.data ?? []).map((r: { contact: unknown }) => r.contact),
    open_task_count: tasksRes.count ?? 0,
  })
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const adminClient = createAdminClient()

  const allowed = [
    'store_id', 'store_name', 'is_active', 'domain', 'status', 'in_production',
    'launch_date', 'takedown_date', 'last_order_at',
    'store_types', 'who_pays', 'payment_methods', 'freight',
    'unique_incentives', 'product_types', 'allowances', 'mandatory_notes',
  ]
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const { data, error } = await adminClient
    .from('stores')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await requireAdmin(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('stores').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
