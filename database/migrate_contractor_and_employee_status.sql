-- ============================================================================
-- DB changes: Contractor role + Employee employment status
-- Safe to run more than once (each step checks before changing anything).
-- MySQL 8.x
--
-- Run:  mysql -h <host> -u <user> -p projectpulse < migrate_contractor_and_employee_status.sql
-- ============================================================================

USE projectpulse;

-- ----------------------------------------------------------------------------
-- 1. user_accounts.role  →  add 'contractor'
--    (contractor = can only log and submit their own timesheets)
-- ----------------------------------------------------------------------------
ALTER TABLE user_accounts
  MODIFY COLUMN role ENUM('admin','manager','employee','intras','contractor') NOT NULL DEFAULT 'employee';


-- ----------------------------------------------------------------------------
-- 2. employees.employment_status  ('working' | 'resigned'), default 'working'
-- ----------------------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'employment_status');
SET @sql := IF(@col = 0,
  'ALTER TABLE employees ADD COLUMN employment_status ENUM(''working'',''resigned'') NOT NULL DEFAULT ''working''',
  'SELECT ''employees.employment_status already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 3. employees.relieving_date  (last working day; set when status = 'resigned')
-- ----------------------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'employees' AND COLUMN_NAME = 'relieving_date');
SET @sql := IF(@col = 0,
  'ALTER TABLE employees ADD COLUMN relieving_date DATE NULL AFTER employment_status',
  'SELECT ''employees.relieving_date already exists'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- 4. (Optional clean-up) clients.pan_number
--    Only exists if the short-lived "client PAN" version ran against this DB.
--    PAN was removed from the app, so drop the unused column if present.
-- ----------------------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'pan_number');
SET @sql := IF(@col = 1,
  'ALTER TABLE clients DROP COLUMN pan_number',
  'SELECT ''clients.pan_number not present (nothing to drop)'' AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- ----------------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------------
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM   information_schema.COLUMNS
WHERE  TABLE_SCHEMA = DATABASE()
  AND  ((TABLE_NAME = 'user_accounts' AND COLUMN_NAME = 'role')
     OR (TABLE_NAME = 'employees'     AND COLUMN_NAME IN ('employment_status', 'relieving_date')));
