USE projectpulse;

ALTER TABLE clients
  ADD COLUMN email        VARCHAR(200) NULL AFTER client_name,
  ADD COLUMN phone_number VARCHAR(30)  NULL AFTER email;
