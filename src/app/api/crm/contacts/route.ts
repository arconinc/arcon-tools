import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'

// GET /api/crm/contacts?search=&customer_id=&vendor_id=&type=
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')?.trim()
  const customerId = searchParams.get('customer_id')
  const vendorId = searchParams.get('vendor_id')
  const type = searchParams.get('type')

  const adminClient = createAdminClient()
  let query = adminClient
    .from('crm_contacts')
    .select('id, first_name, last_name, title, email, phone, type_of_contact, customer_id, vendor_id, tags, created_at, updated_at')
    .order('last_name')
    .order('first_name')

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
  }
  if (customerId) query = query.eq('customer_id', customerId)
  if (vendorId) query = query.eq('vendor_id', vendorId)
  if (type) query = query.eq('type_of_contact', type)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Resolve parent org names
  const contacts = data ?? []
  const customerIds = [...new Set(contacts.map((c: any) => c.customer_id).filter(Boolean))]
  const vendorIds = [...new Set(contacts.map((c: any) => c.vendor_id).filter(Boolean))]

  const [customersRes, vendorsRes] = await Promise.all([
    customerIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
    vendorIds.length > 0
      ? adminClient.from('crm_vendors').select('id, name').in('id', vendorIds)
      : Promise.resolve({ data: [] }),
  ])

  const customerMap: Record<string, string> = {}
  for (const c of customersRes.data ?? []) customerMap[c.id] = c.name
  const vendorMap: Record<string, string> = {}
  for (const v of vendorsRes.data ?? []) vendorMap[v.id] = v.name

  const enriched = contacts.map((c: any) => ({
    ...c,
    customer_name: c.customer_id ? (customerMap[c.customer_id] ?? null) : null,
    vendor_name: c.vendor_id ? (vendorMap[c.vendor_id] ?? null) : null,
  }))

  return NextResponse.json(enriched)
}

// POST /api/crm/contacts
export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { first_name, last_name, ...rest } = body
  if (!first_name?.trim() || !last_name?.trim()) {
    return NextResponse.json({ error: 'First name and last name are required' }, { status: 400 })
  }

  const { id: _id, created_at: _ca, updated_at: _ua, created_by: _cb, ...safeRest } = rest

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('crm_contacts')
    .insert({ first_name: first_name.trim(), last_name: last_name.trim(), ...safeRest, created_by: appUser.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
