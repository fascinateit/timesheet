-- Migration: Add TDS amount column to invoices
-- TDS is calculated at 10% of subtotal (hours × rate)
ALTER TABLE invoices ADD COLUMN tds_amount DECIMAL(12,2) NULL DEFAULT NULL;
