-- Convert users.department from single TEXT to TEXT[] for multi-department support
ALTER TABLE users
  ALTER COLUMN department TYPE TEXT[]
  USING CASE WHEN department IS NULL THEN NULL ELSE ARRAY[department] END;
