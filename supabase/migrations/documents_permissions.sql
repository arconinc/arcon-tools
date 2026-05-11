-- Documents: section-level RBAC + uploaded file storage
--
-- required_role on doc_sections: if set, only users with that role (or admins) see the section.
-- storage_bucket / storage_path on documents: either drive_url OR these two columns must be set.
-- drive_url is made nullable to allow purely uploaded documents.
--
-- Manual step required after running this migration:
--   Create a PRIVATE bucket named "documents" in the Supabase Storage dashboard.

ALTER TABLE doc_sections
  ADD COLUMN IF NOT EXISTS required_role TEXT;

ALTER TABLE doc_folders
  ADD COLUMN IF NOT EXISTS required_role TEXT;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_bucket TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS required_role TEXT;

ALTER TABLE documents
  ALTER COLUMN drive_url DROP NOT NULL;
