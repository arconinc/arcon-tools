-- Aggregate order stats server-side to avoid JS row-limit truncation
CREATE OR REPLACE FUNCTION get_store_order_stats(date_from TIMESTAMPTZ, date_to TIMESTAMPTZ)
RETURNS TABLE(store_id UUID, order_count BIGINT, total_amount NUMERIC)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    store_id,
    COUNT(*)::BIGINT         AS order_count,
    COALESCE(SUM(amount), 0) AS total_amount
  FROM store_order_summaries
  WHERE created_at >= date_from
    AND created_at <= date_to
  GROUP BY store_id;
$$;

-- Add missing last_order_sync_at column used by sync routes
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS last_order_sync_at TIMESTAMPTZ;
