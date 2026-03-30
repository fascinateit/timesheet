-- Performance Management Tables

CREATE TABLE IF NOT EXISTS performance_goals (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    goal_type       ENUM('OKR','KPI','Personal') NOT NULL DEFAULT 'KPI',
    cycle           VARCHAR(20) NOT NULL DEFAULT 'Annual',
    year            INT NOT NULL DEFAULT 2025,
    target          VARCHAR(255),
    progress        INT NOT NULL DEFAULT 0,
    weight          INT NOT NULL DEFAULT 100,
    status          ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_self_assessments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    cycle           VARCHAR(20) NOT NULL DEFAULT 'Annual',
    year            INT NOT NULL DEFAULT 2025,
    achievements    TEXT,
    challenges      TEXT,
    goals_next      TEXT,
    rating          TINYINT NOT NULL DEFAULT 0,
    status          ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
    submitted_at    DATETIME DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_feedback (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    reviewer_id     INT NOT NULL,
    cycle           VARCHAR(20) NOT NULL DEFAULT 'Annual',
    year            INT NOT NULL DEFAULT 2025,
    category        VARCHAR(80) NOT NULL,
    feedback_text   TEXT,
    rating          TINYINT NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_reviews (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    reviewer_id     INT NOT NULL,
    cycle           VARCHAR(20) NOT NULL DEFAULT 'Annual',
    year            INT NOT NULL DEFAULT 2025,
    technical       TINYINT NOT NULL DEFAULT 0,
    communication   TINYINT NOT NULL DEFAULT 0,
    teamwork        TINYINT NOT NULL DEFAULT 0,
    delivery        TINYINT NOT NULL DEFAULT 0,
    overall         TINYINT NOT NULL DEFAULT 0,
    comments        TEXT,
    status          ENUM('draft','submitted','acknowledged') NOT NULL DEFAULT 'draft',
    submitted_at    DATETIME DEFAULT NULL,
    acknowledged_at DATETIME DEFAULT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE CASCADE
);
