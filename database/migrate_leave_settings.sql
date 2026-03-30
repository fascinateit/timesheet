-- Leave settings: admin-configurable key-value pairs for leave module
-- holiday_link: URL to an external holiday calendar (e.g. Google Calendar, company page)

CREATE TABLE IF NOT EXISTS leave_settings (
    setting_key   VARCHAR(64) PRIMARY KEY,
    setting_value TEXT        NULL,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed default keys
INSERT IGNORE INTO leave_settings (setting_key, setting_value) VALUES ('holiday_link', NULL);
