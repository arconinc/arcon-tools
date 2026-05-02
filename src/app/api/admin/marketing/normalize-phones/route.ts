import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatPhone } from '@/lib/phone'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: dbUser } = await adminClient
    .from('users')
    .select('is_admin')
    .eq('google_id', user.id)
    .single()
  if (!dbUser?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let customersUpdated = 0
  let vendorsUpdated = 0
  let contactsUpdated = 0
  let skipped = 0

  // ── Customers ──────────────────────────────────────────────────────────────
  const { data: customers } = await adminClient
    .from('crm_customers')
    .select('id, phone')
    .not('phone', 'is', null)

  for (const c of customers ?? []) {
    const formatted = formatPhone(c.phone)
    if (formatted && formatted !== c.phone) {
      await adminClient.from('crm_customers').update({ phone: formatted }).eq('id', c.id)
      customersUpdated++
    } else {
      skipped++
    }
  }

  // ── Vendors ────────────────────────────────────────────────────────────────
  const { data: vendors } = await adminClient
    .from('crm_vendors')
    .select('id, phone')
    .not('phone', 'is', null)

  for (const v of vendors ?? []) {
    const formatted = formatPhone(v.phone)
    if (formatted && formatted !== v.phone) {
      await adminClient.from('crm_vendors').update({ phone: formatted }).eq('id', v.id)
      vendorsUpdated++
    } else {
      skipped++
    }
  }

  // ── Contacts (4 phone fields) ──────────────────────────────────────────────
  const { data: contacts } = await adminClient
    .from('crm_contacts')
    .select('id, phone, home_phone, mobile_phone, other_phone')

  for (const c of contacts ?? []) {
    const updates: Record<string, string> = {}
    for (const field of ['phone', 'home_phone', 'mobile_phone', 'other_phone'] as const) {
      const raw = c[field]
      if (!raw) continue
      const formatted = formatPhone(raw)
      if (formatted && formatted !== raw) {
        updates[field] = formatted
      } else {
        skipped++
      }
    }
    if (Object.keys(updates).length > 0) {
      await adminClient.from('crm_contacts').update(updates).eq('id', c.id)
      contactsUpdated++
    }
  }

  return NextResponse.json({ customers: customersUpdated, vendors: vendorsUpdated, contacts: contactsUpdated, skipped })
}
