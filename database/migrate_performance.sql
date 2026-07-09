-- ══════════════════════════════════════════════════════════════
-- Performance Management Schema Migration
-- ══════════════════════════════════════════════════════════════

-- Goals per employee (OKR / KPI)
CREATE TABLE IF NOT EXISTS performance_goals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) DEFAULT 'OKR',         -- OKR | KPI
    target VARCHAR(100),
    current_value VARCHAR(100),
    due_date DATE,
    status VARCHAR(50) DEFAULT 'on-track',  -- on-track | at-risk | achieved | behind
    priority VARCHAR(20) DEFAULT 'medium',  -- high | medium | low
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Admin-defined named review cycles (e.g. "Q1 2026", "Annual 2025")
CREATE TABLE IF NOT EXISTS review_cycles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active',    -- active | closed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Self-assessments: one per employee per review cycle / period
CREATE TABLE IF NOT EXISTS self_assessments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    review_cycle_id INT,
    period VARCHAR(50),                     -- e.g. "Q1 2026"
    technical_skill INT DEFAULT 3,
    communication INT DEFAULT 3,
    teamwork INT DEFAULT 3,
    leadership INT DEFAULT 3,
    innovation INT DEFAULT 3,
    accomplishments TEXT,
    challenges TEXT,
    learnings TEXT,
    next_goals TEXT,
    support_needed TEXT,
    submitted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (review_cycle_id) REFERENCES review_cycles(id) ON DELETE SET NULL
);

-- Manager feedback: managers give structured feedback per employee
CREATE TABLE IF NOT EXISTS manager_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    manager_id INT NOT NULL,
    review_cycle_id INT,
    period VARCHAR(50),
    feedback_date DATE,
    overall_rating INT DEFAULT 3,
    strengths TEXT,
    areas_to_improve TEXT,
    manager_comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (review_cycle_id) REFERENCES review_cycles(id) ON DELETE SET NULL
);

-- Performance reviews: formal review per employee per cycle
CREATE TABLE IF NOT EXISTS performance_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    review_cycle_id INT,
    reviewer_id INT,                        -- manager who conducted review
    review_cycle VARCHAR(100),              -- denormalized cycle name for display
    period VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',   -- pending | in-progress | completed
    self_assessment_text TEXT,              -- legacy field
    manager_feedback_text TEXT,             -- legacy field
    final_score DECIMAL(3,1),
    badge VARCHAR(100),                     -- e.g. "Exceeds Expectations"
    review_date DATE,
    notes TEXT,
    rating INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (review_cycle_id) REFERENCES review_cycles(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewer_id) REFERENCES employees(id) ON DELETE SET NULL
);
