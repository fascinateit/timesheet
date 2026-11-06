-- Employment status: currently working vs resigned (with last working day).
-- (The backend also adds these columns automatically on first use.)
ALTER TABLE employees
  ADD COLUMN employment_status ENUM('working','resigned') NOT NULL DEFAULT 'working',
  ADD COLUMN relieving_date DATE NULL;
