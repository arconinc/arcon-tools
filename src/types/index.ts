// ─── App User ───────────────────────────────────────────────────────────────

export interface AppUser {
  id: string
  email: string
  display_name: string
  google_id: string | null
  is_admin: boolean
  created_at: string
  last_login_at: string
  birth_date: string | null   // MM-DD (no year, PII)
  start_date: string | null   // YYYY-MM-DD hire date
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
}

export interface BirthdayEvent {
  id: string
  name: string
  initials: string
  type: 'birthday' | 'anniversary'
  days_until: number
  date_label: string   // e.g. "Mar 15" or "Today"
  years?: number       // years of service (anniversaries only)
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

// ─── Banner ───────────────────────────────────────────────────────────────────

export interface BannerSlide {
  id: string
  pre_heading: string
  headline: string
  emoji: string
  subhead: string
  bg_type: 'gradient' | 'image'
  bg_gradient: 'hs-1' | 'hs-2' | 'hs-3' | 'hs-4' | 'hs-5'
  bg_image_url: string | null
}

export interface BannerConfig {
  id: string
  status: 'draft' | 'published'
  slides_json: BannerSlide[]
  updated_at: string
}

// ─── News & Announcements ─────────────────────────────────────────────────────

export type ArticleType = 'COMPANY' | 'HR' | 'SALES' | 'IT' | 'FINANCE' | 'OPERATIONS' | 'GENERAL'
export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface NewsArticle {
  id: string
  title: string
  type: ArticleType
  status: ArticleStatus
  content_json: Record<string, unknown>
  content_html: string | null
  excerpt: string | null
  cover_image_url: string | null
  pinned: boolean
  reading_time_minutes: number | null
  publish_date: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface NewsArticleWithAuthor extends NewsArticle {
  author: {
    id: string
    display_name: string
    email: string
  }
}

export interface NewsArticleSummary {
  id: string
  title: string
  type: ArticleType
  excerpt: string | null
  cover_image_url: string | null
  pinned: boolean
  reading_time_minutes: number | null
  publish_date: string | null
  author_name: string
}

export interface NewsArticlePayload {
  title: string
  type: ArticleType
  status: ArticleStatus
  content_json: Record<string, unknown>
  content_html: string
  cover_image_url?: string | null
  pinned?: boolean
  publish_date?: string | null
}

// ─── Banner Strip (Ticker) ────────────────────────────────────────────────────

export interface BannerStripItem {
  id: string
  label: string
  text: string
  href?: string | null
  source: 'birthday' | 'anniversary' | 'news' | 'holiday' | 'clickup' | 'manual'
}

export interface TickerManualItem {
  id: string
  label: string
  text: string
  href: string | null
  active_from: string | null   // ISO date YYYY-MM-DD
  active_until: string | null  // ISO date YYYY-MM-DD
  enabled: boolean
}

export interface TickerConfig {
  id: string
  show_birthdays: boolean
  birthday_window_days: number
  show_anniversaries: boolean
  anniversary_window_days: number
  show_news: boolean
  news_recency_days: number
  show_holidays: boolean
  holiday_lookahead_days: number
  show_clickup: boolean
  clickup_api_key: string | null
  clickup_list_id: string | null
  clickup_due_within_days: number
  manual_items: TickerManualItem[]
  updated_at: string
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
