-- ============================================================
-- Arcon Tools — Supabase Schema
-- Run this in the Supabase SQL Editor to initialize the database.
-- ============================================================

-- ── Users ────────────────────────────────────────────────────
-- Mirrors Google OAuth identity. Created/updated on every login
-- via the /auth/callback route.

CREATE TABLE IF NOT EXISTS public.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  display_name  text NOT NULL DEFAULT '',
  google_id     text NOT NULL,
  is_admin      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,

  CONSTRAINT users_email_key    UNIQUE (email),
  CONSTRAINT users_google_id_key UNIQUE (google_id)
);

-- ── App Credentials ───────────────────────────────────────────
-- Stores AES-256-GCM encrypted PromoBullit username & password.
-- The IV and auth tag are stored as JSON in the encryption_iv column.
-- The encryption key lives only in the CREDENTIALS_ENCRYPTION_KEY env var.

CREATE TABLE IF NOT EXISTS public.app_credentials (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  encrypted_username text NOT NULL,
  encrypted_password text NOT NULL,
  encryption_iv      text NOT NULL, -- JSON: {usernameIv, usernameTag, passwordIv, passwordTag}
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT app_credentials_user_id_key UNIQUE (user_id)
);

-- ── Stores ────────────────────────────────────────────────────
-- Registry of PromoBullit stores managed in this dashboard.
-- Admins add/edit/remove stores via the admin panel.
-- store_id is the numeric PromoBullit Store ID used in API URLs.

CREATE TABLE IF NOT EXISTS public.stores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    text NOT NULL,
  store_name  text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT stores_store_id_key UNIQUE (store_id)
);

-- ── Audit Log ─────────────────────────────────────────────────
-- Records every significant action: shipment creation, email
-- notification, and any errors that occur during API calls.

CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action     text NOT NULL,         -- e.g. 'add_shipment', 'send_notification_email'
  store_id   text,                  -- PromoBullit Store ID (not FK, may not be in our stores table)
  order_id   text,                  -- PromoBullit Order ID
  details    jsonb NOT NULL DEFAULT '{}',
  status     text NOT NULL CHECK (status IN ('success', 'error', 'partial')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_email       ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id   ON public.users(google_id);
CREATE INDEX IF NOT EXISTS idx_creds_user_id     ON public.app_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_store_id   ON public.stores(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_id     ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_store_id    ON public.audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at  ON public.audit_log(created_at DESC);

-- ── Migration: Add birth_date, start_date; make google_id nullable ────────────
-- Run this in the Supabase SQL Editor after the initial schema is applied.
--
-- ALTER TABLE public.users
--   ALTER COLUMN google_id DROP NOT NULL,
--   ADD COLUMN IF NOT EXISTS birth_date date,
--   ADD COLUMN IF NOT EXISTS start_date date;
--
-- -- Replace the table-level UNIQUE constraint with a partial index so that
-- -- multiple NULL values are allowed (pre-loaded users before first login).
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_google_id_key;
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
--   ON public.users(google_id)
--   WHERE google_id IS NOT NULL;
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Notes ─────────────────────────────────────────────────────
-- Row Level Security is intentionally disabled.
-- All access control is enforced at the Next.js middleware/route level
-- using the SUPABASE_SERVICE_ROLE_KEY (server-side only).
-- The client-side anon key is only used for authentication (Supabase Auth).
