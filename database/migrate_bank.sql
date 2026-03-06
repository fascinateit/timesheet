USE projectpulse;

ALTER TABLE employees
  DROP COLUMN bank_details,
  ADD COLUMN bank_account_no VARCHAR(50) NULL,
  ADD COLUMN bank_ifsc VARCHAR(20) NULL,
  ADD COLUMN bank_name VARCHAR(150) NULL;
