type TransferValue = string | boolean | null

export type AturianTransferField = {
  label: string
  value: TransferValue
  aturian_field_id?: string
}

export type AturianTransferPayload = {
  version: 1
  entityType: 'customer' | 'supplier'
  recordId: string
  recordName: string
  recordUrl: string
  exportedAt: string
  fields: Record<string, AturianTransferField>
}

type Contact = {
  first_name: string
  last_name: string
  title?: string | null
  email?: string | null
  phone?: string | null
  department?: string | null
}

type QueueTransferSource = {
  id: string
  company_name: string
  phone: string | null
  website: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  commissioned_client: string
  tax_exempt: boolean
  assigned_user: { display_name: string } | null
  orderer_first_name: string | null
  orderer_last_name: string | null
  orderer_email: string | null
  ap_first_name: string | null
  ap_last_name: string | null
  ap_email: string | null
}

type SupplierTransferSource = {
  id: string
  name: string
  phone: string | null
  website: string | null
  linkedin: string | null
  product_line: string | null
  specialty: string | null
  arcon_account_number: string | null
  customer_service_email: string | null
  orders_email: string | null
  billing_address1: string | null
  billing_address2: string | null
  billing_city: string | null
  billing_state: string | null
  billing_zip: string | null
  billing_country: string | null
  shipping_address1: string | null
  shipping_address2: string | null
  shipping_city: string | null
  shipping_state: string | null
  shipping_zip: string | null
  shipping_country: string | null
  contacts: Contact[]
}

function fullName(contact: Contact | null | undefined) {
  if (!contact) return null
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ') || null
}

function findContact(contacts: Contact[], needles: string[]) {
  return contacts.find((contact) => {
    const haystack = `${contact.department ?? ''} ${contact.title ?? ''}`.toLowerCase()
    return needles.some((needle) => haystack.includes(needle))
  }) ?? contacts[0] ?? null
}

function currentUrl() {
  if (typeof window === 'undefined') return ''
  return window.location.href
}

export function buildAturianQueuePayload(entry: QueueTransferSource): AturianTransferPayload {
  return {
    version: 1,
    entityType: 'customer',
    recordId: entry.id,
    recordName: entry.company_name,
    recordUrl: currentUrl(),
    exportedAt: new Date().toISOString(),
    fields: {
      company_name:       { label: 'Company Name',       value: entry.company_name },
      phone:              { label: 'Phone',               value: entry.phone },
      website:            { label: 'Website',             value: entry.website },
      address1:           { label: 'Address Line 1',      value: entry.address1 },
      address2:           { label: 'Address Line 2',      value: entry.address2 },
      city:               { label: 'City',                value: entry.city },
      state:              { label: 'State',               value: entry.state },
      zip:                { label: 'ZIP Code',            value: entry.zip },
      orderer_full_name:  { label: 'Orderer Name',        value: [entry.orderer_first_name, entry.orderer_last_name].filter(Boolean).join(' ') || null },
      orderer_first_name: { label: 'Orderer First Name',  value: entry.orderer_first_name },
      orderer_last_name:  { label: 'Orderer Last Name',   value: entry.orderer_last_name },
      orderer_email:      { label: 'Orderer Email',       value: entry.orderer_email },
      ap_first_name:      { label: 'AP First Name',       value: entry.ap_first_name },
      ap_last_name:       { label: 'AP Last Name',        value: entry.ap_last_name },
      ap_email:           { label: 'AP Email',            value: entry.ap_email },
    },
  }
}

export function buildSupplierAturianPayload(supplier: SupplierTransferSource): AturianTransferPayload {
  const accountsPayable = findContact(supplier.contacts, ['account', 'ap', 'payable', 'billing'])

  return {
    version: 1,
    entityType: 'supplier',
    recordId: supplier.id,
    recordName: supplier.name,
    recordUrl: currentUrl(),
    exportedAt: new Date().toISOString(),
    fields: {
      name: { label: 'Supplier Name', value: supplier.name },
      phone: { label: 'Phone', value: supplier.phone },
      website: { label: 'Website', value: supplier.website },
      linkedin: { label: 'LinkedIn', value: supplier.linkedin },
      product_line: { label: 'Product Line', value: supplier.product_line },
      specialty: { label: 'Specialty', value: supplier.specialty },
      arcon_account_number: { label: 'Arcon Account Number', value: supplier.arcon_account_number },
      customer_service_email: { label: 'Customer Service Email', value: supplier.customer_service_email },
      orders_email: { label: 'Orders Email', value: supplier.orders_email },
      billing_address1: { label: 'Billing Address 1', value: supplier.billing_address1 },
      billing_address2: { label: 'Billing Address 2', value: supplier.billing_address2 },
      billing_city: { label: 'Billing City', value: supplier.billing_city },
      billing_state: { label: 'Billing State', value: supplier.billing_state },
      billing_zip: { label: 'Billing ZIP', value: supplier.billing_zip },
      billing_country: { label: 'Billing Country', value: supplier.billing_country },
      shipping_address1: { label: 'Shipping Address 1', value: supplier.shipping_address1 },
      shipping_address2: { label: 'Shipping Address 2', value: supplier.shipping_address2 },
      shipping_city: { label: 'Shipping City', value: supplier.shipping_city },
      shipping_state: { label: 'Shipping State', value: supplier.shipping_state },
      shipping_zip: { label: 'Shipping ZIP', value: supplier.shipping_zip },
      shipping_country: { label: 'Shipping Country', value: supplier.shipping_country },
      ap_name: { label: 'AP Contact Name', value: fullName(accountsPayable) },
      ap_email: { label: 'AP Email', value: accountsPayable?.email ?? null },
      ap_phone: { label: 'AP Phone', value: accountsPayable?.phone ?? null },
    },
  }
}

export async function sendAturianTransferPayload(payload: AturianTransferPayload) {
  if (typeof window === 'undefined') return

  window.postMessage(
    {
      source: 'the-arc',
      type: 'ATURIAN_TRANSFER_PAYLOAD',
      payload,
    },
    window.location.origin
  )

  await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2)).catch(() => undefined)
}
