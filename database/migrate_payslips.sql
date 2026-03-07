USE projectpulse;

ALTER TABLE payslips
  ADD COLUMN bonus DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER special_allowance,
  ADD COLUMN extra_deductions DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER professional_tax;
