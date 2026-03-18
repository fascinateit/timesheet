USE projectpulse;

-- Add payment_received (amount) column to invoices
ALTER TABLE invoices
  ADD COLUMN payment_received DECIMAL(12,2) NULL DEFAULT NULL AFTER payment_received_date;
