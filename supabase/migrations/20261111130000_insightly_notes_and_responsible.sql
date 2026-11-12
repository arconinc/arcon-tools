-- Insightly notes and the opportunity responsible user.
-- Not applied yet. Review first, then apply before the export load with --apply.
-- Every new column is nullable. Notes are read and written only through the admin client, so RLS is on with no policies (same as insightly_org_secrets).

create table if not exists crm_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references crm_customers(id) on delete cascade,
  contact_id uuid references crm_contacts(id) on delete cascade,
  opportunity_id uuid references crm_opportunities(id) on delete cascade,
  title text,
  body text,
  created_by uuid references users(id) on delete set null,
  original_author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  insightly_note_id text unique,
  constraint crm_notes_one_parent_check check (num_nonnulls(customer_id, contact_id, opportunity_id) >= 1)
);

create index if not exists idx_crm_notes_customer on crm_notes(customer_id, created_at desc) where customer_id is not null;
create index if not exists idx_crm_notes_contact on crm_notes(contact_id, created_at desc) where contact_id is not null;
create index if not exists idx_crm_notes_opportunity on crm_notes(opportunity_id, created_at desc) where opportunity_id is not null;

alter table crm_notes enable row level security;

-- Insightly RESPONSIBLE_USER_ID. assigned_to already holds the Insightly owner.
alter table crm_opportunities
  add column if not exists responsible_user_id uuid references users(id) on delete set null;
