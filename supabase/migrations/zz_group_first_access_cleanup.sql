-- Move runtime access data from roles/departments to groups.

-- Access requests now target groups.
ALTER TABLE access_requests
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

UPDATE access_requests ar
SET group_id = g.id
FROM roles r
JOIN groups g ON g.source_id = r.id AND g.source_type = 'role' AND g.is_active = true
WHERE ar.group_id IS NULL
  AND ar.role_id = r.id;

-- Document permissions now target groups.
ALTER TABLE document_permissions
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

UPDATE document_permissions dp
SET group_id = g.id
FROM roles r
JOIN groups g ON g.source_id = r.id AND g.source_type = 'role' AND g.is_active = true
WHERE dp.group_id IS NULL
  AND dp.role_id = r.id;

-- Remove duplicate rows before adding group uniqueness.
DELETE FROM document_permissions a
USING document_permissions b
WHERE a.id > b.id
  AND a.document_id = b.document_id
  AND a.group_id IS NOT NULL
  AND a.group_id = b.group_id;

ALTER TABLE document_permissions DROP CONSTRAINT IF EXISTS doc_perm_one_target;
ALTER TABLE document_permissions
  ADD CONSTRAINT doc_perm_one_target CHECK (
    (group_id IS NOT NULL AND user_id IS NULL) OR
    (group_id IS NULL AND user_id IS NOT NULL)
  );

DROP INDEX IF EXISTS doc_perm_unique_role;
CREATE UNIQUE INDEX IF NOT EXISTS doc_perm_unique_group
  ON document_permissions (document_id, group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doc_perms_group ON document_permissions(group_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_group ON access_requests(group_id);

UPDATE doc_sections SET required_role = 'access:accounting_access' WHERE required_role = 'accounting_access';
UPDATE doc_sections SET required_role = 'access:hr_access' WHERE required_role = 'hr_access';
UPDATE doc_folders SET required_role = 'access:accounting_access' WHERE required_role = 'accounting_access';
UPDATE doc_folders SET required_role = 'access:hr_access' WHERE required_role = 'hr_access';
UPDATE documents SET required_role = 'access:accounting_access' WHERE required_role = 'accounting_access';
UPDATE documents SET required_role = 'access:hr_access' WHERE required_role = 'hr_access';

-- Preserve old columns during rollout? No runtime code reads them after this migration.
ALTER TABLE document_permissions DROP COLUMN IF EXISTS role_id;
ALTER TABLE access_requests DROP COLUMN IF EXISTS role_id;

-- Old role/department tables are no longer runtime source of truth.
DROP TABLE IF EXISTS department_roles CASCADE;
DROP TABLE IF EXISTS user_departments CASCADE;
DROP TABLE IF EXISTS departments CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- Keep users.department until task/profile migration completes; runtime notifications already use assignment groups.
