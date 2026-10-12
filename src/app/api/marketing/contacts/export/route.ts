import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { unauthorized, badRequest, serverError } from '@/lib/api/respond'

const CONTACT_COLS = [
  'first_name', 'last_name', 'salutation', 'title', 'department', 'email', 'phone', 'mobile_phone', 'home_phone',
  'other_phone', 'fax', 'assistant_name', 'assistant_phone', 'linkedin', 'type_of_contact', 'industry',
  'products_purchased', 'organization_website', 'profile_segmentation', 'product_showcase_invite', 'email_opted_out',
  'mailing_address1', 'mailing_address2', 'mailing_city', 'mailing_state', 'mailing_zip', 'mailing_country',
  'other_address1', 'other_address2', 'other_city', 'other_state', 'other_zip', 'other_country',
  'description', 'created_at', 'updated_at',
]

// Vendor arcon_username / arcon_password intentionally excluded.
const ORG_COLS = [
  'name', 'phone', 'fax', 'website', 'linkedin', 'industry', 'description',
  'billing_address1', 'billing_address2', 'billing_city', 'billing_state', 'billing_zip', 'billing_country',
  'shipping_address1', 'shipping_address2', 'shipping_city', 'shipping_state', 'shipping_zip', 'shipping_country',
]
const CUSTOMER_EXTRA = ['client_status', 'email_domains']
const VENDOR_EXTRA = ['specialty', 'product_line', 'customer_service_email', 'orders_email']

const CHUNK = 200

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v)
  if (/^[=@]|^[+-]\D/.test(s)) s = `'${s}` // block spreadsheet formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function fetchByIds(adminClient: ReturnType<typeof createAdminClient>, table: string, ids: string[]) {
  const rows: any[] = []
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await adminClient.from(table).select('*').in('id', ids.slice(i, i + CHUNK))
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
  }
  return rows
}

// GET /api/marketing/contacts/export?tag_id=<id>
export async function GET(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return unauthorized()

  const tagId = new URL(req.url).searchParams.get('tag_id')
  if (!tagId) return badRequest('tag_id is required')

  const adminClient = createAdminClient()

  try {
    const { data: tag } = await adminClient.from('crm_tags').select('name').eq('id', tagId).single()
    if (!tag) return badRequest('Unknown tag')

    const contactIds: string[] = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await adminClient
        .from('crm_entity_tags')
        .select('entity_id')
        .eq('tag_id', tagId)
        .eq('entity_type', 'contact')
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      contactIds.push(...(data ?? []).map((r: any) => r.entity_id))
      if ((data ?? []).length < 1000) break
    }

    const contacts = await fetchByIds(adminClient, 'crm_contacts', contactIds)
    contacts.sort((a, b) => (a.last_name + a.first_name).localeCompare(b.last_name + b.first_name))

    const customerIds = [...new Set(contacts.map((c) => c.customer_id).filter(Boolean))] as string[]
    const vendorIds = [...new Set(contacts.map((c) => c.vendor_id).filter(Boolean))] as string[]
    const [customers, vendors] = await Promise.all([
      fetchByIds(adminClient, 'crm_customers', customerIds),
      fetchByIds(adminClient, 'crm_vendors', vendorIds),
    ])
    const customerMap = new Map(customers.map((c) => [c.id, c]))
    const vendorMap = new Map(vendors.map((v) => [v.id, v]))

    const header = [
      ...CONTACT_COLS,
      ...ORG_COLS.map((c) => `customer_${c}`), ...CUSTOMER_EXTRA.map((c) => `customer_${c}`),
      ...ORG_COLS.map((c) => `vendor_${c}`), ...VENDOR_EXTRA.map((c) => `vendor_${c}`),
    ]
    const lines = [header.join(',')]
    for (const c of contacts) {
      const cust = c.customer_id ? customerMap.get(c.customer_id) : undefined
      const vend = c.vendor_id ? vendorMap.get(c.vendor_id) : undefined
      lines.push([
        ...CONTACT_COLS.map((k) => c[k]),
        ...[...ORG_COLS, ...CUSTOMER_EXTRA].map((k) => cust?.[k]),
        ...[...ORG_COLS, ...VENDOR_EXTRA].map((k) => vend?.[k]),
      ].map(csvCell).join(','))
    }

    const slug = tag.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tag'
    return new NextResponse('﻿' + lines.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="contacts-${slug}.csv"`,
      },
    })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : 'Export failed')
  }
}
