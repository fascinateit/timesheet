-- Migration to add GST Number for Clients Table
ALTER TABLE clients ADD COLUMN gst_number VARCHAR(100);
