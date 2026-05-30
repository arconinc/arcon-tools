-- Expense Reports v2: Switch from Supabase Storage to Google Drive
-- Removes file versioning (Drive handles it natively), adds Drive metadata fields

-- Update config table: swap storage fields for Drive fields
ALTER TABLE expense_report_config
  DROP COLUMN IF EXISTS template_storage_path,
  DROP COLUMN IF EXISTS template_filename,
  ADD COLUMN IF NOT EXISTS template_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS template_drive_url TEXT,
  ADD COLUMN IF NOT EXISTS expense_folder_id TEXT;

-- Drop file-upload versioning table
DROP TABLE IF EXISTS expense_report_versions;

-- Update reports table: remove file-lock fields, add Drive metadata
ALTER TABLE expense_reports
  DROP COLUMN IF EXISTS locked,
  DROP COLUMN IF EXISTS locked_at,
  DROP COLUMN IF EXISTS locked_by,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_url TEXT,
  ADD COLUMN IF NOT EXISTS reviewer_comment TEXT;

-- Expand the status enum to include all workflow states
ALTER TABLE expense_reports
  DROP CONSTRAINT IF EXISTS expense_reports_status_check;

ALTER TABLE expense_reports
  ADD CONSTRAINT expense_reports_status_check
  CHECK (status IN ('draft', 'submitted', 'needs_changes', 'approved', 'submitted_to_payroll'));

-- Migrate any existing rows from old statuses
UPDATE expense_reports SET status = 'submitted'  WHERE status = 'revision_requested';
UPDATE expense_reports SET status = 'approved'   WHERE status = 'completed';
