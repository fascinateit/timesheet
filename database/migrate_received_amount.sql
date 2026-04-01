-- Add received_amount column to projects table
ALTER TABLE projects
  ADD COLUMN received_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00
  AFTER budget;
