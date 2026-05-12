-- Replace department TEXT grants with role-based grants in document_permissions.
--
-- Strategy:
-- 1. Create roles for every department that doesn't have one yet.
-- 2. Link those new roles to their departments in department_roles.
-- 3. Add role_id column to document_permissions.
-- 4. Migrate existing department TEXT rows → role_id rows.
-- 5. Update the exclusivity constraint (role_id OR user_id, not dept OR user_id).
-- 6. Drop the now-empty department column.

-- ── 1. Create per-department roles ───────────────────────────────────────────

INSERT INTO roles (name, label, description, color, is_system) VALUES
  ('marketing', 'Marketing', 'Access to Marketing documents',          '#2563eb', true),
  ('ecommerce', 'E-Commerce','Access to E-Commerce documents',         '#7c3aed', true),
  ('it',        'IT',        'Access to IT documents',                 '#1e40af', true),
  ('sales',     'Sales',     'Access to Sales documents',              '#b45309', true),
  ('warehouse', 'Warehouse', 'Access to Warehouse documents',          '#374151', true),
  ('general',   'General',   'Access to General documents',            '#6b7280', true)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Link new roles to their departments ────────────────────────────────────

INSERT INTO department_roles (department_id, role_id)
SELECT d.id, r.id
FROM departments d
JOIN roles r ON r.name = CASE d.name
  WHEN 'CRM'        THEN 'marketing'
  WHEN 'E-Commerce' THEN 'ecommerce'
  WHEN 'IT'         THEN 'it'
  WHEN 'Sales'      THEN 'sales'
  WHEN 'Warehouse'  THEN 'warehouse'
  WHEN 'General'    THEN 'general'
  WHEN 'HR'         THEN 'hr'
  WHEN 'Accounting' THEN 'accounting'
  ELSE NULL
END
WHERE r.name IS NOT NULL
ON CONFLICT (department_id, role_id) DO NOTHING;

-- ── 3. Add role_id column ─────────────────────────────────────────────────────

ALTER TABLE document_permissions
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES roles(id) ON DELETE CASCADE;

-- ── 4. Migrate department TEXT → role_id ─────────────────────────────────────

UPDATE document_permissions dp
SET role_id = r.id
FROM roles r
WHERE dp.department IS NOT NULL
  AND r.name = CASE dp.department
    WHEN 'CRM'        THEN 'marketing'
    WHEN 'E-Commerce' THEN 'ecommerce'
    WHEN 'HR'         THEN 'hr'
    WHEN 'IT'         THEN 'it'
    WHEN 'Accounting' THEN 'accounting'
    WHEN 'Sales'      THEN 'sales'
    WHEN 'Warehouse'  THEN 'warehouse'
    WHEN 'General'    THEN 'general'
    ELSE NULL
  END;

-- Delete any rows where a department name had no matching role (safety net)
DELETE FROM document_permissions WHERE department IS NOT NULL AND role_id IS NULL;

-- ── 5. Update constraints ─────────────────────────────────────────────────────

ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS doc_perm_one_target;
ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS doc_perm_unique_dept;

ALTER TABLE document_permissions
  ADD CONSTRAINT doc_perm_one_target CHECK (
    (role_id IS NOT NULL AND user_id IS NULL) OR
    (role_id IS NULL     AND user_id IS NOT NULL)
  );

-- Unique: one grant per (document, role) and one grant per (document, user)
CREATE UNIQUE INDEX IF NOT EXISTS doc_perm_unique_role
  ON document_permissions (document_id, role_id)
  WHERE role_id IS NOT NULL;

-- doc_perm_unique_user already exists from the original migration

-- ── 6. Drop the department column ─────────────────────────────────────────────

ALTER TABLE document_permissions DROP COLUMN IF EXISTS department;

-- Drop the now-unused department index
DROP INDEX IF EXISTS idx_doc_perms_dept;

-- Add index on role_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_doc_perms_role ON document_permissions(role_id);
