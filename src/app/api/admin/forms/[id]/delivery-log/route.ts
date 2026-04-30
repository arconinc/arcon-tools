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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const adminClient = createAdminClient()

  const { data: logs, error } = await adminClient
    .from('form_delivery_logs')
    .select(`
      *,
      sent_by_user:users!sent_by_user_id(id, display_name),
      vendor:crm_vendors!vendor_id(id, name),
      customer:crm_customers!customer_id(id, name)
    `)
    .eq('form_id', id)
    .order('sent_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { vendor_id, customer_id, delivery_method, notes } = await req.json()

  const adminClient = createAdminClient()
  const { data: log, error } = await adminClient
    .from('form_delivery_logs')
    .insert([{
      form_id: id,
      vendor_id: vendor_id || null,
      customer_id: customer_id || null,
      sent_by_user_id: admin.id,
      delivery_method: delivery_method || 'download',
      notes: notes || null,
    }])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log }, { status: 201 })
}
