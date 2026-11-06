-- Contractor role: can only log and submit their own timesheets.
-- (The backend also applies this automatically the first time a contractor account is saved.)
ALTER TABLE user_accounts
  MODIFY COLUMN role ENUM('admin','manager','employee','intras','contractor') NOT NULL DEFAULT 'employee';
