-- Fine-grained per-document permissions: owner + department + individual user grants.
--
-- owner_id: the user who uploaded/created the document. Only the owner can edit permissions.
-- document_permissions: one row per grant. Each row is either a department grant (all members
--   of that department get access) or an individual user grant.
--
-- Backward compatibility: documents with owner_id = NULL and no rows in document_permissions
-- behave as before — open to all authenticated users.

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS document_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  department  TEXT,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT doc_perm_one_target CHECK (
    (department IS NOT NULL AND user_id IS NULL) OR
    (department IS NULL AND user_id IS NOT NULL)
  ),
  CONSTRAINT doc_perm_unique_dept UNIQUE (document_id, department),
  CONSTRAINT doc_perm_unique_user UNIQUE (document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_doc_perms_document ON document_permissions(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_perms_user     ON document_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_doc_perms_dept     ON document_permissions(department);
