-- Expense Reports Feature
-- Tables: expense_report_config, expense_reports, expense_report_versions

CREATE TABLE expense_report_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_user_id UUID REFERENCES users(id),
  template_storage_path TEXT,
  template_filename TEXT,
  template_instructions TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES users(id)
);
INSERT INTO expense_report_config DEFAULT VALUES;

CREATE TABLE expense_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES users(id),
  period_month TEXT NOT NULL,  -- YYYY-MM format
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'revision_requested', 'completed')),
  locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(created_by, period_month)
);

CREATE TABLE expense_report_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES expense_reports(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT,
  comment TEXT,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expense_reports_created_by ON expense_reports(created_by);
CREATE INDEX idx_expense_reports_period_month ON expense_reports(period_month);
CREATE INDEX idx_expense_reports_status ON expense_reports(status);
CREATE INDEX idx_expense_report_versions_report_id ON expense_report_versions(report_id);
