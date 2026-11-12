-- Soft delete for CRM customers, contacts, and opportunities.
-- Rows with deleted_at set are hidden from every CRM read path. Nothing is removed from the table.
-- Not applied yet. Review first, then apply.

alter table crm_customers
  add column if not exists deleted_at timestamptz;

alter table crm_contacts
  add column if not exists deleted_at timestamptz;

alter table crm_opportunities
  add column if not exists deleted_at timestamptz;
