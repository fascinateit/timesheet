USE projectpulse;

-- Add per-employee hourly rate override (NULL = fall back to group rate)
ALTER TABLE employees
  ADD COLUMN hourly_rate DECIMAL(10,2) NULL DEFAULT NULL AFTER group_id;
