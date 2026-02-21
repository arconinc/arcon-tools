// ─── App User ───────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  email: string
  display_name: string
  google_id: string
  is_admin: boolean
  created_at: string
  last_login_at: string
}

// ─── Store ───────────────────────────────────────────────────────────────────

export interface Store {
  id: string
  store_id: string
  store_name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string
  user_id: string
  action: string
  store_id: string | null
  order_id: string | null
  details: Record<string, unknown>
  status: 'success' | 'error' | 'partial'
  created_at: string
  users?: { email: string; display_name: string }
}

// ─── PromoBullit API Types ────────────────────────────────────────────────────

export interface PromoOrder {
  id: string
  created: string
  modified: string | null
  customerName: string
  companyName: string | null
  status: string
  amount: string
  details: string
}

export interface PromoOrderDetail {
  id: string
  storeId: string
  customerId: string | null
  firstName: string
  lastName: string
  companyName: string | null
  billingEmail: string
  shippingEmail: string
  billingFirstName: string
  billingLastName: string
  billingAddress1: string
  billingCity: string
  billingPostalCode: string
  shippingFirstName: string
  shippingLastName: string
  shippingAddress1: string
  shippingCity: string
  shippingPostalCode: string
  telephone: string
  status: string
  amount: string
  created: string
  shipments: string
  products: string
  payments: string
  priceComponents: string
}

export interface PromoOrderProduct {
  id: string
  productId: string
  name: string
  sku: string
  quantity: string
  shippedQuantity: string
  subtotal: string
}

export interface PromoOrdersResponse {
  records: PromoOrder[]
  meta: {
    recordsFound: string
    page: string
    pageSize: string
  }
}

export interface ShipmentPayload {
  carrierId: string
  trackingNumber: string
  trackingUrl: string
  shipmentDate: string
}

export interface NotificationEmailPayload {
  id: string
  status: string
  notificationEmail: {
    subject: string
    body: string
    sendDate: string
  }
}

// ─── Task Card ────────────────────────────────────────────────────────────────

export interface TaskCard {
  id: string
  title: string
  description: string
  icon: string
  href: string
  enabled: boolean
}

// ─── Carrier ─────────────────────────────────────────────────────────────────

export interface Carrier {
  id: string
  name: string
  trackingUrlTemplate: string
}

export const CARRIERS: Carrier[] = [
  { id: 'Ups', name: 'UPS', trackingUrlTemplate: 'https://www.ups.com/track?tracknum={tracking}' },
  { id: 'Fedex', name: 'FedEx', trackingUrlTemplate: 'https://www.fedex.com/fedextrack/?tracknumbers={tracking}' },
  { id: 'USPS', name: 'USPS', trackingUrlTemplate: 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking}' },
  { id: 'DHL', name: 'DHL', trackingUrlTemplate: 'https://www.dhl.com/us-en/home/tracking.html?tracking-id={tracking}' },
  { id: 'CanadaPost', name: 'Canada Post', trackingUrlTemplate: 'https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor={tracking}' },
  { id: 'Other', name: 'Other', trackingUrlTemplate: '' },
]
