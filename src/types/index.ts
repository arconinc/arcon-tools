// ─── App User ───────────────────────────────────────────────────────────────

export type OfficeLocation = 'Remote' | 'Minnesota' | 'Arizona' | 'Colorado'
export type EmploymentType = 'full-time' | 'part-time' | 'contractor'

export interface AppUser {
  id: string
  email: string
  display_name: string
  google_id: string | null
  is_admin: boolean
  avatar_url: string | null
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
  clickup_user_id: string | null
  roles: string[]
  department: string[] | null
  // Employee profile fields
  manager_id: string | null
  profile_image_url: string | null
  job_title: string | null
  office_location: OfficeLocation | null
  employment_type: EmploymentType | null
  bio_json: Record<string, unknown>
  bio_html: string | null
  skills: string[]
  interests: string[]
  linkedin_url: string | null
  timezone: string | null
  deactivated_at: string | null
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export type GroupCapabilityKey = 'access_control' | 'assignment_pool'

export type GroupSourceType = 'manual' | 'department' | 'role' | 'assignment_pool'

export type GroupMembershipSource = 'manual' | 'department' | 'role' | 'opportunity_assignment'

export interface Group {
  id: string
  key: string
  name: string
  description: string | null
  color: string
  is_system: boolean
  is_active: boolean
  sort_order: number
  source_type: GroupSourceType
  source_id: string | null
  created_at: string
  updated_at: string
}

export interface GroupMembership {
  id: string
  group_id: string
  user_id: string
  source: GroupMembershipSource
  assigned_by: string | null
  assigned_at: string
}

export interface GroupCapability {
  id: string
  group_id: string
  capability: GroupCapabilityKey
  config: Record<string, unknown>
  created_at: string
}

// ─── Employee Directory ──────────────────────────────────────────────────────

export interface EmployeeSummary {
  id: string
  display_name: string
  email: string
  job_title: string | null
  department: string[] | null
  office_location: OfficeLocation | null
  employment_type: EmploymentType | null
  profile_image_url: string | null
  avatar_url: string | null
  start_date: string | null
  phone: string | null
  bio_html: string | null
}

export interface EmployeeProfile extends EmployeeSummary {
  phone: string | null
  linkedin_url: string | null
  timezone: string | null
  bio_html: string | null
  bio_json: Record<string, unknown>
  skills: string[]
  interests: string[]
  manager: {
    id: string
    display_name: string
    job_title: string | null
    profile_image_url: string | null
    avatar_url: string | null
  } | null
  direct_reports: EmployeeSummary[]
}

export interface BirthdayEvent {
  id: string
  name: string
  initials: string
  type: 'birthday' | 'anniversary'
  days_until: number
  date_label: string   // e.g. "Mar 15" or "Today"
  years?: number       // years of service (anniversaries only)
  avatar_url?: string | null
  job_title?: string | null
}

// ─── Company Calendar ────────────────────────────────────────────────────────

export type CompanyCalendarEventTypeId = 'birthday' | 'anniversary' | 'company' | 'pto' | 'vendor_demo'

export interface CompanyCalendarEventType {
  id: CompanyCalendarEventTypeId
  label: string
  color: string
  accentColor: string
  googleColorIds: string[]
  titlePrefixes: string[]
}

export interface CompanyCalendarEvent {
  id: string
  title: string
  type: CompanyCalendarEventTypeId
  typeLabel: string
  start: string
  end: string | null
  allDay: boolean
  description: string | null
  location: string | null
  htmlLink: string | null
  googleColorId: string | null
}

export interface CompanyCalendarResponse {
  eventTypes: CompanyCalendarEventType[]
  events: CompanyCalendarEvent[]
  cachedAt: string
}

// ─── Marketing Calendar ─────────────────────────────────────────────────────

export type MarketingCalendarPlatform = 'linkedin' | 'mailchimp' | 'instagram' | 'facebook'

export interface MarketingCalendarEvent {
  id: string
  title: string
  event_date: string        // YYYY-MM-DD
  event_time: string | null // HH:MM
  platforms: MarketingCalendarPlatform[]
  art_url: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ─── Vendor Relations ───────────────────────────────────────────────────────

export type VendorDemoSlotStatus = 'open' | 'reserved'

export interface VendorDemoSlot {
  id: string
  start_time: string
  end_time: string
  status: VendorDemoSlotStatus
  vendor_id: string | null
  vendor_notes: string | null
  reserved_at: string | null
  task_id: string | null
  created_by: string
  created_at: string
  updated_at: string
  vendor: { id: string; name: string } | null
}

// ─── Store ───────────────────────────────────────────────────────────────────

export type StoreStatus = 'Active' | 'Inactive'
export type StoreRole = 'manager' | 'sales'

export interface Store {
  id: string
  store_id: string
  store_name: string
  is_active: boolean
  domain: string | null
  status: StoreStatus
  in_production: boolean
  launch_date: string | null
  takedown_date: string | null
  last_order_at: string | null
  last_order_sync_at: string | null
  store_types: string[]
  who_pays: string[]
  payment_methods: string[]
  freight: string[]
  freight_amount: number | null
  unique_incentives: string | null
  product_types: string[]
  allowances: string | null
  mandatory_notes: string[]
  created_at: string
  updated_at: string
  managers?: string[]
  sales_reps?: string[]
}

export interface StoreAssignment {
  id: string
  store_id: string
  user_id: string
  role: StoreRole
  created_at: string
  user: { id: string; display_name: string; email: string; avatar_url: string | null; profile_image_url: string | null }
}

export interface StoreDetail extends Store {
  assignments: StoreAssignment[]
  customer: { id: string; name: string } | null
  contacts: { id: string; first_name: string; last_name: string; email: string | null }[]
  open_task_count: number
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

export interface StoreOrderSummary {
  id: string
  store_id: string
  order_id: string
  created_at: string
  modified_at: string | null
  customer_name: string | null
  company_name: string | null
  salesrep_name: string | null
  parent_id: string | null
  language_id: string | null
  currency_id: string | null
  on_ship_station: boolean
  issue_count: number
  attachment_count: number
  status: string | null
  amount: number
  amount_str: string | null
  internal_notes: string | null
  details: string | null
  synced_at: string
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
  link_url?: string | null
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
export type ArticleContentKind = 'article' | 'poll'

export interface PollOption {
  id: string
  article_id: string
  option_text: string
  sort_order: number
  created_at: string
  updated_at?: string
}

export interface PollOptionResult extends PollOption {
  vote_count: number
  voters?: PollVoter[]
}

export interface PollVoter {
  id: string
  display_name: string
  email: string
}

export interface PollData {
  question: string
  is_anonymous: boolean
  options: PollOptionResult[]
  total_votes: number
  user_vote_option_id: string | null
  can_view_voters?: boolean
}

export interface NewsArticle {
  id: string
  title: string
  type: ArticleType
  status: ArticleStatus
  content_kind: ArticleContentKind
  content_json: Record<string, unknown>
  content_html: string | null
  excerpt: string | null
  cover_image_url: string | null
  pinned: boolean
  poll_question: string | null
  poll_is_anonymous: boolean
  poll?: PollData
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
  content_kind: ArticleContentKind
  excerpt: string | null
  cover_image_url: string | null
  pinned: boolean
  poll_question: string | null
  poll_is_anonymous: boolean
  poll?: PollData
  reading_time_minutes: number | null
  publish_date: string | null
  author_name: string
}

export interface NewsArticlePayload {
  title: string
  type: ArticleType
  status: ArticleStatus
  content_kind?: ArticleContentKind
  content_json: Record<string, unknown>
  content_html: string
  cover_image_url?: string | null
  pinned?: boolean
  publish_date?: string | null
  poll_question?: string | null
  poll_is_anonymous?: boolean
  poll_options?: { id?: string; option_text: string; sort_order: number }[]
}

// ─── Banner Strip (Ticker) ────────────────────────────────────────────────────

export interface BannerStripItem {
  id: string
  label: string
  text: string
  href?: string | null
  source: 'birthday' | 'anniversary' | 'news' | 'holiday' | 'manual'
  avatar_url?: string | null
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

export interface CalendarCountdownEvent {
  id: string
  title: string
  start: string   // ISO datetime
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

// ─── Documents ───────────────────────────────────────────────────────────────

export interface DocSection {
  id: string
  name: string
  sort_order: number
  required_role: string | null
  department: string | null
  created_at: string
}

export interface DocFolder {
  id: string
  section_id: string
  parent_folder_id: string | null
  name: string
  sort_order: number
  required_role: string | null
  created_at: string
}

export interface DriveDocument {
  id: string
  folder_id: string
  title: string
  drive_url: string | null
  drive_file_id: string | null
  description: string | null
  storage_bucket: string | null
  storage_path: string | null
  required_role: string | null
  owner_id: string | null
  sort_order: number
  version: number
  created_at: string
  updated_at: string
}

export interface Department {
  id: string
  name: string
  label: string
  color: string
  sort_order: number
  created_at: string
}

export interface DocumentPermission {
  id: string
  document_id: string
  group_id: string | null
  user_id: string | null
  granted_by: string | null
  granted_at: string
}

export interface DocumentPermissionUser {
  id: string
  display_name: string
  email: string
  avatar_url: string | null
}

export interface DocumentAccessSummary {
  owner: { id: string; display_name: string; email: string } | null
  open_to_all: boolean
  resolved_users: {
    id: string
    display_name: string
    email: string
    via: 'owner' | 'role' | 'individual'
  }[]
}

export interface DocFolderWithDocuments extends DocFolder {
  documents: DriveDocument[]
}

export interface DocFolderNode extends DocFolder {
  documents: DriveDocument[]
  children: DocFolderNode[]
}

export interface DocSectionWithFolders extends DocSection {
  folders: DocFolderWithDocuments[]
}

export interface DocSectionWithTree extends DocSection {
  folders: DocFolderNode[]
}

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
export type CrmTaskDepartment = 'CRM' | 'E-Commerce' | 'HR' | 'IT' | 'Accounting' | 'Sales' | 'Warehouse' | 'Order Management' | 'CSR'
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

export interface CrmBrandData {
  id: string
  domain: string
  brandfetch_id: string | null
  name: string | null
  description: string | null
  long_description: string | null
  logo_url: string | null
  icon_url: string | null
  colors: { hex: string; type: string; brightness: number }[] | null
  links: { name: string; url: string }[] | null
  company: {
    employees: number | null
    foundedYear: number | null
    industries: { name: string; slug: string }[] | null
    location: { city: string | null; state: string | null; country: string | null } | null
    kind: string | null
  } | null
  raw_data: object
  fetched_at: string
  created_at: string
  updated_at: string
}

export interface CrmCustomer {
  id: string
  name: string
  client_status: CrmClientStatus | null
  phone: string | null
  fax: string | null
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
  industry: string | null
  notes: string | null
  power_units: string | null
  mta: boolean | null
  mta_trucking: string | null
  insightly_id: string | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
  logo_url: string | null
  brand_data_id: string | null
  commissioned_client: string | null
  tax_exempt: boolean
}

export interface CrmVendor {
  id: string
  name: string
  phone: string | null
  fax: string | null
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
  ap_email: string | null
  sales_rep_name: string | null
  sales_rep_email: string | null
  orders_email: string | null
  orders_cutoff: string | null
  rush_order_email: string | null
  rush_order_cutoff: string | null
  rush_art_email: string | null
  rush_art_cutoff: string | null
  artwork_email: string | null
  samples_email: string | null
  virtuals_email: string | null
  spec_sample_email: string | null
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
  industry: string | null
  notes: string | null
  insightly_id: string | null
  vendor_id: string | null
  assigned_to: string | null
  created_by: string
  created_at: string
  updated_at: string
  logo_url: string | null
  brand_data_id: string | null
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
  // Insightly import fields
  insightly_id: string | null
  salutation: string | null
  fax: string | null
  assistant_phone: string | null
  assistant_name: string | null
  date_of_birth: string | null
  email_opted_out: boolean | null
  important_date_1_name: string | null
  important_date_1: string | null
  important_date_2_name: string | null
  important_date_2: string | null
  important_date_3_name: string | null
  important_date_3: string | null
  last_activity_date: string | null
  next_activity_date: string | null
  profile_segmentation: string | null
  product_showcase_invite: string | null
  department: string | null
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
  pipeline_name: string | null
  value: number | null
  bid_currency: string | null
  bid_type: string | null
  bid_duration: string | null
  probability: number | null
  status: CrmOpportunityStatus
  status_reason: string | null
  category: CrmOpportunityCategory | null
  forecast_close_date: string | null
  last_activity_date: string | null
  next_activity_date: string | null
  description: string | null
  closed_at: string | null
  insightly_id: string | null
  csr_user_id: string | null
  designer_user_id: string | null
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
  department: CrmTaskDepartment | null
  category: CrmTaskCategory | null
  priority: CrmTaskPriority
  due_date: string | null
  status: CrmTaskStatus
  progress: number
  description: string | null
  delegators: string[]
  opportunity_id: string | null
  customer_id: string | null
  vendor_id: string | null
  contact_id: string | null
  store_id: string | null
  sort_order: number
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

export interface CrmTaskAttachment {
  id: string
  task_id: string
  label: string | null
  url: string
  file_name: string
  file_size: number | null
  mime_type: string | null
  uploaded_by: string | null
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
  aturian_queue_id: string | null
  added_by: string
  created_at: string
}

export type AturianQueueStatus = 'new' | 'claimed' | 'complete'
export type AturianCommissionedClient = 'Standard' | 'Standard with Split' | 'Credit Card Store' | 'Non-Credit card store'

export interface AturianCustomerQueueEntry {
  id: string
  company_name: string
  assigned_to: string | null
  is_online_client: boolean
  online_uses_cc: boolean | null
  commissioned_client: AturianCommissionedClient
  tax_exempt: boolean
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zip: string | null
  phone: string | null
  website: string | null
  orderer_first_name: string | null
  orderer_last_name: string | null
  orderer_email: string | null
  ap_first_name: string | null
  ap_last_name: string | null
  ap_email: string | null
  status: AturianQueueStatus
  task_id: string | null
  claimed_by: string | null
  claimed_at: string | null
  completed_by: string | null
  completed_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface AturianCustomerQueueDetail extends AturianCustomerQueueEntry {
  assigned_user: { id: string; display_name: string } | null
  claimed_user: { id: string; display_name: string } | null
  created_by_user: { id: string; display_name: string } | null
  files: CrmFile[]
}

export interface CrmArtwork {
  id: string
  customer_id: string
  name: string
  description: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  width: number | null
  height: number | null
  url: string
  cloudinary_public_id: string | null
  cloudinary_resource_type: string | null
  thumbnail_url: string | null
  is_drive_link: boolean
  added_by: string
  created_at: string
  updated_at: string
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
  stores: { id: string; store_id: string; store_name: string; status: StoreStatus; is_active: boolean }[]
  assigned_user: { id: string; display_name: string; email: string } | null
  created_by_user: { id: string; display_name: string; email: string } | null
  brand_data: CrmBrandData | null
}

export interface CrmVendorDetail extends CrmVendor {
  contacts: CrmContact[]
  files: CrmFile[]
  brand_data: CrmBrandData | null
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
  attachments: CrmTaskAttachment[]
  opportunity: { id: string; name: string } | null
  customer: { id: string; name: string } | null
  vendor: { id: string; name: string } | null
  contact: { id: string; first_name: string; last_name: string } | null
  assigned_user: { id: string; display_name: string; email: string } | null
}

// ─── Forms ────────────────────────────────────────────────────────────────────

export type FormCategory = 'vendor' | 'customer' | 'general'
export type DeliveryMethod = 'download' | 'email' | 'link' | 'in-person'

export interface CrmForm {
  id: string
  name: string
  category: FormCategory
  file_url: string
  file_size_bytes: number | null
  mime_type: string
  description: string | null
  states_covered: string[]
  is_active: boolean
  version: number
  created_by: string
  created_at: string
  updated_at: string
  public_token: string | null
  public_token_active: boolean
}

export interface FormDeliveryLog {
  id: string
  form_id: string
  vendor_id: string | null
  customer_id: string | null
  sent_by_user_id: string
  delivery_method: DeliveryMethod
  sent_at: string
  notes: string | null
}

export interface FormWithDeliveryHistory extends CrmForm {
  delivery_count: number
  last_delivered_at: string | null
  last_delivered_by: { id: string; display_name: string } | null
}

// ─── Release Notes ─────────────────────────────────────────────────────────────

export type ReleaseChangeCategory = 'feature' | 'improvement' | 'bug_fix' | 'breaking_change'

export interface ReleaseChange {
  category: ReleaseChangeCategory
  description: string
}

export interface Release {
  version: string    // semver e.g. "0.1.0"
  date: string       // "YYYY-MM-DD"
  title: string
  summary: string
  changes: ReleaseChange[]
}

// ─── Notifications ────────────────────────────────────────────────────────────

export type NotificationEmailStatus = 'pending' | 'sent' | 'skipped' | 'failed' | 'disabled'

export interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  link_url: string | null
  metadata: Record<string, unknown>
  read_at: string | null
  archived_at: string | null
  email_status: NotificationEmailStatus
  email_sent_at: string | null
  created_at: string
}

export interface NotificationPreferenceRow {
  user_id: string
  type: string
  email: boolean
  updated_at: string
}

export interface NotificationPreferenceView {
  type: string
  label: string
  description: string
  email: boolean
}

// ─── Spec Samples ────────────────────────────────────────────────────────────

export type SpecSampleStatus =
  | 'not_contacted'
  | 'artwork'
  | 'ordered'
  | 'in_production'
  | 'shipped'
  | 'delivered'
  | 'approved'
  | 'declined'
  | 'no_response'

export interface SpecSample {
  id: string
  customer_id: string | null
  contact_id: string | null
  sales_rep_id: string | null
  assigned_csr_id: string | null
  po_number: string | null
  item_name: string
  item_number: string | null
  item_image_url: string | null
  vendor: string | null
  vendor_link: string | null
  status: SpecSampleStatus
  order_date: string | null
  date_sent: string | null
  ship_date: string | null
  tracking_number: string | null
  follow_up_date: string | null
  follow_up_notes: string | null
  notes: string | null
  linked_task_id: string | null
  artwork_task_id: string | null
  spec_idea_id: string | null
  proof_url: string | null
  created_at: string
  updated_at: string
}

export interface SpecSampleListItem extends SpecSample {
  customer_name: string | null
  contact_name: string | null
  csr_name: string | null
  sales_rep_name: string | null
}

export interface SpecIdea {
  id: string
  vendor: string
  vendor_id: string | null
  item_name: string
  item_number: string | null
  vendor_url: string | null
  image_url: string | null
  image_urls: string[]
  tags: string[]
  category: string | null
  price_range: string | null
  notes: string | null
  ordering_instructions_json: Record<string, unknown> | null
  ordering_instructions_html: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ─── Expense Reports ─────────────────────────────────────────────────────────

export type ExpenseReportStatus =
  | 'draft'
  | 'submitted'
  | 'needs_changes'
  | 'approved'
  | 'submitted_to_payroll'

export interface ExpenseReportConfig {
  id: string
  reviewer_user_id: string | null
  template_instructions: string | null
  updated_at: string
  updated_by: string | null
  reviewer?: { id: string; display_name: string; email: string } | null
}

export interface ExpenseReport {
  id: string
  created_by: string
  period_month: string          // YYYY-MM
  title: string | null
  status: ExpenseReportStatus
  drive_file_id: string | null  // legacy — kept for old records
  drive_url: string | null      // legacy — kept for old records
  reviewer_comment: string | null
  created_at: string
  updated_at: string
  submitter?: { id: string; display_name: string; email: string } | null
  line_items?: ExpenseReportLineItem[]
  line_item_count?: number
  total_original?: number
  total_adjusted?: number
}

export interface ExpenseReportLineItem {
  id: string
  report_id: string
  expense_date: string | null
  vendor: string | null
  category: string | null
  description: string | null
  original_amount: number | null
  adjusted_amount: number | null
  payment_type: 'cash' | 'credit_card' | null
  receipt_url: string | null
  reimbursable: boolean
  sort_order: number
  created_at: string
  updated_at: string
  receipts?: ExpenseReportReceipt[]
  comments?: ExpenseReportComment[]
}

export interface ExpenseReportReceipt {
  id: string
  report_id: string
  line_item_id: string | null
  filename: string
  storage_path: string
  mime_type: string | null
  file_size: number | null
  uploaded_by: string
  created_at: string
  signed_url?: string
}

export interface ExpenseReportVersion {
  id: string
  report_id: string
  changed_by: string
  action: string
  previous_status: string | null
  new_status: string | null
  comment: string | null
  created_at: string
  changer?: { id: string; display_name: string; email: string } | null
}

export interface ExpenseReportComment {
  id: string
  report_id: string
  line_item_id: string | null
  parent_id: string | null
  author_id: string
  body: string
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  updated_at: string
  author?: { id: string; display_name: string; email: string; avatar_url?: string | null }
  replies?: ExpenseReportComment[]
}

// ─── PTO Requests ─────────────────────────────────────────────────────────────

export type PtoRequestStatus = 'pending' | 'approved' | 'denied'

export type PtoReason =
  | 'vacation'
  | 'personal_leave'
  | 'funeral_bereavement'
  | 'jury_duty'
  | 'family_reasons'
  | 'medical_leave'
  | 'to_vote'
  | 'other'

export const PTO_REASON_LABELS: Record<PtoReason, string> = {
  vacation: 'Vacation',
  personal_leave: 'Personal Leave',
  funeral_bereavement: 'Funeral / Bereavement',
  jury_duty: 'Jury Duty',
  family_reasons: 'Family Reasons',
  medical_leave: 'Medical Leave',
  to_vote: 'To Vote',
  other: 'Other',
}

export interface PtoRequest {
  id: string
  user_id: string
  start_date: string        // YYYY-MM-DD
  end_date: string          // YYYY-MM-DD
  start_half_day: boolean
  end_half_day: boolean
  reason: PtoReason
  notes: string | null
  signed_name: string
  signed_at: string
  status: PtoRequestStatus
  reviewer_comment: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  task_id: string | null
  created_at: string
  updated_at: string
  user?: { display_name: string; email: string; avatar_url: string | null }
}
