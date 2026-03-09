CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    task_details VARCHAR(1000) NOT NULL,
    status ENUM('pending', 'cleared') NOT NULL DEFAULT 'pending',
    raised_date DATE NOT NULL,
    next_invoice_date DATE NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB;
