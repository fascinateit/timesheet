ALTER TABLE expenses MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'needs_correction', 'paid') DEFAULT 'pending';
