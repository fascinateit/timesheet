-- Helpdesk / Ticketing System

CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number   VARCHAR(20) NOT NULL UNIQUE,
    employee_id     INT NOT NULL,
    ticket_type     ENUM('HR','IT','Admin','Finance','Other') NOT NULL DEFAULT 'HR',
    category        VARCHAR(80),
    subject         VARCHAR(255) NOT NULL,
    description     TEXT,
    priority        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
    status          ENUM('open','in_progress','on_hold','resolved','closed') NOT NULL DEFAULT 'open',
    assigned_to     INT DEFAULT NULL,
    resolution      TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS helpdesk_comments (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id   INT NOT NULL,
    author_id   INT NOT NULL,
    comment     TEXT NOT NULL,
    is_internal TINYINT(1) NOT NULL DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES helpdesk_tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS helpdesk_document_requests (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    request_number  VARCHAR(20) NOT NULL UNIQUE,
    employee_id     INT NOT NULL,
    document_type   VARCHAR(80) NOT NULL,
    purpose         TEXT,
    status          ENUM('pending','uploaded','approved','rejected','downloaded') NOT NULL DEFAULT 'pending',
    uploaded_by     INT DEFAULT NULL,
    file_url        VARCHAR(500),
    original_name   VARCHAR(255),
    admin_note      TEXT,
    requested_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_at     DATETIME DEFAULT NULL,
    approved_at     DATETIME DEFAULT NULL,
    downloaded_at   DATETIME DEFAULT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES employees(id) ON DELETE SET NULL
);
