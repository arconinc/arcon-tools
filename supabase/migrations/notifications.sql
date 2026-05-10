-- Notification framework: in-app notifications + per-user, per-type email preferences
-- Run in Supabase SQL editor

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  link_url      TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at       TIMESTAMPTZ,
  archived_at   TIMESTAMPTZ,
  email_status  TEXT NOT NULL DEFAULT 'pending'
                CHECK (email_status IN ('pending','sent','skipped','failed','disabled')),
  email_sent_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, created_at DESC)
  WHERE read_at IS NULL AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_recent
  ON notifications(user_id, created_at DESC)
  WHERE archived_at IS NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  email       BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type)
);
