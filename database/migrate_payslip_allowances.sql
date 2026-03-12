USE projectpulse;

-- Add Professional Development Allowance and Insurance columns to payslips
ALTER TABLE payslips
  ADD COLUMN professional_dev_allowance DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER internet_allowance,
  ADD COLUMN insurance_allowance        DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER professional_dev_allowance;
