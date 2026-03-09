-- Migration: Add `intras` to user_accounts ENUM

ALTER TABLE user_accounts 
  MODIFY COLUMN role ENUM('admin','manager','employee','intras') NOT NULL DEFAULT 'employee';
