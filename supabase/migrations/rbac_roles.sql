-- RBAC: roles, user_roles, access_requests, file_permissions
-- Default is open: all authenticated users have full access.
-- Roles are used only to restrict explicitly sensitive areas.

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#6b7280',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);

CREATE TABLE IF NOT EXISTS access_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES users(id),
  role_id       UUID REFERENCES roles(id),
  resource_type TEXT,
  resource_key  TEXT,
  message       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'approved', 'denied')),
  reviewed_by   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_requests_requester ON access_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_status ON access_requests(status);

-- Per-file or per-bucket grants — role OR individual user access to private buckets
CREATE TABLE IF NOT EXISTS file_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket      TEXT NOT NULL,
  path_prefix TEXT,
  role_id     UUID REFERENCES roles(id),
  user_id     UUID REFERENCES users(id),
  can_read    BOOLEAN NOT NULL DEFAULT true,
  can_write   BOOLEAN NOT NULL DEFAULT false,
  granted_by  UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_file_permissions_bucket ON file_permissions(bucket);

-- Seed system roles
INSERT INTO roles (name, label, description, color, is_system) VALUES
  ('accounting', 'Accounting', 'Access to financial reports and accounting documents', '#92400e', true),
  ('hr',         'HR',         'Access to HR documents containing sensitive personal information', '#065f46', true)
ON CONFLICT (name) DO NOTHING;
