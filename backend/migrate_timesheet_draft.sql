-- Add 'draft' status to timesheets and change default to 'draft'
ALTER TABLE timesheets
    MODIFY COLUMN status ENUM('draft','pending','approved','rejected') NOT NULL DEFAULT 'draft';
