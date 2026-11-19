// Column allowlists for MCP reads. Explicit selects only, never select('*').
// Vendor arcon_username, arcon_password, and arcon_account_number are never listed here.

export const CUSTOMER_FIELDS =
  'id, name, client_status, phone, website, email_domains, industry, description, notes, assigned_to, billing_city, billing_state, billing_country, shipping_city, shipping_state, shipping_country, created_at, updated_at'

export const VENDOR_FIELDS =
  'id, name, phone, website, linkedin, description, premier_group_member, product_line, specialty, online_store, customer_service_email, sales_rep_name, sales_rep_email, orders_email, billing_city, billing_state, billing_country, created_at, updated_at'

export const CONTACT_FIELDS = 'id, first_name, last_name, title, email, phone'

export const OPPORTUNITY_FIELDS = 'id, name, value, status, pipeline_stage, forecast_close_date, assigned_to'

export const TASK_SUMMARY_FIELDS = 'id, title, status, priority, due_date, assigned_to'
