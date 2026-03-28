-- Performance Management Tables

CREATE TABLE IF NOT EXISTS performance_goals (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    goal_type       ENUM('OKR','KPI') NOT NULL DEFAULT 'OKR',
    review_cycle    VARCHAR(20) NOT NULL DEFAULT 'Annual',
    due_date        DATE,
    weight          INT DEFAULT 100,
    progress        INT DEFAULT 0,
    status          ENUM('active','achieved','missed','cancelled') NOT NULL DEFAULT 'active',
    created_by      INT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_self_assessments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    review_period   VARCHAR(20) NOT NULL,
    achievements    TEXT,
    challenges      TEXT,
    goals_next      TEXT,
    self_rating     DECIMAL(3,1),
    status          ENUM('draft','submitted') NOT NULL DEFAULT 'draft',
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_period_sa (employee_id, review_period),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_feedback (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    reviewer_id     INT NOT NULL,
    review_period   VARCHAR(20) NOT NULL,
    category        VARCHAR(50) DEFAULT 'General',
    feedback_text   TEXT NOT NULL,
    rating          DECIMAL(3,1),
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS performance_reviews (
    id                    INT AUTO_INCREMENT PRIMARY KEY,
    employee_id           INT NOT NULL,
    reviewer_id           INT NOT NULL,
    review_period         VARCHAR(20) NOT NULL,
    technical_rating      DECIMAL(3,1),
    communication_rating  DECIMAL(3,1),
    teamwork_rating       DECIMAL(3,1),
    leadership_rating     DECIMAL(3,1),
    overall_rating        DECIMAL(3,1),
    strengths             TEXT,
    improvements          TEXT,
    comments              TEXT,
    status                ENUM('draft','submitted','acknowledged') NOT NULL DEFAULT 'draft',
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_period_rev (employee_id, review_period),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE CASCADE
);
