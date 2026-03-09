-- Migration: Create company_expenses table for tracking global expenses in the Admin Dashboard
-- Fields: date, purpose, amount, paid_by, itr_type, tax_type, gst_amount, status

CREATE TABLE IF NOT EXISTS company_expenses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    expense_date DATE NOT NULL,
    purpose VARCHAR(255) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    paid_by VARCHAR(100) NOT NULL,
    itr_type VARCHAR(100) DEFAULT NULL,
    tax_type VARCHAR(100) DEFAULT NULL,
    gst_amount DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('pending', 'cleared', 'sent to auditing') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
