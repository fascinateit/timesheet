"""run_scheduler.py – Standalone APScheduler process.

Run this as a separate long-lived process alongside the Flask/gunicorn server:

    # Development
    python run_scheduler.py

    # Production (background)
    nohup python run_scheduler.py > scheduler.log 2>&1 &

    # Or via Docker Compose as a separate service (see example in README)

The scheduler fires send_daily_report() every day at 06:00 IST,
send_wishes() every day at 09:00 IST, and send_timesheet_reminders()
every Friday at 08:00 IST (TS_REMINDER_DAY / TS_REMINDER_HOUR / TS_REMINDER_MINUTE).
"""
import os
import sys
import logging

# ── ensure backend/ is on the path when run from any directory ───────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
from daily_report import send_daily_report
from wishes import send_wishes
from timesheet_reminder import send_timesheet_reminders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [scheduler] %(levelname)s – %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

REPORT_HOUR   = int(os.environ.get("REPORT_HOUR",   "6"))
REPORT_MINUTE = int(os.environ.get("REPORT_MINUTE", "0"))
WISH_HOUR     = int(os.environ.get("WISH_HOUR",   "9"))
WISH_MINUTE   = int(os.environ.get("WISH_MINUTE", "0"))
TS_REMINDER_DAY    = os.environ.get("TS_REMINDER_DAY", "fri")      # mon..sun
TS_REMINDER_HOUR   = int(os.environ.get("TS_REMINDER_HOUR", "8"))
TS_REMINDER_MINUTE = int(os.environ.get("TS_REMINDER_MINUTE", "0"))


def job():
    log.info("Running daily report job …")
    try:
        send_daily_report()
        log.info("Daily report sent.")
    except Exception as e:
        log.error(f"Daily report failed: {e}")


def wishes_job():
    log.info("Running birthday/anniversary wishes job …")
    try:
        send_wishes()
        log.info("Wishes job done.")
    except Exception as e:
        log.error(f"Wishes job failed: {e}")


def timesheet_reminder_job():
    log.info("Running weekly timesheet reminder job …")
    try:
        sent, skipped, failed = send_timesheet_reminders()
        log.info(f"Timesheet reminders: {sent} sent, {skipped} skipped, {failed} failed.")
    except Exception as e:
        log.error(f"Timesheet reminder job failed: {e}")


if __name__ == "__main__":
    scheduler = BlockingScheduler(timezone="Asia/Kolkata")
    scheduler.add_job(
        job,
        trigger=CronTrigger(hour=REPORT_HOUR, minute=REPORT_MINUTE),
        id="daily_report",
        name="Daily Morning Summary Email",
        misfire_grace_time=3600,   # allow up to 1h late if server was down
    )
    scheduler.add_job(
        wishes_job,
        trigger=CronTrigger(hour=WISH_HOUR, minute=WISH_MINUTE),
        id="employee_wishes",
        name="Birthday & Work Anniversary Wishes",
        misfire_grace_time=3600,
    )

    scheduler.add_job(
        timesheet_reminder_job,
        trigger=CronTrigger(day_of_week=TS_REMINDER_DAY, hour=TS_REMINDER_HOUR, minute=TS_REMINDER_MINUTE),
        id="timesheet_reminder",
        name="Weekly Timesheet Submission Reminder",
        misfire_grace_time=3 * 3600,   # still send if the server was down for up to 3h
    )

    log.info(f"Scheduler started – daily report fires at {REPORT_HOUR:02d}:{REPORT_MINUTE:02d} IST")
    log.info(f"Wishes job fires at {WISH_HOUR:02d}:{WISH_MINUTE:02d} IST")
    log.info(f"Timesheet reminder fires every {TS_REMINDER_DAY.title()} at {TS_REMINDER_HOUR:02d}:{TS_REMINDER_MINUTE:02d} IST")
    log.info(f"Recipients: {os.environ.get('MAIL_RECIPIENTS', os.environ.get('MAIL_USERNAME', '(not set)'))}")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped.")
