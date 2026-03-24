import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireUser } from '@/lib/crm/require-user'
import { formatPhone } from '@/lib/phone'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s || null
}

function bool(v: unknown): boolean | null {
  const s = String(v ?? '').trim().toUpperCase()
  if (!s) return null
  if (s === 'TRUE' || s === 'YES' || s === '1') return true
  if (s === 'FALSE' || s === 'NO' || s === '0') return false
  return null
}

// OrganisationOwner format: "insightly_id;email@domain.com" — extract email
function extractOwnerEmail(owner: unknown): string | null {
  const s = str(owner)
  if (!s) return null
  const parts = s.split(';')
  return parts[1]?.trim() || null
}

// Map Company Type to CrmClientStatus
function mapClientStatus(row: Record<string, unknown>): string {
  const ct = str(row['Company Type'])?.toLowerCase()
  if (ct === 'prospect') return 'Prospective'
  // Customer, Customer Over $250K, Customer and Vendor, Other, blank → Active
  return 'Active'
}

const KNOWN_COMPANY_TYPES = new Set([
  'prospect', 'customer', 'vendor', 'customer and vendor', 'customer over $250k',
])

// Merge: new non-null value wins; otherwise keep existing
function merge<T>(newVal: T | null, existingVal: T | null | undefined): T | null {
  return newVal !== null ? newVal : (existingVal ?? null)
}

