USE projectpulse;

ALTER TABLE payslips
    ADD COLUMN is_approved TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN approved_by INT DEFAULT NULL,
    ADD COLUMN approved_at DATETIME DEFAULT NULL,
    ADD COLUMN download_requested TINYINT(1) NOT NULL DEFAULT 0;
