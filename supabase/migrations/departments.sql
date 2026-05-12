-- Departments: first-class table replacing the free-text TEXT[] on users.
-- user_departments replaces users.department as the authoritative source.
-- department_roles links departments to roles so that department membership
-- automatically grants the corresponding role(s) at auth time.

CREATE TABLE IF NOT EXISTS departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6b7280',
  sort_order INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO departments (name, label, color, sort_order) VALUES
  ('CRM',        'CRM',        '#2563eb', 0),
  ('E-Commerce', 'E-Commerce', '#7c3aed', 1),
  ('HR',         'HR',         '#065f46', 2),
  ('IT',         'IT',         '#1e40af', 3),
  ('Accounting', 'Accounting', '#92400e', 4),
  ('Sales',      'Sales',      '#b45309', 5),
  ('Warehouse',  'Warehouse',  '#374151', 6),
  ('General',    'General',    '#6b7280', 7)
ON CONFLICT (name) DO NOTHING;

-- ── user_departments ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assigned_by   UUID REFERENCES users(id),
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, department_id)
);
CREATE INDEX IF NOT EXISTS idx_user_departments_user ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept ON user_departments(department_id);

-- Migrate existing users.department TEXT[] → user_departments rows
INSERT INTO user_departments (user_id, department_id)
SELECT u.id, d.id
FROM users u
CROSS JOIN LATERAL unnest(u.department) AS dept_name
JOIN departments d ON d.name = dept_name
WHERE u.department IS NOT NULL
ON CONFLICT (user_id, department_id) DO NOTHING;

-- ── department_roles ──────────────────────────────────────────────────────────
-- Each row means: being in this department auto-grants this role.
-- A department can carry zero or more roles.

CREATE TABLE IF NOT EXISTS department_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (department_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_department_roles_dept ON department_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_department_roles_role ON department_roles(role_id);

-- Seed: HR and Accounting departments already have matching system roles
INSERT INTO department_roles (department_id, role_id)
SELECT d.id, r.id
FROM departments d
JOIN roles r ON LOWER(r.name) = LOWER(d.name)
ON CONFLICT (department_id, role_id) DO NOTHING;
