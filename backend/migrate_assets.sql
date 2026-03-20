USE projectpulse;

CREATE TABLE IF NOT EXISTS assets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    asset_tag       VARCHAR(50)  NOT NULL UNIQUE,
    asset_type      VARCHAR(50)  NOT NULL,
    brand           VARCHAR(100),
    model           VARCHAR(150),
    serial_number   VARCHAR(100),
    purchase_date   DATE,
    purchase_cost   DECIMAL(10,2),
    warranty_expiry DATE,
    status          ENUM('available','assigned','maintenance','retired') NOT NULL DEFAULT 'available',
    employee_id     INT DEFAULT NULL,
    assigned_date   DATE DEFAULT NULL,
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL
);
