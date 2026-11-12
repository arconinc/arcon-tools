-- Insightly Organisation custom fields -> crm_customers, plus a separate table for Insightly passwords.
-- See docs/plans/insightly-custom-field-mapping-v1.md.
-- Not applied yet. Review first, then apply for the POC step.
-- Every new column is nullable.

alter table crm_customers
  add column if not exists additional_information text,
  add column if not exists arcon_account_number text,
  add column if not exists arcon_username text,
  add column if not exists artwork_email text,
  add column if not exists company_type text,
  add column if not exists customer_service_email text,
  add column if not exists is_mta boolean,
  add column if not exists online_store text,
  add column if not exists orders_email text,
  add column if not exists premier_group_member boolean,
  add column if not exists product_line text,
  add column if not exists rush_art_email text,
  add column if not exists rush_order_email text,
  add column if not exists samples_email text,
  add column if not exists spec_sample_email text,
  add column if not exists speciality text,
  add column if not exists virtuals_email text;

-- Enums from the Insightly dropdown lists. Null is allowed.
-- Only on new columns: existing industry / general_logo_color data is not checked here.
alter table crm_customers
  add constraint crm_customers_product_line_check check (
    product_line is null or product_line in (
      'Print', 'Promo', 'Office Supply & Stock & Toner', 'Signs', 'Packaging',
      'Warehouse & Carrier & Courier', 'Artwork', 'Other'
    )
  ),
  add constraint crm_customers_speciality_check check (
    speciality is null or speciality in (
      'Apparel - Decorator', 'Apparel - Blank Warehouse', 'Hard Goods', 'Hats', 'USB', 'Awards',
      'Pins & Jewlery', 'Namebadge', 'Checks, Stationary, Forms & Envelopes', 'Commercial & Long Run',
      'Signs', 'Large Format', 'Folders', 'Ribbon & Thermal', 'Toner', 'Mailing', 'Labels & Tags',
      'Safety Apparel/PPE'
    )
  );

-- Insightly "Arcon Password" (ORGANISATION_FIELD_8). Plain text, kept out of crm_customers
-- until the approach is decided. RLS is on with no policies, so only the service role can read it.
create table if not exists insightly_org_secrets (
  insightly_id text primary key,
  customer_id uuid references crm_customers(id) on delete set null,
  field_name text not null default 'ORGANISATION_FIELD_8',
  value text,
  captured_at timestamptz not null default now()
);

alter table insightly_org_secrets enable row level security;
