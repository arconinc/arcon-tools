-- Spec Samples feature: spec_ideas catalog + spec_samples tracking records
-- Run in Supabase SQL editor

-- ─── spec_ideas ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spec_ideas (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor                       TEXT NOT NULL,
  vendor_id                    UUID REFERENCES crm_vendors(id) ON DELETE SET NULL,
  item_name                    TEXT NOT NULL,
  item_number                  TEXT,
  vendor_url                   TEXT,
  image_url                    TEXT,
  image_urls                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags                         TEXT[] NOT NULL DEFAULT '{}',
  category                     TEXT,
  price_range                  TEXT,
  notes                        TEXT,
  ordering_instructions_json   JSONB,
  ordering_instructions_html   TEXT,
  is_active                    BOOLEAN NOT NULL DEFAULT true,
  created_by                   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spec_ideas_vendor   ON spec_ideas(vendor);
CREATE INDEX IF NOT EXISTS idx_spec_ideas_category ON spec_ideas(category);
CREATE INDEX IF NOT EXISTS idx_spec_ideas_tags     ON spec_ideas USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_spec_ideas_active   ON spec_ideas(is_active);

-- ─── spec_samples ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spec_samples (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id      UUID REFERENCES crm_customers(id) ON DELETE SET NULL,
  contact_id       UUID REFERENCES crm_contacts(id)  ON DELETE SET NULL,
  sales_rep_id     UUID REFERENCES users(id)          ON DELETE SET NULL,
  assigned_csr_id  UUID REFERENCES users(id)          ON DELETE SET NULL,
  spec_idea_id     UUID REFERENCES spec_ideas(id)     ON DELETE SET NULL,
  po_number        TEXT,
  item_name        TEXT NOT NULL,
  item_number      TEXT,
  item_image_url   TEXT,
  vendor           TEXT,
  vendor_link      TEXT,
  status           TEXT NOT NULL DEFAULT 'not_contacted'
    CHECK (status IN ('not_contacted','ordered','in_production','shipped',
                      'delivered','approved','declined','no_response')),
  order_date       DATE,
  date_sent        DATE,
  ship_date        DATE,
  tracking_number  TEXT,
  follow_up_date   DATE,
  follow_up_notes  TEXT,
  notes            TEXT,
  linked_task_id   UUID REFERENCES crm_tasks(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_spec_samples_customer   ON spec_samples(customer_id);
CREATE INDEX IF NOT EXISTS idx_spec_samples_csr        ON spec_samples(assigned_csr_id);
CREATE INDEX IF NOT EXISTS idx_spec_samples_status     ON spec_samples(status);
CREATE INDEX IF NOT EXISTS idx_spec_samples_follow_up  ON spec_samples(follow_up_date) WHERE follow_up_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_spec_samples_date_sent  ON spec_samples(date_sent DESC) WHERE date_sent IS NOT NULL;

-- ─── Supabase Storage bucket ───────────────────────────────────────────────────
-- Create a PUBLIC bucket named  spec-idea-images  in the Supabase dashboard
-- (Storage → New bucket → name: spec-idea-images → Public: ON)
-- No SQL needed for this step.

-- ─── Row-level security (optional but recommended) ────────────────────────────
-- Enable RLS and add policies if your project uses RLS on CRM tables.
-- Typically: authenticated users can SELECT; authenticated users can INSERT/UPDATE/DELETE.
-- ALTER TABLE spec_ideas    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE spec_samples  ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "all_auth" ON spec_ideas    FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "all_auth" ON spec_samples  FOR ALL TO authenticated USING (true) WITH CHECK (true);
