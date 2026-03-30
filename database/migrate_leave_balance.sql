-- Leave balance bucket: 2 leaves credited per employee at end of every month
-- Applies to Sick and Annual (Vacation) leave types only

CREATE TABLE IF NOT EXISTS leave_balance (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL UNIQUE,
    balance         DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    total_credited  DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    total_used      DECIMAL(6,2) NOT NULL DEFAULT 0.00,
    last_credited_month VARCHAR(7) NULL,          -- e.g. "2025-03"
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lb_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Initialise a row for every existing employee with 0 balance
INSERT IGNORE INTO leave_balance (employee_id, balance, total_credited, total_used)
SELECT id, 0.00, 0.00, 0.00 FROM employees;
