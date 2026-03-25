USE projectpulse;

ALTER TABLE company_expenses
    ADD COLUMN cleared_date DATE DEFAULT NULL;
