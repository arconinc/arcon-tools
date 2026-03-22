-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add Insightly import fields to crm_customers and crm_vendors
-- Run in the Supabase SQL editor. Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- crm_customers: new columns
ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS insightly_id  TEXT,
  ADD COLUMN IF NOT EXISTS fax           TEXT,
  ADD COLUMN IF NOT EXISTS industry      TEXT,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS power_units   TEXT,
  ADD COLUMN IF NOT EXISTS mta           BOOLEAN,
  ADD COLUMN IF NOT EXISTS mta_trucking  TEXT;

-- Drop partial index if it was created previously, then create a full unique index.
-- PostgreSQL allows multiple NULLs in a UNIQUE index, so non-insightly records are safe.
DROP INDEX IF EXISTS idx_crm_customers_insightly_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_customers_insightly_id
  ON crm_customers(insightly_id);

-- crm_vendors: new columns
ALTER TABLE crm_vendors
  ADD COLUMN IF NOT EXISTS insightly_id  TEXT,
  ADD COLUMN IF NOT EXISTS fax           TEXT,
  ADD COLUMN IF NOT EXISTS industry      TEXT,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to   UUID REFERENCES users(id);

-- Drop partial index if it was created previously, then create a full unique index.
DROP INDEX IF EXISTS idx_crm_vendors_insightly_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_vendors_insightly_id
  ON crm_vendors(insightly_id);
