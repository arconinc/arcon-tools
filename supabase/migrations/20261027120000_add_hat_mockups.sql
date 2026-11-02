-- Hat Mockup Assistant: vendor hat catalog, panel geometry, placement rules,
-- chat sessions, saved mockups, starter prompts, and catalog sync log.
-- See docs/plans/hat-mockup-assistant-plan-v1.md.
-- Access is via the service-role admin client only, after auth in route handlers.

create table if not exists hat_styles (
  id uuid primary key default gen_random_uuid(),
  vendor text not null default 'rushordertees',
  brand text not null,
  style_number text not null,
  name text not null,
  slug text not null,
  url text not null,
  categories text[] not null default '{}',
  sizes text,
  silhouette text,
  profile text,                                   -- 'low' | 'mid' | 'high', from product details
  details text[] not null default '{}',           -- vendor bullet points
  price_breaks jsonb,                             -- [{quantity, price_cents}]
  default_color_code text,
  is_active boolean not null default true,
  last_crawled_at timestamptz,
  last_checked_at timestamptz,
  etag text,
  last_modified text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor, slug)
);
create index if not exists idx_hat_styles_brand_active on hat_styles(brand, is_active);

create table if not exists hat_colors (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references hat_styles(id) on delete cascade,
  color_code text not null,
  name text not null,
  hex text,
  hex_secondary text,
  front_image_path text,                          -- path in hat-blanks bucket, set on first fetch
  is_active boolean not null default true,
  unique (style_id, color_code)
);
create index if not exists idx_hat_colors_style on hat_colors(style_id);

create table if not exists hat_decoration_methods (
  id uuid primary key default gen_random_uuid(),
  style_id uuid not null references hat_styles(id) on delete cascade,
  method text not null,                           -- 'embroidery' | 'printing' | 'leather_patch' | 'printed_patch'
  minimum_quantity int,
  unique (style_id, method)
);

create table if not exists hat_placement_rules (
  id uuid primary key default gen_random_uuid(),
  method text not null,
  location text not null default 'front',
  max_width_in numeric not null,
  max_height_in numeric not null,
  default_height_in numeric not null,
  notes text,
  updated_at timestamptz not null default now(),
  unique (method, location)
);

create table if not exists hat_style_geometry (
  style_id uuid not null references hat_styles(id) on delete cascade,
  view text not null default 'fr',
  source_color_code text not null,
  crown_top_y numeric not null,
  bill_seam_y numeric not null,
  crown_left_x numeric not null,
  crown_right_x numeric not null,
  center_x numeric not null,
  center_y numeric not null,
  px_per_inch numeric not null,                   -- at 1000px image width
  confidence numeric not null,
  needs_review boolean not null default false,
  is_override boolean not null default false,     -- admin-adjusted; sync never overwrites
  computed_at timestamptz not null default now(),
  primary key (style_id, view)
);

create table if not exists hat_mockup_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  customer_id uuid references crm_customers(id) on delete set null,
  messages jsonb not null default '[]',
  state jsonb not null default '{}',
  first_message text,
  saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_hat_mockup_sessions_user on hat_mockup_sessions(user_id, created_at desc);

create table if not exists hat_mockups (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references crm_customers(id) on delete cascade,
  session_id uuid references hat_mockup_sessions(id) on delete set null,
  hat_color_id uuid not null references hat_colors(id),
  artwork_id uuid references crm_artwork(id) on delete set null,
  method text not null,
  placement jsonb not null,                       -- {height_in, offset_y_in}
  image_url text not null,
  cloudinary_public_id text,
  realism_image_url text,
  fidelity jsonb,
  title text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_hat_mockups_customer on hat_mockups(customer_id, created_at desc);

create table if not exists hat_mockup_starters (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  source text not null check (source in ('curated', 'learned')),
  uses int not null default 0,
  is_pinned boolean not null default false,
  is_hidden boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists hat_catalog_syncs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  run_started_at timestamptz not null default now(), -- start of the current batch; stale-lock check
  finished_at timestamptz,
  trigger text not null default 'cron' check (trigger in ('cron', 'manual')),
  status text not null default 'running' check (status in ('running', 'paused', 'ok', 'failed')),
  styles_seen int not null default 0,
  colors_seen int not null default 0,
  errors jsonb not null default '[]',
  requests_made int not null default 0,
  next_delay_ms int not null default 5000,
  cursor jsonb
);
-- Only one sync may be running at a time (crawl politeness lock).
create unique index if not exists hat_catalog_syncs_one_running
  on hat_catalog_syncs ((true)) where status = 'running';

-- Logo prep results (background removal + embroidery warnings)
alter table crm_artwork add column if not exists ai_analysis jsonb;

alter table hat_styles enable row level security;
alter table hat_colors enable row level security;
alter table hat_decoration_methods enable row level security;
alter table hat_placement_rules enable row level security;
alter table hat_style_geometry enable row level security;
alter table hat_mockup_sessions enable row level security;
alter table hat_mockups enable row level security;
alter table hat_mockup_starters enable row level security;
alter table hat_catalog_syncs enable row level security;

-- Placeholder placement rules until Aaron's application/size sheets arrive.
insert into hat_placement_rules (method, location, max_width_in, max_height_in, default_height_in, notes) values
  ('embroidery',    'front', 4.5, 2.25, 2.0,  'Placeholder - replace with Arcon application sheet'),
  ('printing',      'front', 4.5, 2.5,  2.0,  'Placeholder - replace with Arcon application sheet'),
  ('leather_patch', 'front', 3.5, 2.25, 2.0,  'Placeholder - replace with Arcon application sheet'),
  ('printed_patch', 'front', 3.5, 2.25, 2.0,  'Placeholder - replace with Arcon application sheet')
on conflict (method, location) do nothing;

insert into hat_mockup_starters (template, source, is_pinned) values
  ('Richardson trucker with the {customer} logo', 'curated', false),
  ('Make a hat for {customer}', 'curated', false),
  ('Same as {customer}''s last mockup but in navy', 'curated', false),
  ('48 embroidered hats for a golf outing, something under $20', 'curated', false),
  ('Leather patch on a trucker for {customer}', 'curated', false),
  ('Show me the 112 in charcoal and black', 'curated', false);

-- Public bucket for vendor blank images (already public on the vendor site).
insert into storage.buckets (id, name, public)
values ('hat-blanks', 'hat-blanks', true)
on conflict (id) do nothing;
