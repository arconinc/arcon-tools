-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add Insightly import fields to crm_opportunities
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS throughout).
-- ─────────────────────────────────────────────────────────────────────────────

-- Core import key + user assignments (already in TS type, now need DB columns)
ALTER TABLE crm_opportunities
  ADD COLUMN IF NOT EXISTS insightly_id      TEXT,
  ADD COLUMN IF NOT EXISTS csr_user_id       UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS designer_user_id  UUID REFERENCES users(id);

-- Additional Insightly fields not previously captured
ALTER TABLE crm_opportunities
  ADD COLUMN IF NOT EXISTS bid_currency        TEXT,
  ADD COLUMN IF NOT EXISTS bid_type            TEXT,
  ADD COLUMN IF NOT EXISTS bid_duration        TEXT,
  ADD COLUMN IF NOT EXISTS pipeline_name       TEXT,
  ADD COLUMN IF NOT EXISTS last_activity_date  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_activity_date  TIMESTAMPTZ;

-- Unique index on insightly_id so ON CONFLICT upserts work.
-- PostgreSQL allows multiple NULLs in a UNIQUE index, so manually-created
-- opportunities (without an insightly_id) are unaffected.
DROP INDEX IF EXISTS idx_crm_opportunities_insightly_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_opportunities_insightly_id
  ON crm_opportunities(insightly_id);
