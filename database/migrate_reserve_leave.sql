-- Add Reserve/Floating leave type to leaves table
ALTER TABLE leaves
  MODIFY COLUMN leave_type
    ENUM('Annual','Sick','Unpaid','Maternity','Paternity','Reserve')
    NOT NULL DEFAULT 'Annual';
