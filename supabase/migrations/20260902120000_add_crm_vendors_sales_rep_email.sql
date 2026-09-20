alter table crm_vendors
  add column if not exists sales_rep_name text,
  add column if not exists sales_rep_email text;
