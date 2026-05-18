-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: CRM performance indexes
-- Targets filter/sort patterns in:
--   /api/marketing/tasks, /api/marketing/customers, /api/marketing/contacts,
--   /api/marketing/opportunities, /api/marketing/dashboard, /api/news
-- All statements are safe to re-run (CREATE INDEX IF NOT EXISTS).
-- Does NOT alter table structure or data.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── crm_tasks ─────────────────────────────────────────────────────────────────

-- ?assigned_to= filter (list route) and .eq('assigned_to', appUser.id) (dashboard)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to
  ON crm_tasks(assigned_to);

-- ?status= filter (list route) and .neq('status', 'completed') (dashboard)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status
  ON crm_tasks(status);

-- .order('due_date') and .lte('due_date', ...) range filter (list + dashboard)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date
  ON crm_tasks(due_date ASC NULLS LAST);

-- Composite for the dashboard "my overdue tasks" pattern:
--   .eq('assigned_to', id).neq('status','completed').lte('due_date', today).order('due_date')
-- Also covers the list route when assigned_to + status + due_before are combined.
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_status_due
  ON crm_tasks(assigned_to, status, due_date ASC NULLS LAST);

-- ?department= filter (department task board queries)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_department
  ON crm_tasks(department);

-- ?opportunity_id= filter (tasks linked to an opportunity)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_opportunity_id
  ON crm_tasks(opportunity_id);

-- ?customer_id= filter (tasks linked to a customer)
CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer_id
  ON crm_tasks(customer_id);

-- ── crm_customers ─────────────────────────────────────────────────────────────

-- ?status= filter maps to client_status column
CREATE INDEX IF NOT EXISTS idx_crm_customers_client_status
  ON crm_customers(client_status);

-- ?assigned_to= filter (list route)
CREATE INDEX IF NOT EXISTS idx_crm_customers_assigned_to
  ON crm_customers(assigned_to);

-- .order('name') default sort (all paginated list queries)
CREATE INDEX IF NOT EXISTS idx_crm_customers_name
  ON crm_customers(name);

-- ── crm_contacts ──────────────────────────────────────────────────────────────

-- ?customer_id= filter (most common contact filter — contacts belong to a customer)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_customer_id
  ON crm_contacts(customer_id);

-- ?vendor_id= filter (contacts linked to a vendor)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_vendor_id
  ON crm_contacts(vendor_id);

-- .order('last_name').order('first_name') default sort (all paginated list queries)
CREATE INDEX IF NOT EXISTS idx_crm_contacts_last_first_name
  ON crm_contacts(last_name, first_name);

-- ── crm_opportunities ─────────────────────────────────────────────────────────

-- ?assigned_to= filter (list + dashboard pipeline/leaderboard queries)
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_assigned_to
  ON crm_opportunities(assigned_to);

-- ?status= filter — heavily used; almost every dashboard query filters status='open'
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_status
  ON crm_opportunities(status);

-- ?customer_id= filter (opportunities belonging to a customer)
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_customer_id
  ON crm_opportunities(customer_id);

-- Composite for the dashboard "closing soon" query:
--   .eq('status','open').lte('forecast_close_date', cutoff).gte('forecast_close_date', today)
--   .order('forecast_close_date')
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_status_close_date
  ON crm_opportunities(status, forecast_close_date ASC NULLS LAST);

-- .gte('closed_at', monthStart).lte('closed_at', monthEnd) for won-this-month goal progress
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_closed_at
  ON crm_opportunities(closed_at);

-- .order('created_at', { ascending: false }) default sort on the list route
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_created_at
  ON crm_opportunities(created_at DESC);

-- ── crm_entity_tags ───────────────────────────────────────────────────────────

-- All tag-filter lookups begin with entity_type, then optionally tag_id:
--   .eq('entity_type','customer').eq('tag_id', tagId)
--   .eq('entity_type','contact').eq('tag_id', tagId)
--   .eq('entity_type','opportunity').eq('tag_id', tagId)
CREATE INDEX IF NOT EXISTS idx_crm_entity_tags_type_tag
  ON crm_entity_tags(entity_type, tag_id);

-- Enrichment queries: fetch all tags for a set of entity IDs of a given type:
--   .eq('entity_type','customer').in('entity_id', custIds)
CREATE INDEX IF NOT EXISTS idx_crm_entity_tags_type_entity
  ON crm_entity_tags(entity_type, entity_id);

-- ── news_articles ─────────────────────────────────────────────────────────────

-- /api/news: .eq('status','published').order('pinned',desc).order('publish_date',desc)
-- Optionally .eq('type', type) — type is low-cardinality so it can be added as a plain filter
-- after the partial index narrows to published rows.
CREATE INDEX IF NOT EXISTS idx_news_articles_dashboard
  ON news_articles(status, pinned DESC, publish_date DESC)
  WHERE status = 'published';
