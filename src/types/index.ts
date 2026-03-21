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
  source: 'birthday' | 'anniversary' | 'news' | 'holiday' | 'manual'
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
  manual_items: TickerManualItem[]
  updated_at: string
}

// ─── Countdown ────────────────────────────────────────────────────────────────

export interface CountdownConfig {
  id: string
  enabled: boolean
  label: string
  target_date: string   // ISO timestamp (TIMESTAMPTZ)
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

// ─── CRM ─────────────────────────────────────────────────────────────────────

export interface CrmTag {
  id: string
  name: string
  color: string
  created_at: string
}

export type CrmClientStatus = 'Prospective' | 'Active' | 'Former'
export type CrmContactType = 'Customer' | 'Vendor' | 'Prospect' | 'Partner' | 'Other'
export type CrmOpportunityStatus = 'open' | 'won' | 'lost' | 'stalled'
export type CrmPipelineStage = 'Send Quote' | 'Follow Up on Quote' | 'Quote Accepted' | 'Send Thank You Email'
export type CrmOpportunityCategory = 'Apparel' | 'Packaging Product' | 'Print Product' | 'Promotional Product' | 'Signage' | 'Store/Ecommerce Build'
export type CrmTaskStatus = 'not_started' | 'in_progress' | 'completed' | 'waiting_on_approval' | 'waiting_on_client_approval' | 'need_changes'
export type CrmTaskPriority = 'low' | 'medium' | 'high'
export type CrmTaskCategory =
  | 'Art Order' | 'Art Proactive Prospecting' | 'Art Rush - Drop Everything'
  | 'Art Rush - EOD' | 'Art Store Mocks' | 'Art Waiting on Approval'
  | 'CSR Order' | 'CSR Rush' | 'CSR To Do' | 'In Progress' | 'Need Changes'
  | 'Need Content' | 'Store/Ecommerce Adds' | 'Store/Ecommerce Refresh'
  | 'Store/Ecommerce QDesign' | 'Store/Ecommerce Update' | 'To Do General'
  | 'Waiting On Approval' | 'Waiting On Client Approval'
  | 'Warehouse Fulfillment' | 'Warehouse Knitting' | 'Warehouse Ship' | 'Warehouse To Do'

export interface CrmCustomer {
  id: string
  name: string
  client_status: CrmClientStatus | null
  phone: string | null
  website: string | null
  linkedin: string | null
  email_domains: string | null
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
  description: string | null
  tags: string[]
  artwork_notes: string | null
  general_logo_color: string | null
  formal_pms_colors: string | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CrmVendor {
  id: string
  name: string
  phone: string | null
  website: string | null
  linkedin: string | null
  description: string | null
  tags: string[]
  premier_group_member: boolean
  product_line: string | null
  specialty: string | null
  arcon_account_number: string | null
  online_store: string | null
  arcon_username: string | null
  arcon_password: string | null
  customer_service_email: string | null
  orders_email: string | null
  orders_cutoff: string | null
  rush_order_email: string | null
  rush_order_cutoff: string | null
  rush_art_email: string | null
  artwork_email: string | null
  samples_email: string | null
  virtuals_email: string | null
  spec_sample_email: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CrmContact {
  id: string
  first_name: string
  last_name: string
  title: string | null
  email: string | null
  phone: string | null
  home_phone: string | null
  mobile_phone: string | null
  other_phone: string | null
  linkedin: string | null
  mailing_address1: string | null
  mailing_address2: string | null
  mailing_city: string | null
  mailing_state: string | null
  mailing_zip: string | null
  mailing_country: string | null
  other_address1: string | null
  other_address2: string | null
  other_city: string | null
  other_state: string | null
  other_zip: string | null
  other_country: string | null
  description: string | null
  industry: string | null
  type_of_contact: CrmContactType
  products_purchased: string | null
  organization_website: string | null
  arcon_salesperson: string | null
  contact_owner: string | null
  tags: string[]
  customer_id: string | null
  vendor_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CrmOpportunity {
  id: string
  name: string
  customer_id: string
  assigned_to: string | null
  pipeline_stage: CrmPipelineStage | null
  value: number | null
  probability: number | null
  status: CrmOpportunityStatus
  status_reason: string | null
  category: CrmOpportunityCategory | null
  forecast_close_date: string | null
  description: string | null
  closed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CrmOpportunityStageHistory {
  id: string
  opportunity_id: string
  pipeline_stage: CrmPipelineStage | null
  status: CrmOpportunityStatus | null
  value: number | null
  probability: number | null
  forecast_close_date: string | null
  changed_by: string
  changed_at: string
}

export interface CrmTask {
  id: string
  title: string
  assigned_to: string | null
  task_owner: string | null
  category: CrmTaskCategory | null
  priority: CrmTaskPriority
  due_date: string | null
  status: CrmTaskStatus
  progress: number
  description: string | null
  opportunity_id: string | null
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface CrmTaskComment {
  id: string
  task_id: string
  user_id: string
  comment: string
  created_at: string
  updated_at: string
}

export interface CrmCommentAttachment {
  id: string
  comment_id: string
  label: string
  url: string
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  is_drive_link: boolean
  uploaded_by: string
  created_at: string
}

export interface CrmTaskHistory {
  id: string
  task_id: string
  user_id: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  changed_at: string
}

export interface CrmFile {
  id: string
  label: string
  url: string
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
  opportunity_id: string | null
  added_by: string
  created_at: string
}

export interface CrmSalesGoal {
  id: string
  user_id: string
  year: number
  month: number
  goal_amount: number
  created_at: string
  updated_at: string
}

// WithRelations detail variants

export interface CrmCustomerDetail extends CrmCustomer {
  contacts: CrmContact[]
  opportunities: CrmOpportunity[]
  files: CrmFile[]
  assigned_user: { id: string; display_name: string; email: string } | null
  created_by_user: { id: string; display_name: string; email: string } | null
}

export interface CrmVendorDetail extends CrmVendor {
  contacts: CrmContact[]
  files: CrmFile[]
}

export interface CrmContactDetail extends CrmContact {
  customer: CrmCustomer | null
  vendor: CrmVendor | null
}

export interface CrmOpportunityDetail extends CrmOpportunity {
  customer: { id: string; name: string } | null
  assigned_user: { id: string; display_name: string; email: string } | null
  tasks: CrmTask[]
  stage_history: CrmOpportunityStageHistory[]
  files: CrmFile[]
}

export interface CrmTaskDetail extends CrmTask {
  comments: (CrmTaskComment & {
    attachments: CrmCommentAttachment[]
    user: { id: string; display_name: string; avatar_url?: string | null }
  })[]
  history: (CrmTaskHistory & { user: { id: string; display_name: string } })[]
  opportunity: { id: string; name: string } | null
  customer: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  contact: { id: string; first_name: string; last_name: string } | null
  assigned_user: { id: string; display_name: string; email: string } | null
}
