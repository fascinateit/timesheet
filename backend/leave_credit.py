"""
leave_credit.py — Monthly leave credit job
==========================================
Credits 2 leave days to every employee at the end of each month.
Run this via cron on the last day of each month, e.g.:

    # m  h  dom  mon  dow
    0   23  28-31  *   *   [ "$(date -d tomorrow +\%d)" = "01" ] && python /app/leave_credit.py

Or via a simpler monthly cron (runs on the 28th of every month):
    0   23  28  *   *   python /app/leave_credit.py

Usage:
    python leave_credit.py              # credit this month
    python leave_credit.py --month 2025-03   # credit a specific month
"""
import sys
import os
from datetime import date

# Allow running from the backend directory
sys.path.insert(0, os.path.dirname(__file__))

from db import query, execute  # noqa: E402


CREDIT_PER_MONTH = 2


def ensure_balance_row(emp_id):
    execute(
        "INSERT IGNORE INTO leave_balance (employee_id, balance, total_credited, total_used) VALUES (%s, 0, 0, 0)",
        (emp_id,),
    )


def run(month_key: str | None = None):
    if not month_key:
        month_key = date.today().strftime("%Y-%m")

    employees = query("SELECT id, name FROM employees", fetch="all") or []
    credited = 0
    skipped = 0

    print(f"[leave_credit] Running for month: {month_key}")
    print(f"[leave_credit] Employees found: {len(employees)}")

    for emp in employees:
        eid  = emp["id"]
        name = emp.get("name", f"ID:{eid}")
        ensure_balance_row(eid)

        bal = query(
            "SELECT last_credited_month FROM leave_balance WHERE employee_id=%s",
            (eid,), fetch="one",
        )
        if bal and bal.get("last_credited_month") == month_key:
            print(f"  SKIP  {name} — already credited for {month_key}")
            skipped += 1
            continue

        execute(
            """UPDATE leave_balance
               SET balance=balance+%s,
                   total_credited=total_credited+%s,
                   last_credited_month=%s
               WHERE employee_id=%s""",
            (CREDIT_PER_MONTH, CREDIT_PER_MONTH, month_key, eid),
        )
        print(f"  OK    {name} +{CREDIT_PER_MONTH} leaves")
        credited += 1

    print(f"[leave_credit] Done — credited: {credited}, skipped: {skipped}")
    return credited, skipped


if __name__ == "__main__":
    month = None
    for arg in sys.argv[1:]:
        if arg.startswith("--month"):
            parts = arg.split("=", 1)
            if len(parts) == 2:
                month = parts[1].strip()
            elif len(sys.argv) > sys.argv.index(arg) + 1:
                month = sys.argv[sys.argv.index(arg) + 1]
    run(month)
