-- Tasks: department assignment and delegation tracking
-- Run in Supabase SQL editor

-- Department field on tasks (maps to nav sections)
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS department TEXT;

-- Delegation chain: array of user IDs who previously held the assignment
-- When assigned_to changes, the previous holder is appended here
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS delegators UUID[] NOT NULL DEFAULT '{}';

-- Department field on users (admin-assigned via /admin/users)
ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT;

-- Task-level file attachments (separate from comment attachments)
CREATE TABLE IF NOT EXISTS crm_task_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES crm_tasks(id) ON DELETE CASCADE,
  label       TEXT,
  url         TEXT NOT NULL,
  file_name   TEXT NOT NULL,
  file_size   INTEGER,
  mime_type   TEXT,
  uploaded_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_task_attachments_task ON crm_task_attachments(task_id);
