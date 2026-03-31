-- Migration: Add Aturian onboarding fields
-- Run in the Supabase SQL editor. Safe to re-run (IF NOT EXISTS throughout).

ALTER TABLE crm_customers
  ADD COLUMN IF NOT EXISTS commissioned_client TEXT,
  ADD COLUMN IF NOT EXISTS tax_exempt          BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS department TEXT;
