-- Half-day leave support: a leave request can be flagged as half-day
-- (only valid for a single-day request, i.e. start_date = end_date)
ALTER TABLE leaves
  ADD COLUMN is_half_day TINYINT(1) NOT NULL DEFAULT 0 AFTER leave_type;
