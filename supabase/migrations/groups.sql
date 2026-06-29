-- Groups: unified people collections for departments, roles, and assignment pools.
-- Legacy role/department tables remain authoritative during migration.

CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#6b7280',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INT NOT NULL DEFAULT 0,
  source_type TEXT NOT NULL DEFAULT 'manual'
              CHECK (source_type IN ('manual', 'department', 'role', 'assignment_pool')),
  source_id   UUID,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);
CREATE INDEX IF NOT EXISTS idx_groups_source ON groups(source_type, source_id);

-- ── group_memberships ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL DEFAULT 'manual'
              CHECK (source IN ('manual', 'department', 'role', 'opportunity_assignment')),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON group_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_group_memberships_source ON group_memberships(source);

-- ── group_capabilities ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS group_capabilities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  config     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_group_capabilities_group ON group_capabilities(group_id);
CREATE INDEX IF NOT EXISTS idx_group_capabilities_capability ON group_capabilities(capability);

-- Seed system department groups from departments.
INSERT INTO groups (key, name, description, color, is_system, sort_order, source_type, source_id)
SELECT 'department:' || d.name,
       d.label,
       'Department group synced from departments',
       d.color,
       true,
       d.sort_order,
       'department',
       d.id
FROM departments d
ON CONFLICT (key) DO NOTHING;

-- Seed system role groups from roles.
INSERT INTO groups (key, name, description, color, is_system, source_type, source_id)
SELECT 'role:' || r.name,
       r.label,
       COALESCE(r.description, 'Role group synced from roles'),
       r.color,
       true,
       'role',
       r.id
FROM roles r
ON CONFLICT (key) DO NOTHING;

INSERT INTO group_capabilities (group_id, capability, config)
SELECT g.id, 'access_control', jsonb_build_object('role', r.name)
FROM roles r
JOIN groups g ON g.key = 'role:' || r.name
ON CONFLICT (group_id, capability) DO NOTHING;

-- Seed Opportunity Owners assignment pool.
INSERT INTO groups (key, name, description, color, is_system, source_type)
VALUES (
  'opportunity_owners',
  'Opportunity Owners',
  'Users eligible to own CRM opportunities',
  '#2563eb',
  true,
  'assignment_pool'
)
ON CONFLICT (key) DO NOTHING;

INSERT INTO group_capabilities (group_id, capability, config)
SELECT g.id, 'assignment_pool', '{"pool_key":"opportunity_owners"}'::jsonb
FROM groups g
WHERE g.key = 'opportunity_owners'
ON CONFLICT (group_id, capability) DO NOTHING;

-- Backfill department group memberships from legacy users.department TEXT[].
INSERT INTO group_memberships (group_id, user_id, source)
SELECT g.id, u.id, 'department'
FROM users u
CROSS JOIN LATERAL unnest(u.department) AS dept_name
JOIN groups g ON g.key = 'department:' || dept_name
WHERE u.department IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Backfill role group memberships from user_roles.
INSERT INTO group_memberships (group_id, user_id, source)
SELECT g.id, ur.user_id, 'role'
FROM user_roles ur
JOIN roles r ON r.id = ur.role_id
JOIN groups g ON g.key = 'role:' || r.name
ON CONFLICT (group_id, user_id) DO NOTHING;

-- Backfill Opportunity Owners from existing opportunity assignments.
INSERT INTO group_memberships (group_id, user_id, source)
SELECT DISTINCT g.id, co.assigned_to, 'opportunity_assignment'
FROM crm_opportunities co
JOIN groups g ON g.key = 'opportunity_owners'
WHERE co.assigned_to IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;
