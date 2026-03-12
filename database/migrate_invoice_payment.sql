USE projectpulse;

-- Rename next_invoice_date → payment_due_date and add payment_received_date
ALTER TABLE invoices
  CHANGE COLUMN next_invoice_date payment_due_date DATE NULL,
  ADD COLUMN payment_received_date DATE NULL AFTER payment_due_date;
