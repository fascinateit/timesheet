USE projectpulse;

ALTER TABLE employees
  ADD COLUMN gratuity DECIMAL(12,2) NOT NULL DEFAULT 0.00;
