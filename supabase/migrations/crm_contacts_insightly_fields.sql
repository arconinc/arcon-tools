-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add Insightly import fields to crm_contacts
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS throughout).
-- ─────────────────────────────────────────────────────────────────────────────

-- Core import key (enables upsert deduplication)
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS insightly_id TEXT;

-- Additional contact fields from Insightly export
ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS salutation           TEXT,
  ADD COLUMN IF NOT EXISTS fax                  TEXT,
  ADD COLUMN IF NOT EXISTS assistant_phone      TEXT,
  ADD COLUMN IF NOT EXISTS assistant_name       TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth        TEXT,
  ADD COLUMN IF NOT EXISTS email_opted_out      BOOLEAN,
  ADD COLUMN IF NOT EXISTS important_date_1_name TEXT,
  ADD COLUMN IF NOT EXISTS important_date_1      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS important_date_2_name TEXT,
  ADD COLUMN IF NOT EXISTS important_date_2      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS important_date_3_name TEXT,
  ADD COLUMN IF NOT EXISTS important_date_3      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_activity_date   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS profile_segmentation TEXT,
  ADD COLUMN IF NOT EXISTS product_showcase_invite TEXT;

-- Unique index on insightly_id so ON CONFLICT upserts work.
-- PostgreSQL allows multiple NULLs in a UNIQUE index, so manually-created
-- contacts (without an insightly_id) are unaffected.
DROP INDEX IF EXISTS idx_crm_contacts_insightly_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_contacts_insightly_id
  ON crm_contacts(insightly_id);
