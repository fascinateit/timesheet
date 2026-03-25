USE projectpulse;

ALTER TABLE assets
    ADD COLUMN depreciation_amount DECIMAL(10,2) DEFAULT NULL;
