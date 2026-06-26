-- saved_filters: user-named filter configurations per page
CREATE TABLE IF NOT EXISTS saved_filters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_key      TEXT NOT NULL,
  name          TEXT NOT NULL,
  filter_config JSONB NOT NULL DEFAULT '{}',
  is_shared     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_filters_user_page ON saved_filters (user_id, page_key);
CREATE INDEX IF NOT EXISTS saved_filters_shared_page ON saved_filters (page_key) WHERE is_shared = true;

-- RLS: users read own rows + all shared rows; write own rows only
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_filters_select" ON saved_filters
  FOR SELECT USING (user_id = auth.uid() OR is_shared = true);

CREATE POLICY "saved_filters_insert" ON saved_filters
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_filters_update" ON saved_filters
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "saved_filters_delete" ON saved_filters
  FOR DELETE USING (user_id = auth.uid());
