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

// ─── Opportunity field mappers ─────────────────────────────────────────────────

function mapOpportunityStatus(v: unknown): string {
  const s = str(v)?.toUpperCase()
  if (s === 'WON') return 'won'
  if (s === 'LOST') return 'lost'
  return 'open'
}

function mapPipelineStage(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const stages = ['Send Quote', 'Follow Up on Quote', 'Quote Accepted', 'Send Thank You Email']
  return stages.find(st => st.toLowerCase() === s.toLowerCase()) ?? null
}

function mapOpportunityCategory(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const cats = ['Apparel', 'Packaging Product', 'Print Product', 'Promotional Product', 'Signage', 'Store/Ecommerce Build']
  return cats.find(c => c.toLowerCase() === s.toLowerCase()) ?? null
}

function parseDate(v: unknown): string | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseNumber(v: unknown): number | null {
  const n = parseFloat(String(v ?? ''))
  return isNaN(n) ? null : n
}

// ─── POST /api/admin/crm/import ───────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const appUser = await requireUser()
  if (!appUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!appUser.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const adminClient = createAdminClient()

  // ── Parse XLSX from multipart form ────────────────────────────────────────
  let rows: Record<string, unknown>[]
  let importType: 'vendors' | 'customers' | 'opportunities' | 'contacts'
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const rawImportType = formData.get('importType') as string | null
    if (!rawImportType || (rawImportType !== 'vendors' && rawImportType !== 'customers' && rawImportType !== 'opportunities' && rawImportType !== 'contacts')) {
      return NextResponse.json({ error: 'importType must be "vendors", "customers", "opportunities", or "contacts"' }, { status: 400 })
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
  const userByDisplayName = new Map<string, string>()
  for (const u of users ?? []) {
    if (u.email) userByEmail.set(u.email.toLowerCase(), u.id)
    if (u.display_name) userByDisplayName.set(u.display_name.toLowerCase().trim(), u.id)
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

  const { data: existingOppsRaw } = await adminClient
    .from('crm_opportunities')
    .select('*')
    .not('insightly_id', 'is', null)
  const existingOppMap = new Map<string, Record<string, unknown>>()
  for (const o of existingOppsRaw ?? []) {
    if (o.insightly_id) existingOppMap.set(String(o.insightly_id), o)
  }

  const { data: existingContactsRaw } = await adminClient
    .from('crm_contacts')
    .select('*')
    .not('insightly_id', 'is', null)
  const existingContactMap = new Map<string, Record<string, unknown>>()
  for (const c of existingContactsRaw ?? []) {
    if (c.insightly_id) existingContactMap.set(String(c.insightly_id), c)
  }

  // ── Paginated fetch helper (bypasses Supabase default 1000-row limit) ────────
  async function fetchAllRows(table: string, columns: string): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = []
    const PAGE = 1000
    let from = 0
    while (true) {
      const { data } = await adminClient.from(table).select(columns).range(from, from + PAGE - 1)
      if (!data || data.length === 0) break
      all.push(...(data as unknown as Record<string, unknown>[]))
      if (data.length < PAGE) break
      from += PAGE
    }
    return all
  }

  // ── Load customers/vendors for org lookup (opportunities + contacts) ───────
  const customerByInsightlyId = new Map<string, string>()
  const customerByName = new Map<string, string>()
  const vendorByInsightlyId = new Map<string, string>()
  const vendorByName = new Map<string, string>()
  if (importType === 'opportunities' || importType === 'contacts') {
    const allCustomers = await fetchAllRows('crm_customers', 'id, name, insightly_id')
    for (const c of allCustomers) {
      if (c.insightly_id) customerByInsightlyId.set(String(c.insightly_id), c.id as string)
      if (c.name) customerByName.set((c.name as string).toLowerCase().trim(), c.id as string)
    }
  }
  if (importType === 'contacts') {
    const allVendors = await fetchAllRows('crm_vendors', 'id, name, insightly_id')
    for (const v of allVendors) {
      if (v.insightly_id) vendorByInsightlyId.set(String(v.insightly_id), v.id as string)
      if (v.name) vendorByName.set((v.name as string).toLowerCase().trim(), v.id as string)
    }
  }

  // ── Ensure required tags exist ─────────────────────────────────────────────
  const allTagNamesNeeded = new Set<string>()
  for (const row of rows) {
    const tagCols = importType === 'contacts'
      ? ['ContactTag1', 'ContactTag2', 'ContactTag3', 'ContactTag4', 'ContactTag5', 'ContactTag6', 'ContactTag7', 'ContactTag8', 'ContactTag9']
      : ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6', 'Tag7', 'Tag8', 'Tag9']
    for (const col of tagCols) {
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
  const opportunityUpserts: Record<string, unknown>[] = []
  const contactUpserts: Record<string, unknown>[] = []
  const customerTagNames    = new Map<string, string[]>()
  const vendorTagNames      = new Map<string, string[]>()
  const opportunityTagNames = new Map<string, string[]>()
  const contactTagNames     = new Map<string, string[]>()
  const customerAndVendorIds = new Set<string>()
  const unmatchedOwners     = new Set<string>()
  const unmatchedOrgs       = new Set<string>()
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
    const isContacts = importType === 'contacts'
    const tagCols = isContacts
      ? ['ContactTag1', 'ContactTag2', 'ContactTag3', 'ContactTag4', 'ContactTag5', 'ContactTag6', 'ContactTag7', 'ContactTag8', 'ContactTag9']
      : ['Tag1', 'Tag2', 'Tag3', 'Tag4', 'Tag5', 'Tag6', 'Tag7', 'Tag8', 'Tag9']
    for (const col of tagCols) {
      const t = str(row[col])
      if (t) rowTagNames.push(t)
    }
    const ct = str(row['Company Type'])
    const ctLower = ct?.toLowerCase()
    if (!isContacts && ct) {
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

    if (importType === 'opportunities') {
      const orgInsightlyId = str(row['OrganizationId'])
      const orgName = str(row['OrganizationName'])
      let customerId = orgInsightlyId ? customerByInsightlyId.get(orgInsightlyId) ?? null : null
      if (!customerId && orgName) customerId = customerByName.get(orgName.toLowerCase().trim()) ?? null
      if (!customerId) {
        unmatchedOrgs.add(orgName ?? orgInsightlyId ?? insightlyId)
        continue
      }

      const assignedEmail  = extractOwnerEmail(row['UserResponsibleEmailAddress'])
      const csrEmail       = extractOwnerEmail(row['CSR'])
      const designerEmail  = extractOwnerEmail(row['Designer'])
      const oppAssignedTo     = assignedEmail  ? userByEmail.get(assignedEmail.toLowerCase())  ?? null : null
      const csrUserId         = csrEmail       ? userByEmail.get(csrEmail.toLowerCase())       ?? null : null
      const designerUserId    = designerEmail  ? userByEmail.get(designerEmail.toLowerCase())  ?? null : null
      if (assignedEmail  && !oppAssignedTo)    unmatchedOwners.add(assignedEmail)
      if (csrEmail       && !csrUserId)        unmatchedOwners.add(csrEmail)
      if (designerEmail  && !designerUserId)   unmatchedOwners.add(designerEmail)

      const ex = existingOppMap.get(insightlyId)
      opportunityUpserts.push({
        insightly_id:        insightlyId,
        name:                str(row['OpportunityName']) ?? (ex as any)?.name ?? 'Unnamed',
        customer_id:         customerId,
        description:         merge(str(row['Details']), (ex as any)?.description),
        probability:         merge(parseNumber(row['Probability']), (ex as any)?.probability),
        value:               merge(parseNumber(row['BidAmount']), (ex as any)?.value),
        bid_currency:        merge(str(row['BidCurrency']), (ex as any)?.bid_currency),
        bid_type:            merge(str(row['BidType']), (ex as any)?.bid_type),
        bid_duration:        merge(str(row['BidDuration']), (ex as any)?.bid_duration),
        forecast_close_date: merge(parseDate(row['ForecastCloseDate']), (ex as any)?.forecast_close_date),
        closed_at:           merge(parseDate(row['ActualCloseDate']), (ex as any)?.closed_at),
        last_activity_date:  merge(parseDate(row['DateOfLastActivity']), (ex as any)?.last_activity_date),
        next_activity_date:  merge(parseDate(row['DateOfNextActivity']), (ex as any)?.next_activity_date),
        pipeline_stage:      merge(mapPipelineStage(row['PipelineCurrentStage']), (ex as any)?.pipeline_stage),
        pipeline_name:       merge(str(row['PipelineName']), (ex as any)?.pipeline_name),
        category:            merge(mapOpportunityCategory(row['OpportunityCategory']), (ex as any)?.category),
        status:              merge(mapOpportunityStatus(row['CurrentState']), (ex as any)?.status) ?? 'open',
        status_reason:       merge(str(row['LastStateChangeReason']), (ex as any)?.status_reason),
        assigned_to:         oppAssignedTo ?? (ex as any)?.assigned_to ?? null,
        csr_user_id:         csrUserId ?? (ex as any)?.csr_user_id ?? null,
        designer_user_id:    designerUserId ?? (ex as any)?.designer_user_id ?? null,
        created_by:          (ex as any)?.created_by ?? appUser.id,
        updated_at:          new Date().toISOString(),
      })
      opportunityTagNames.set(insightlyId, rowTagNames)
    }

    if (importType === 'contacts') {
      const orgInsightlyId = str(row['OrganizationRecordId'])
      const orgName = str(row['Organization'])?.toLowerCase().trim()

      // Try to link to customer
      let contactCustomerId = orgInsightlyId ? customerByInsightlyId.get(orgInsightlyId) ?? null : null
      if (!contactCustomerId && orgName) contactCustomerId = customerByName.get(orgName) ?? null

      // Try to link to vendor
      let contactVendorId = orgInsightlyId ? vendorByInsightlyId.get(orgInsightlyId) ?? null : null
      if (!contactVendorId && orgName) contactVendorId = vendorByName.get(orgName) ?? null

      if (!contactCustomerId && !contactVendorId && (orgInsightlyId || orgName)) {
        unmatchedOrgs.add(str(row['Organization']) ?? orgInsightlyId ?? insightlyId)
      }

      // Map type_of_contact to valid enum values
      const rawType = str(row['Type of Contact'])
      const VALID_CONTACT_TYPES = new Set(['Customer', 'Vendor', 'Prospect', 'Partner', 'Other'])
      const typeOfContact = rawType && VALID_CONTACT_TYPES.has(rawType) ? rawType : 'Other'

      // arcon_salesperson: "insightly_id;email@domain.com" format → look up by email
      const arconSalespersonEmail = extractOwnerEmail(row['Arcon Salesperson'])
      const arconSalespersonId = arconSalespersonEmail
        ? userByEmail.get(arconSalespersonEmail.toLowerCase()) ?? null
        : null
      if (arconSalespersonEmail && !arconSalespersonId) unmatchedOwners.add(arconSalespersonEmail)

      // contact_owner: plain display name → look up by display_name
      const contactOwnerName = str(row['ContactOwner'])
      const contactOwnerId = contactOwnerName
        ? userByDisplayName.get(contactOwnerName.toLowerCase().trim()) ?? null
        : null

      const ex = existingContactMap.get(insightlyId)
      contactUpserts.push({
        insightly_id:            insightlyId,
        first_name:              str(row['FirstName']) ?? (ex as any)?.first_name ?? '',
        last_name:               str(row['LastName']) ?? (ex as any)?.last_name ?? '',
        salutation:              merge(str(row['Salutation']), (ex as any)?.salutation),
        title:                   merge(str(row['Role']), (ex as any)?.title),
        email:                   merge(str(row['EmailAddress']), (ex as any)?.email),
        phone:                   merge(formatPhone(str(row['BusinessPhone'])) ?? str(row['BusinessPhone']), (ex as any)?.phone),
        home_phone:              merge(str(row['HomePhone']), (ex as any)?.home_phone),
        mobile_phone:            merge(str(row['MobilePhone']), (ex as any)?.mobile_phone),
        other_phone:             merge(str(row['OtherPhone']), (ex as any)?.other_phone),
        fax:                     merge(str(row['Fax']), (ex as any)?.fax),
        assistant_phone:         merge(str(row['AssistantPhone']), (ex as any)?.assistant_phone),
        assistant_name:          merge(str(row['AssistantName']), (ex as any)?.assistant_name),
        linkedin:                merge(str(row['LinkedIn URL']), (ex as any)?.linkedin),
        mailing_address1:        merge(str(row['MailAddressStreet']), (ex as any)?.mailing_address1),
        mailing_city:            merge(str(row['MailAddressCity']), (ex as any)?.mailing_city),
        mailing_state:           merge(str(row['MailAddressState']), (ex as any)?.mailing_state),
        mailing_zip:             merge(str(row['MailAddressPostalCode']), (ex as any)?.mailing_zip),
        mailing_country:         merge(str(row['MailAddressCountry']), (ex as any)?.mailing_country),
        other_address1:          merge(str(row['OtherAddressStreet']), (ex as any)?.other_address1),
        other_city:              merge(str(row['OtherAddressCity']), (ex as any)?.other_city),
        other_state:             merge(str(row['OtherAddressState']), (ex as any)?.other_state),
        other_zip:               merge(str(row['OtherAddressPostalCode']), (ex as any)?.other_zip),
        other_country:           merge(str(row['OtherAddressCountry']), (ex as any)?.other_country),
        description:             merge(str(row['Background']), (ex as any)?.description),
        industry:                merge(str(row['Industry']), (ex as any)?.industry),
        type_of_contact:         typeOfContact,
        products_purchased:      merge(str(row['Products Purchased']), (ex as any)?.products_purchased),
        organization_website:    merge(str(row['Organization Website']), (ex as any)?.organization_website),
        arcon_salesperson:       arconSalespersonId ?? (ex as any)?.arcon_salesperson ?? null,
        contact_owner:           contactOwnerId ?? (ex as any)?.contact_owner ?? null,
        date_of_birth:           merge(str(row['DateOfBirth']), (ex as any)?.date_of_birth),
        email_opted_out:         merge(bool(row['EmailOptedOut']), (ex as any)?.email_opted_out),
        important_date_1_name:   merge(str(row['ImportantDate1Name']), (ex as any)?.important_date_1_name),
        important_date_1:        merge(parseDate(row['ImportantDate1']), (ex as any)?.important_date_1),
        important_date_2_name:   merge(str(row['ImportantDate2Name']), (ex as any)?.important_date_2_name),
        important_date_2:        merge(parseDate(row['ImportantDate2']), (ex as any)?.important_date_2),
        important_date_3_name:   merge(str(row['ImportantDate3Name']), (ex as any)?.important_date_3_name),
        important_date_3:        merge(parseDate(row['ImportantDate3']), (ex as any)?.important_date_3),
        last_activity_date:      merge(parseDate(row['DateOfLastActivity']), (ex as any)?.last_activity_date),
        next_activity_date:      merge(parseDate(row['DateOfNextActivity']), (ex as any)?.next_activity_date),
        profile_segmentation:    merge(str(row['Profile Segmentation']), (ex as any)?.profile_segmentation),
        product_showcase_invite: merge(str(row['Product Showcase Invite']), (ex as any)?.product_showcase_invite),
        customer_id:             contactCustomerId ?? (ex as any)?.customer_id ?? null,
        vendor_id:               contactVendorId ?? (ex as any)?.vendor_id ?? null,
        created_by:              (ex as any)?.created_by ?? appUser.id,
        updated_at:              new Date().toISOString(),
      })
      contactTagNames.set(insightlyId, rowTagNames)
    }
  }

  // ── Upsert in batches of 100 ──────────────────────────────────────────────
  const BATCH = 100
  let customersInserted = 0, customersUpdated = 0
  let vendorsInserted = 0,   vendorsUpdated = 0
  let opportunitiesInserted = 0, opportunitiesUpdated = 0
  let contactsInserted = 0,  contactsUpdated = 0

  const prevCustomerIds  = new Set(existingCustomerMap.keys())
  const prevVendorIds    = new Set(existingVendorMap.keys())
  const prevContactIds   = new Set(existingContactMap.keys())

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

  const prevOppIds = new Set(existingOppMap.keys())
  for (let i = 0; i < opportunityUpserts.length; i += BATCH) {
    const chunk = opportunityUpserts.slice(i, i + BATCH)
    const { error } = await adminClient
      .from('crm_opportunities')
      .upsert(chunk as any, { onConflict: 'insightly_id' })
    if (error) {
      errors.push(`Opportunity batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      for (const r of chunk) {
        if (prevOppIds.has(r.insightly_id as string)) opportunitiesUpdated++
        else opportunitiesInserted++
      }
    }
  }

  for (let i = 0; i < contactUpserts.length; i += BATCH) {
    const chunk = contactUpserts.slice(i, i + BATCH)
    const { error } = await adminClient
      .from('crm_contacts')
      .upsert(chunk as any, { onConflict: 'insightly_id' })
    if (error) {
      errors.push(`Contact batch ${Math.floor(i / BATCH) + 1}: ${error.message}`)
    } else {
      for (const r of chunk) {
        if (prevContactIds.has(r.insightly_id as string)) contactsUpdated++
        else contactsInserted++
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

  const importedCustIds     = customerUpserts.map(r => r.insightly_id as string)
  const importedVendorIds   = vendorUpserts.map(r => r.insightly_id as string)
  const importedOppIds      = opportunityUpserts.map(r => r.insightly_id as string)
  const importedContactIds  = contactUpserts.map(r => r.insightly_id as string)

  const [custIdMap, vendorIdMap, oppIdMap, contactIdMap] = await Promise.all([
    importedCustIds.length > 0    ? fetchIds('crm_customers',    importedCustIds)    : Promise.resolve(new Map()),
    importedVendorIds.length > 0  ? fetchIds('crm_vendors',      importedVendorIds)  : Promise.resolve(new Map()),
    importedOppIds.length > 0     ? fetchIds('crm_opportunities', importedOppIds)     : Promise.resolve(new Map()),
    importedContactIds.length > 0 ? fetchIds('crm_contacts',     importedContactIds) : Promise.resolve(new Map()),
  ])

  const custDbIds    = [...custIdMap.values()]
  const vendorDbIds  = [...vendorIdMap.values()]
  const oppDbIds     = [...oppIdMap.values()]
  const contactDbIds = [...contactIdMap.values()]

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

  for (let i = 0; i < oppDbIds.length; i += 500) {
    await adminClient.from('crm_entity_tags').delete()
      .eq('entity_type', 'opportunity').in('entity_id', oppDbIds.slice(i, i + 500))
  }
  for (const [iid, tagNames] of opportunityTagNames) {
    const dbId = oppIdMap.get(iid)
    if (!dbId) continue
    for (const tn of tagNames) {
      const tagId = tagByName.get(tn.toLowerCase())
      if (tagId) tagLinkInserts.push({ tag_id: tagId, entity_type: 'opportunity', entity_id: dbId })
    }
  }

  for (let i = 0; i < contactDbIds.length; i += 500) {
    await adminClient.from('crm_entity_tags').delete()
      .eq('entity_type', 'contact').in('entity_id', contactDbIds.slice(i, i + 500))
  }
  for (const [iid, tagNames] of contactTagNames) {
    const dbId = contactIdMap.get(iid)
    if (!dbId) continue
    for (const tn of tagNames) {
      const tagId = tagByName.get(tn.toLowerCase())
      if (tagId) tagLinkInserts.push({ tag_id: tagId, entity_type: 'contact', entity_id: dbId })
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
    customers:        { inserted: customersInserted,    updated: customersUpdated },
    vendors:          { inserted: vendorsInserted,      updated: vendorsUpdated },
    opportunities:    { inserted: opportunitiesInserted, updated: opportunitiesUpdated },
    contacts:         { inserted: contactsInserted,     updated: contactsUpdated },
    tags_created:     tagsCreated,
    vendor_links_set: vendorLinksSet,
    unmatched_owners: [...unmatchedOwners].sort(),
    unmatched_orgs:   [...unmatchedOrgs].sort(),
    errors,
  })
}
