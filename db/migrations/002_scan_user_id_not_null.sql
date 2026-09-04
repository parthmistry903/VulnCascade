-- Enforce NOT NULL constraint on user_id for data integrity
ALTER TABLE scans ALTER COLUMN user_id SET NOT NULL;
