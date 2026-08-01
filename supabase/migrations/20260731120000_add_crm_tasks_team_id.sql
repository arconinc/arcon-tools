-- Additive only. No drops, no renames. Part of Department -> Team redesign.
-- Team = existing `groups` row tagged with the `assignment_pool` capability.
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES groups(id);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_team_id ON crm_tasks USING btree (team_id);

-- Backfill from the legacy department string, using the same mapping as
-- ASSIGNMENT_GROUP_BY_DEPARTMENT (src/lib/auth/group-access.ts). 'General',
-- 'Order Management', 'CSR', and NULL have no real-team equivalent (workflow/
-- routing artifacts, not assignable groups) -- team_id stays NULL for those.
UPDATE crm_tasks t
SET team_id = g.id
FROM groups g
WHERE g.is_active = true
  AND g.id IN (SELECT group_id FROM group_capabilities WHERE capability = 'assignment_pool')
  AND (
    (t.department IN ('CRM', 'Sales') AND g.key = 'sales') OR
    (t.department = 'E-Commerce'      AND g.key = 'ecommerce') OR
    (t.department = 'IT'              AND g.key = 'it') OR
    (t.department = 'HR'              AND g.key = 'hr') OR
    (t.department = 'Accounting'      AND g.key = 'accounting') OR
    (t.department = 'Warehouse'       AND g.key = 'warehouse')
  );
