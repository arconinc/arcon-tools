-- Extend stores table with e-commerce metadata fields
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS domain TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Active',
  ADD COLUMN IF NOT EXISTS in_production BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS launch_date DATE,
  ADD COLUMN IF NOT EXISTS takedown_date DATE,
  ADD COLUMN IF NOT EXISTS last_order_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS store_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS who_pays TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS payment_methods TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS freight TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unique_incentives TEXT,
  ADD COLUMN IF NOT EXISTS product_types TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allowances TEXT,
  ADD COLUMN IF NOT EXISTS mandatory_notes TEXT[] NOT NULL DEFAULT '{}';

-- Employee assignments to stores (manager / sales)
CREATE TABLE IF NOT EXISTS store_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'sales')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_assignments_store_id ON store_assignments(store_id);
CREATE INDEX IF NOT EXISTS idx_store_assignments_user_id ON store_assignments(user_id);

-- Link a store to one CRM customer
CREATE TABLE IF NOT EXISTS store_customer_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Link a store to multiple CRM contacts
CREATE TABLE IF NOT EXISTS store_contact_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_store_contact_links_store_id ON store_contact_links(store_id);

-- Add store association to CRM tasks
ALTER TABLE crm_tasks
  ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_store_id ON crm_tasks(store_id);
