USE projectpulse;

CREATE TABLE IF NOT EXISTS onboarding_records (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  employee_id   INT NOT NULL,
  status        ENUM('pending','in_progress','completed') NOT NULL DEFAULT 'pending',
  joining_date  DATE,
  laptop_issued TINYINT(1) NOT NULL DEFAULT 0,
  id_card_issued TINYINT(1) NOT NULL DEFAULT 0,
  email_created  TINYINT(1) NOT NULL DEFAULT 0,
  system_access  TINYINT(1) NOT NULL DEFAULT 0,
  induction_done TINYINT(1) NOT NULL DEFAULT 0,
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS onboarding_documents (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id   INT NOT NULL,
  doc_type        VARCHAR(100) NOT NULL,
  filename        VARCHAR(512) NOT NULL,
  sharepoint_url  VARCHAR(2048),
  uploaded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE
);
