USE projectpulse;

ALTER TABLE invoices
    ADD COLUMN parent_invoice_id INT DEFAULT NULL,
    ADD COLUMN balance_amount DECIMAL(12,2) DEFAULT NULL,
    MODIFY COLUMN status ENUM('pending','cleared','partial') NOT NULL DEFAULT 'pending',
    ADD CONSTRAINT fk_parent_invoice FOREIGN KEY (parent_invoice_id) REFERENCES invoices(id) ON DELETE SET NULL;
