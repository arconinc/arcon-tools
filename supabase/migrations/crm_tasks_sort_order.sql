ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Initialize existing rows: sequential within each status, ordered by due_date then created_at
UPDATE crm_tasks t
SET sort_order = sub.rn * 1000
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY status
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    ) AS rn
  FROM crm_tasks
) sub
WHERE t.id = sub.id;

ALTER TABLE crm_tasks ALTER COLUMN sort_order SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_sort_order ON crm_tasks(sort_order);
