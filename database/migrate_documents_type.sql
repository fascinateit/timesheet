USE projectpulse;

ALTER TABLE document_links 
  ADD COLUMN type ENUM('document', 'policy') NOT NULL DEFAULT 'document' AFTER url;