// ─── POST /api/admin/crm/import ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // ── Parse XLSX from multipart form ────────────────────────────────────────
  let rows: Record<string, unknown>[]
  let importType: 'vendors' | 'customers'
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const rawImportType = formData.get('importType') as string | null
    if (!rawImportType || (rawImportType !== 'vendors' && rawImportType !== 'customers')) {
      return NextResponse.json({ error: 'importType must be "vendors" or "customers"' }, { status: 400 })
    }
    importType = rawImportType

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return NextResponse.json({ error: 'No sheets found in workbook' }, { status: 400 })

    const sheet = workbook.Sheets[sheetName]
    // defval: '' ensures missing cells come back as empty string rather than undefined
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,      // return all values as strings (preserves phone/zip formatting)
    })
  } catch {
    return NextResponse.json({ error: 'Failed to parse Excel file' }, { status: 400 })
  }

  if (rows.length === 0) return NextResponse.json({ error: 'Spreadsheet is empty or has no data rows' }, { status: 400 })

  // ── Load users for owner email → UUID lookup ──────────────────────────────
  const { data: users } = await adminClient.from('users').select('id, email, display_name')
  const userByEmail = new Map<string, string>()
  for (const u of users ?? []) {
    if (u.email) userByEmail.set(u.email.toLowerCase(), u.id)
  }

  // ── Load existing records by insightly_id for COALESCE merge ─────────────
  const { data: existingCustomersRaw } = await adminClient
    .from('crm_customers')
    .select('*')
    .not('insightly_id', 'is', null)
  const existingCustomerMap = new Map<string, Record<string, unknown>>()
  for (const c of existingCustomersRaw ?? []) {
    if (c.insightly_id) existingCustomerMap.set(String(c.insightly_id), c)
  }

  const { data: existingVendorsRaw } = await adminClient
    .from('crm_vendors')
    .select('*')
    .not('insightly_id', 'is', null)
  const existingVendorMap = new Map<string, Record<string, unknown>>()
  for (const v of existingVendorsRaw ?? []) {
    if (v.insightly_id) existingVendorMap.set(String(v.insightly_id), v)
  }

  // ── Ensure required tags exist ─────────────────────────────────────────────
  const allTagNamesNeeded = new Set<string>()
  for (const row of rows) {
    for (const col of ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6', 'Tag7', 'Tag8', 'Tag9']) {
      const t = str(row[col])
      if (t) allTagNamesNeeded.add(t)
    }
    const ct = str(row['Company Type'])
    if (ct) {
      const ctL = ct.toLowerCase()
      if (ctL === 'customer over $250k') allTagNamesNeeded.add('Over $250K')
      else if (ctL === 'customer and vendor') allTagNamesNeeded.add(ct)
      else if (!KNOWN_COMPANY_TYPES.has(ctL)) allTagNamesNeeded.add(ct)
    }
  }

  const { data: existingTags } = await adminClient.from('crm_tags').select('id, name')
  const tagByName = new Map<string, string>()
  for (const t of existingTags ?? []) tagByName.set(t.name.toLowerCase(), t.id)

  let tagsCreated = 0
  const DEFAULT_COLORS: Record<string, string> = {
    'delete':          '#ef4444',
    'deleteerin':      '#f97316',
    'productshowcase': '#22c55e',
    'competitor':      '#64748b',
    'association':     '#3b82f6',
  }

  for (const tagName of allTagNamesNeeded) {
    if (!tagByName.has(tagName.toLowerCase())) {
      const color = DEFAULT_COLORS[tagName.toLowerCase()] ?? '#8b5cf6'
      const { data: newTag } = await adminClient
        .from('crm_tags')
        .insert({ name: tagName, color })
        .select('id, name')
        .single()
      if (newTag) {
        tagByName.set(newTag.name.toLowerCase(), newTag.id)
        tagsCreated++
      }
    }
  }

  // ── Process rows ──────────────────────────────────────────────────────────
  const customerUpserts: Record<string, unknown>[] = []
  const vendorUpserts: Record<string, unknown>[] = []
  const customerTagNames    = new Map<string, string[]>()
  const vendorTagNames      = new Map<string, string[]>()
  const customerAndVendorIds = new Set<string>()
  const unmatchedOwners     = new Set<string>()
  const errors: string[] = []

  for (const row of rows) {
    // RecordId may be a number in XLSX — always convert to string
    const insightlyId = str(row['RecordId'])
    if (!insightlyId) continue

    const ownerEmail = extractOwnerEmail(row['OrganisationOwner'])
    let assignedTo: string | null = null
    if (ownerEmail) {
      assignedTo = userByEmail.get(ownerEmail.toLowerCase()) ?? null
      if (!assignedTo) unmatchedOwners.add(ownerEmail)
    }

    const isCustomer = importType === 'customers'
    const isVendor   = importType === 'vendors'

    const rowTagNames: string[] = []
    for (const col of ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6', 'Tag7', 'Tag8', 'Tag9']) {
      const t = str(row[col])
      if (t) rowTagNames.push(t)
    }
    const ct = str(row['Company Type'])
    const ctLower = ct?.toLowerCase()
    if (ct) {
      if (ctLower === 'customer over $250k') rowTagNames.push('Over $250K')
      else if (ctLower === 'customer and vendor') rowTagNames.push(ct)
      else if (!KNOWN_COMPANY_TYPES.has(ctLower!)) rowTagNames.push(ct)
    }
    if (ctLower === 'customer and vendor') customerAndVendorIds.add(insightlyId)

    if (isCustomer) {
      const ex = existingCustomerMap.get(insightlyId)
      customerUpserts.push({
        insightly_id:       insightlyId,
        name:               str(row['OrganizationName']) ?? (ex as any)?.name ?? 'Unnamed',
        client_status:      merge(mapClientStatus(row), (ex as any)?.client_status),
        phone:              merge(formatPhone(str(row['Phone'])) ?? str(row['Phone']), (ex as any)?.phone),
        fax:                merge(str(row['Fax']), (ex as any)?.fax),
        website:            merge(str(row['Website']), (ex as any)?.website),
        email_domains:      merge(str(row['EmailDomain']), (ex as any)?.email_domains),
        billing_address1:   merge(str(row['BillingAddressStreet']), (ex as any)?.billing_address1),
        billing_city:       merge(str(row['BillingAddressCity']), (ex as any)?.billing_city),
        billing_state:      merge(str(row['BillingAddressState']), (ex as any)?.billing_state),
        billing_zip:        merge(str(row['BillingAddressPostalCode']), (ex as any)?.billing_zip),
        billing_country:    merge(str(row['BillingAddressCountry']), (ex as any)?.billing_country),
        shipping_address1:  merge(str(row['ShippingAddressStreet']), (ex as any)?.shipping_address1),
        shipping_city:      merge(str(row['ShippingAddressCity']), (ex as any)?.shipping_city),
        shipping_state:     merge(str(row['ShippingAddressState']), (ex as any)?.shipping_state),
        shipping_zip:       merge(str(row['ShippingAddressPostalCode']), (ex as any)?.shipping_zip),
        shipping_country:   merge(str(row['ShippingAddressCountry']), (ex as any)?.shipping_country),
        description:        merge(str(row['Background']), (ex as any)?.description),
        artwork_notes:      merge(str(row['Artwork Notes']), (ex as any)?.artwork_notes),
        general_logo_color: merge(str(row['General Logo Color']), (ex as any)?.general_logo_color),
        formal_pms_colors:  merge(str(row['Formal PMS Colors']), (ex as any)?.formal_pms_colors),
        industry:           merge(str(row['Industry']), (ex as any)?.industry),
        notes:              merge(str(row['Additional Information']), (ex as any)?.notes),
        power_units:        merge(str(row['Power Units / Trucks & Trailers']), (ex as any)?.power_units),
        mta:                merge(bool(row['MTA?']), (ex as any)?.mta),
        mta_trucking:       merge(str(row['MTA/Trucking']), (ex as any)?.mta_trucking),
        assigned_to:        assignedTo ?? (ex as any)?.assigned_to ?? null,
        created_by:         (ex as any)?.created_by ?? appUser.id,
        updated_at:         new Date().toISOString(),
      })
      customerTagNames.set(insightlyId, rowTagNames)
    }

    if (isVendor) {
      const ex = existingVendorMap.get(insightlyId)
      vendorUpserts.push({
        insightly_id:           insightlyId,
        name:                   str(row['OrganizationName']) ?? (ex as any)?.name ?? 'Unnamed',
        phone:                  merge(formatPhone(str(row['Phone'])) ?? str(row['Phone']), (ex as any)?.phone),
        fax:                    merge(str(row['Fax']), (ex as any)?.fax),
        website:                merge(str(row['Website']), (ex as any)?.website),
        description:            merge(str(row['Background']), (ex as any)?.description),
        premier_group_member:   merge(bool(row['Premier Group Member']), (ex as any)?.premier_group_member) ?? false,
        product_line:           merge(str(row['Product Line']), (ex as any)?.product_line),
        specialty:              merge(str(row['Speciality']), (ex as any)?.specialty),
        arcon_account_number:   merge(str(row['Arcon Account Number']), (ex as any)?.arcon_account_number),
        online_store:           merge(str(row['Online Store']), (ex as any)?.online_store),
        arcon_username:         merge(str(row['Arcon Username']), (ex as any)?.arcon_username),
        arcon_password:         merge(str(row['Arcon Password']), (ex as any)?.arcon_password),
        customer_service_email: merge(str(row['Customer Service Email']), (ex as any)?.customer_service_email),
        orders_email:           merge(str(row['Orders Email (and cutoff)']), (ex as any)?.orders_email),
        rush_order_email:       merge(str(row['Rush Order Email (and cutoff)']), (ex as any)?.rush_order_email),
        rush_art_email:         merge(str(row['Rush Art Email (and cutoff)']), (ex as any)?.rush_art_email),
        rush_art_cutoff:        merge(str(row['Rush Art Cutoff']), (ex as any)?.rush_art_cutoff),
        artwork_email:          merge(str(row['Artwork Email']), (ex as any)?.artwork_email),
        samples_email:          merge(str(row['Samples Email']), (ex as any)?.samples_email),
        virtuals_email:         merge(str(row['Virtuals Email']), (ex as any)?.virtuals_email),
        spec_sample_email:      merge(str(row['Spec Sample Email']), (ex as any)?.spec_sample_email),
        billing_address1:       merge(str(row['BillingAddressStreet']),      (ex as any)?.billing_address1),
        billing_address2:       merge(str(row['BillingAddressStreet2']),     (ex as any)?.billing_address2),
        billing_city:           merge(str(row['BillingAddressCity']),        (ex as any)?.billing_city),
        billing_state:          merge(str(row['BillingAddressState']),       (ex as any)?.billing_state),
        billing_zip:            merge(str(row['BillingAddressPostalCode']),  (ex as any)?.billing_zip),
        billing_country:        merge(str(row['BillingAddressCountry']),     (ex as any)?.billing_country),
        shipping_address1:      merge(str(row['ShippingAddressStreet']),     (ex as any)?.shipping_address1),
        shipping_address2:      merge(str(row['ShippingAddressStreet2']),    (ex as any)?.shipping_address2),
        shipping_city:          merge(str(row['ShippingAddressCity']),       (ex as any)?.shipping_city),
        shipping_state:         merge(str(row['ShippingAddressState']),      (ex as any)?.shipping_state),
        shipping_zip:           merge(str(row['ShippingAddressPostalCode']), (ex as any)?.shipping_zip),
        shipping_country:       merge(str(row['ShippingAddressCountry']),    (ex as any)?.shipping_country),
        industry:               merge(str(row['Industry']), (ex as any)?.industry),
        notes:                  merge(str(row['Additional Information']), (ex as any)?.notes),
        assigned_to:            assignedTo ?? (ex as any)?.assigned_to ?? null,
        created_by:             (ex as any)?.created_by ?? appUser.id,
        updated_at:             new Date().toISOString(),
      })
      vendorTagNames.set(insightlyId, rowTagNames)
    }
  }

  // ── Upsert in batches of 100 ──────────────────────────────────────────────
  const BATCH = 100
  let customersInserted = 0, customersUpdated = 0
  let vendorsInserted = 0,   vendorsUpdated = 0

  const prevCustomerIds = new Set(existingCustomerMap.keys())
  const prevVendorIds   = new Set(existingVendorMap.keys())

  for (let i = 0; i < customerUpserts.length; i += BATCH) {
    const chunk = customerUpserts.slice(i, i + BATCH)
    const { error } = await adminClient
      .from('crm_customers')
      .upsert(chunk as any, { onConflict: 'insightly_id' })
    if (error) {
      errors.push(`Customer batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      for (const r of chunk) {
        if (prevCustomerIds.has(r.insightly_id as string)) customersUpdated++
        else customersInserted++
      }
    }
  }

  for (let i = 0; i < vendorUpserts.length; i += BATCH) {
    const chunk = vendorUpserts.slice(i, i + BATCH)
    const { error } = await adminClient
      .from('crm_vendors')
      .upsert(chunk as any, { onConflict: 'insightly_id' })
    if (error) {
      errors.push(`Vendor batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      for (const r of chunk) {
        if (prevVendorIds.has(r.insightly_id as string)) vendorsUpdated++
        else vendorsInserted++
      }
    }
  }

  // ── Re-link tags for all imported entities ────────────────────────────────
  const fetchIds = async (table: string, ids: string[]) => {
    const map = new Map<string, string>()
    for (let i = 0; i < ids.length; i += 500) {
      const { data } = await adminClient
        .from(table)
        .select('id, insightly_id')
        .in('insightly_id', ids.slice(i, i + 500))
      for (const r of data ?? []) map.set(String(r.insightly_id), r.id)
    }
    return map
  }

  const importedCustIds   = customerUpserts.map(r => r.insightly_id as string)
  const importedVendorIds = vendorUpserts.map(r => r.insightly_id as string)

  const [custIdMap, vendorIdMap] = await Promise.all([
    importedCustIds.length > 0   ? fetchIds('crm_customers', importedCustIds)   : Promise.resolve(new Map()),
    importedVendorIds.length > 0 ? fetchIds('crm_vendors',   importedVendorIds) : Promise.resolve(new Map()),
  ])

  const custDbIds   = [...custIdMap.values()]
  const vendorDbIds = [...vendorIdMap.values()]

  // Delete old tag links, then re-insert from XLSX data
  for (let i = 0; i < custDbIds.length; i += 500) {
    await adminClient.from('crm_entity_tags').delete()
      .eq('entity_type', 'customer').in('entity_id', custDbIds.slice(i, i + 500))
  }
  for (let i = 0; i < vendorDbIds.length; i += 500) {
    await adminClient.from('crm_entity_tags').delete()
      .eq('entity_type', 'vendor').in('entity_id', vendorDbIds.slice(i, i + 500))
  }

  const tagLinkInserts: { tag_id: string; entity_type: string; entity_id: string }[] = []

  for (const [iid, tagNames] of customerTagNames) {
    const dbId = custIdMap.get(iid)
    if (!dbId) continue
    for (const tn of tagNames) {
      const tagId = tagByName.get(tn.toLowerCase())
      if (tagId) tagLinkInserts.push({ tag_id: tagId, entity_type: 'customer', entity_id: dbId })
    }
  }
  for (const [iid, tagNames] of vendorTagNames) {
    const dbId = vendorIdMap.get(iid)
    if (!dbId) continue
    for (const tn of tagNames) {
      const tagId = tagByName.get(tn.toLowerCase())
      if (tagId) tagLinkInserts.push({ tag_id: tagId, entity_type: 'vendor', entity_id: dbId })
    }
  }

  for (let i = 0; i < tagLinkInserts.length; i += BATCH) {
    const { error } = await adminClient.from('crm_entity_tags').insert(tagLinkInserts.slice(i, i + BATCH))
    if (error) errors.push(`Tag linking batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
  }

  // ── Link vendor records for "Customer and Vendor" customers ───────────────
  let vendorLinksSet = 0
  if (customerAndVendorIds.size > 0) {
    const { data: linkedVendors } = await adminClient
      .from('crm_vendors')
      .select('id, insightly_id')
      .in('insightly_id', [...customerAndVendorIds])
    const vendorDbByInsightlyId = new Map<string, string>()
    for (const v of linkedVendors ?? []) {
      if (v.insightly_id) vendorDbByInsightlyId.set(String(v.insightly_id), v.id)
    }
    for (const iid of customerAndVendorIds) {
      const custDbId   = custIdMap.get(iid)
      const vendorDbId = vendorDbByInsightlyId.get(iid)
      if (custDbId && vendorDbId) {
        const { error } = await adminClient
          .from('crm_customers')
          .update({ vendor_id: vendorDbId })
          .eq('id', custDbId)
        if (error) errors.push(`Vendor link for insightly_id ${iid}: ${error.message}`)
        else vendorLinksSet++
      }
    }
  }

  return NextResponse.json({
    customers:        { inserted: customersInserted, updated: customersUpdated },
    vendors:          { inserted: vendorsInserted,   updated: vendorsUpdated },
    tags_created:     tagsCreated,
    vendor_links_set: vendorLinksSet,
    unmatched_owners: [...unmatchedOwners].sort(),
    errors,
  })
}
