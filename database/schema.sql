-- ============================================================
--  ProjectPulse - MySQL Schema
--  Run this once to create and seed the database
-- ============================================================

CREATE DATABASE IF NOT EXISTS projectpulse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE projectpulse;

-- ────────────────────────────────────────────────────────────
-- 1. GROUPS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `groups` (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(100)   NOT NULL UNIQUE,
    hourly_rate DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    color       VARCHAR(20)    NOT NULL DEFAULT '#3B82F6',
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 2. EMPLOYEES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(150)  NOT NULL,
    email      VARCHAR(200)  NOT NULL UNIQUE,
    group_id   INT           NULL,
    avatar     VARCHAR(10)   NOT NULL DEFAULT '??',
    emergency_contact VARCHAR(20) NULL,
    created_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_emp_group FOREIGN KEY (group_id) REFERENCES `groups`(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 3. USER ACCOUNTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_accounts (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT           NULL UNIQUE,
    username    VARCHAR(80)   NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role        ENUM('admin','employee') NOT NULL DEFAULT 'employee',
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 4. PROJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    code       VARCHAR(50)    NOT NULL UNIQUE,
    name       VARCHAR(200)   NOT NULL,
    client     VARCHAR(200)   NULL,
    budget     DECIMAL(15,2)  NOT NULL DEFAULT 0.00,
    status     ENUM('active','on-hold','inactive') NOT NULL DEFAULT 'active',
    start_date DATE           NULL,
    end_date   DATE           NULL,
    created_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 5. PROJECT ↔ GROUP  (M:M junction)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_groups (
    project_id INT NOT NULL,
    group_id   INT NOT NULL,
    PRIMARY KEY (project_id, group_id),
    CONSTRAINT fk_pg_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    CONSTRAINT fk_pg_group   FOREIGN KEY (group_id)   REFERENCES `groups`(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 6. PROJECT ↔ EMPLOYEE  (M:M junction)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_employees (
    project_id  INT NOT NULL,
    employee_id INT NOT NULL,
    PRIMARY KEY (project_id, employee_id),
    CONSTRAINT fk_pe_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE CASCADE,
    CONSTRAINT fk_pe_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 7. TIMESHEETS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheets (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT            NOT NULL,
    project_id  INT            NOT NULL,
    work_date   DATE           NOT NULL,
    hours       DECIMAL(5,2)   NOT NULL CHECK (hours > 0 AND hours <= 24),
    task        VARCHAR(500)   NULL,
    status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ts_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_ts_project  FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 8. LEAVES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leaves (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    leave_type  ENUM('Annual','Sick','Unpaid','Maternity','Paternity') NOT NULL DEFAULT 'Annual',
    start_date  DATE     NOT NULL,
    end_date    DATE     NOT NULL,
    reason      VARCHAR(500) NULL,
    status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_lv_employee FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT chk_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;



CREATE TABLE IF NOT EXISTS expenses (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    employee_id  INT NOT NULL,
    project_id   INT NULL,
    title        VARCHAR(200) NOT NULL,
    amount       DECIMAL(10,2) NOT NULL,
    category     ENUM('Travel','Meals','Software','Hardware','Training','Other') NOT NULL DEFAULT 'Other',
    description  VARCHAR(1000) NULL,
    receipt_url  VARCHAR(500) NULL,
    status       ENUM('pending','approved','rejected','needs_correction') NOT NULL DEFAULT 'pending',
    admin_note   VARCHAR(500) NULL,
    submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_exp_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_exp_prj FOREIGN KEY (project_id)  REFERENCES projects(id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ────────────────────────────────────────────────────────────
-- 10. DOCUMENT LINKS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_links (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    title       VARCHAR(150) NOT NULL,
    url         VARCHAR(1000) NOT NULL,
    type        ENUM('document', 'policy') NOT NULL DEFAULT 'document',
    created_by  INT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_doc_emp FOREIGN KEY (created_by) REFERENCES employees(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
--  SEED DATA
-- ============================================================

ALTER TABLE user_accounts 
  MODIFY COLUMN role ENUM('admin','manager','employee','intras') NOT NULL DEFAULT 'employee';

ALTER TABLE employees
  ADD COLUMN joining_date DATE NULL AFTER avatar,
  ADD COLUMN ctc_annual   DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER joining_date;

CREATE TABLE IF NOT EXISTS payslips (
    id                INT AUTO_INCREMENT PRIMARY KEY,
    employee_id       INT NOT NULL,
    month             TINYINT NOT NULL,
    year              SMALLINT NOT NULL,
    gross             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    basic             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    hra               DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    transport         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    special_allowance DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    bonus             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    pf_employee       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    professional_tax  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    extra_deductions  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    net_pay           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    generated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_emp_month (employee_id, month, year),
    CONSTRAINT fk_ps_emp FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Groups
INSERT INTO `groups` (name, hourly_rate, color) VALUES
('Senior Developers', 120.00, '#3B82F6'),
('Project Managers',   95.00, '#8B5CF6'),
('QA Engineers',       75.00, '#10B981'),
('DevOps Engineers',  110.00, '#F59E0B');

-- Employees
INSERT INTO employees (name, email, group_id, avatar) VALUES
('Arjun Mehta',  'arjun@corp.io',  1, 'AM'),
('Sandeep Kumar MD', 'sandeepkumar.d@fascinateit.com',  2, 'SK'),
('Rahul Nair',   'rahul@corp.io',  3, 'RN'),
('Sneha Iyer',   'sneha@corp.io',  1, 'SI'),
('Vikram Das',   'vikram@corp.io', 4, 'VD');

-- User accounts  (passwords are bcrypt hashes of 'pass123')
-- Admin password hash = 'admin123'
INSERT INTO user_accounts (employee_id, username, password_hash, role, active) VALUES
(NULL, 'admin',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFGSRQXfHV5Gruy', 'admin',    1),
(1,    'arjun',  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHdqa1eVy', 'employee', 1),
(2,    'sandeepkumarmd',  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHdqa1eVy', 'admin', 1),
(3,    'rahul',  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHdqa1eVy', 'employee', 1),
(4,    'sneha',  '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHdqa1eVy', 'employee', 1),
(5,    'vikram', '$2b$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uHdqa1eVy', 'employee', 1);

-- Projects
INSERT INTO projects (code, name, client, budget, status, start_date, end_date) VALUES
('PRJ-2024-001', 'Cloud Migration',     'TechCorp Ltd', 150000.00, 'active',  '2024-01-15', '2024-12-31'),
('PRJ-2024-002', 'E-Commerce Platform', 'RetailX Inc',   95000.00, 'active',  '2024-03-01', '2024-09-30'),
('PRJ-2024-003', 'Data Warehouse',      'FinanceHub',   200000.00, 'on-hold', '2024-02-01', '2025-01-31');

-- Project ↔ Group assignments
INSERT INTO project_groups (project_id, group_id) VALUES
(1,1),(1,4),(2,1),(2,2),(2,3),(3,1),(3,2);

-- Project ↔ Employee assignments
INSERT INTO project_employees (project_id, employee_id) VALUES
(1,1),(1,5),(2,2),(2,3),(2,4),(3,1),(3,2);

-- Timesheets
INSERT INTO timesheets (employee_id, project_id, work_date, hours, task, status) VALUES
(1, 1, '2024-07-01', 8.0,  'Backend API development',  'approved'),
(2, 1, '2024-07-01', 6.0,  'Sprint planning',           'approved'),
(4, 2, '2024-07-02', 7.5,  'Frontend implementation',   'pending'),
(3, 2, '2024-07-02', 5.0,  'Test case writing',         'approved'),
(5, 1, '2024-07-03', 8.0,  'CI/CD pipeline setup',      'approved'),
(1, 3, '2024-07-03', 4.0,  'Schema design',             'pending');

-- Leaves
INSERT INTO leaves (employee_id, leave_type, start_date, end_date, reason, status) VALUES
(1, 'Annual', '2024-07-10', '2024-07-12', 'Family vacation',    'approved'),
(3, 'Sick',   '2024-07-05', '2024-07-05', 'Medical appointment','approved'),
(2, 'Annual', '2024-07-20', '2024-07-25', 'Personal travel',    'pending');

UPDATE user_accounts SET role='manager' WHERE username='arjun';
