import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ensureTag, applyEntityTag } from '@/lib/crm/tags'

export const runtime = 'nodejs'

const ATTENDED_TAG_NAME = 'AttendedProductShowcase2026'
const ATTENDED_TAG_COLOR = '#16a34a'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isValidUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

// ---------------------------------------------------------------------------
// GET — all registered contacts (no search), or search all contacts by name/email/company
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const search = new URL(req.url).searchParams.get('search')?.trim() ?? ''
  const adminClient = createAdminClient()

  let contacts: any[]

  if (search.length < 2) {
    // No search: return all contacts tagged ProductShowcase2026, ordered by last name
    const { data: registeredTag } = await adminClient
      .from('crm_tags')
      .select('id')
      .eq('name', 'ProductShowcase2026')
      .maybeSingle()

    if (!registeredTag?.id) return NextResponse.json({ contacts: [] })

    const { data: tagRows } = await adminClient
      .from('crm_entity_tags')
      .select('entity_id')
      .eq('tag_id', registeredTag.id)
      .eq('entity_type', 'contact')

    const registeredIds = (tagRows ?? []).map((r: any) => r.entity_id)
    if (registeredIds.length === 0) return NextResponse.json({ contacts: [] })

    const { data, error } = await adminClient
      .from('crm_contacts')
      .select('id, first_name, last_name, email, phone, customer_id')
      .in('id', registeredIds)
      .order('last_name')
      .order('first_name')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    contacts = data ?? []
  } else {
    // Search: query all contacts by name / email / company
    const { data: matchingCustomers } = await adminClient
      .from('crm_customers')
      .select('id')
      .ilike('name', `%${search}%`)
      .limit(50)

    const customerIdMatches = (matchingCustomers ?? []).map((c: any) => c.id)

    let query = adminClient
      .from('crm_contacts')
      .select('id, first_name, last_name, email, phone, customer_id')
      .order('last_name')
      .order('first_name')
      .limit(50)

    query = customerIdMatches.length > 0
      ? query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,customer_id.in.(${customerIdMatches.join(',')})`)
      : query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    contacts = data ?? []
  }

  if (!contacts || contacts.length === 0) return NextResponse.json({ contacts: [] })

  const contactIds = contacts.map((c: any) => c.id)
  const customerIds = [...new Set(contacts.map((c: any) => c.customer_id).filter(Boolean))]

  const [entityTagsRes, customersRes] = await Promise.all([
    adminClient
      .from('crm_entity_tags')
      .select('entity_id, crm_tags(id, name, color)')
      .eq('entity_type', 'contact')
      .in('entity_id', contactIds),
    customerIds.length > 0
      ? adminClient.from('crm_customers').select('id, name').in('id', customerIds)
      : Promise.resolve({ data: [] }),
  ])

  const customerMap: Record<string, string> = {}
  for (const c of customersRes.data ?? []) customerMap[c.id] = c.name

  const tagsMap: Record<string, { id: string; name: string; color: string }[]> = {}
  for (const row of entityTagsRes.data ?? []) {
    if (!tagsMap[row.entity_id]) tagsMap[row.entity_id] = []
    const tag = (row as any).crm_tags
    if (tag) tagsMap[row.entity_id].push(tag)
  }

  const result = contacts.map((c: any) => ({
    id: c.id,
    first_name: c.first_name,
    last_name: c.last_name,
    email: c.email,
    phone: c.phone,
    company: customerMap[c.customer_id] ?? null,
    tags: tagsMap[c.id] ?? [],
  }))

  return NextResponse.json({ contacts: result })
}

// ---------------------------------------------------------------------------
// POST { contact_id } — check in an existing contact
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const contactId = String(body.contact_id ?? '').trim()
  if (!contactId || !isValidUUID(contactId)) {
    return NextResponse.json({ error: 'A valid contact_id is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Verify contact exists
  const { data: contact, error: contactErr } = await adminClient
    .from('crm_contacts')
    .select('id')
    .eq('id', contactId)
    .maybeSingle()
  if (contactErr || !contact) {
    return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
  }

  // Check if already tagged
  const tagId = await ensureTag(adminClient, ATTENDED_TAG_NAME, ATTENDED_TAG_COLOR)
  const { data: existingTag } = await adminClient
    .from('crm_entity_tags')
    .select('tag_id')
    .eq('tag_id', tagId)
    .eq('entity_type', 'contact')
    .eq('entity_id', contactId)
    .maybeSingle()

  const alreadyCheckedIn = !!existingTag
  if (!alreadyCheckedIn) {
    await applyEntityTag(adminClient, tagId, contactId, 'contact')
  }

  return NextResponse.json({ success: true, already_checked_in: alreadyCheckedIn }, { status: 200 })
}

// ---------------------------------------------------------------------------
// PUT { first_name, last_name, email, company } — create walk-in + check in
// ---------------------------------------------------------------------------

export async function PUT(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const firstName = String(body.first_name ?? '').trim()
  const lastName = String(body.last_name ?? '').trim()
  const email = String(body.email ?? '').trim()
  const company = String(body.company ?? '').trim()

  if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 })
  if (!lastName) return NextResponse.json({ error: 'Last name is required' }, { status: 400 })
  if (!email || !isValidEmail(email))
    return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
  if (!company) return NextResponse.json({ error: 'Company is required' }, { status: 400 })

  const adminClient = createAdminClient()

  // Upsert customer
  const { data: existingCustomer } = await adminClient
    .from('crm_customers')
    .select('id')
    .ilike('name', company)
    .limit(1)
    .maybeSingle()

  let customerId: string
  if (existingCustomer?.id) {
    customerId = existingCustomer.id as string
  } else {
    const { data: newCustomer, error: custErr } = await adminClient
      .from('crm_customers')
      .insert({ name: company.trim(), client_status: 'Prospective' })
      .select('id')
      .single()
    if (custErr) return NextResponse.json({ error: 'Failed to create customer record' }, { status: 500 })
    customerId = newCustomer.id as string
  }

  // Upsert contact by email
  const normalizedEmail = email.toLowerCase()
  const { data: existingContact } = await adminClient
    .from('crm_contacts')
    .select('id')
    .eq('email', normalizedEmail)
    .maybeSingle()

  let contactId: string
  if (existingContact?.id) {
    contactId = existingContact.id as string
  } else {
    const { data: newContact, error: ctErr } = await adminClient
      .from('crm_contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email: normalizedEmail,
        type_of_contact: 'Customer',
        customer_id: customerId,
      })
      .select('id')
      .single()
    if (ctErr) return NextResponse.json({ error: 'Failed to create contact record' }, { status: 500 })
    contactId = newContact.id as string
  }

  const tagId = await ensureTag(adminClient, ATTENDED_TAG_NAME, ATTENDED_TAG_COLOR)
  await applyEntityTag(adminClient, tagId, contactId, 'contact')

  return NextResponse.json({ success: true, contact_id: contactId }, { status: 201 })
}
