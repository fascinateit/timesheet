-- 1. Add manager_id to employees table, referencing another employee
ALTER TABLE employees 
ADD COLUMN manager_id INT NULL AFTER group_id,
ADD CONSTRAINT fk_emp_manager FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

-- 2. Modify projects status enum to include completed and closed
ALTER TABLE projects
MODIFY COLUMN status ENUM('active', 'on-hold', 'inactive', 'completed', 'closed') NOT NULL DEFAULT 'active';
