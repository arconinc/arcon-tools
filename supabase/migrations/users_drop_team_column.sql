-- Replace the team column with department (TEXT[]) on users.
-- Maps legacy single-value team → department array where department is not already set.
-- team values that have no direct department equivalent are mapped to the closest match.

UPDATE users
SET department = CASE team
  WHEN 'Sales'      THEN ARRAY['Sales']
  WHEN 'Marketing'  THEN ARRAY['CRM']
  WHEN 'IT'         THEN ARRAY['IT']
  WHEN 'Operations' THEN ARRAY['General']
  WHEN 'Finance'    THEN ARRAY['Accounting']
  WHEN 'HR'         THEN ARRAY['HR']
  ELSE NULL
END
WHERE team IS NOT NULL
  AND (department IS NULL OR department = '{}');

ALTER TABLE users DROP COLUMN IF EXISTS team;
