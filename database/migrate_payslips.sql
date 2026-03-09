-- Phase 9: Variable Pay & Precise Payslip Formatting

-- Expand employees
ALTER TABLE employees
  ADD COLUMN designation VARCHAR(100) NULL AFTER name,
  ADD COLUMN location VARCHAR(150) NULL AFTER designation,
  ADD COLUMN pan_number VARCHAR(20) NULL AFTER location,
  ADD COLUMN variable_pay_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER ctc_annual;

-- Expand payslips 
ALTER TABLE payslips
  ADD COLUMN leave_travel_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER hra,
  ADD COLUMN medical_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER transport,
  ADD COLUMN internet_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER medical_allowance,
  ADD COLUMN variable_pay DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER special_allowance,
  ADD COLUMN income_tax DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER professional_tax;
