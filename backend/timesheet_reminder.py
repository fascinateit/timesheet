"""timesheet_reminder.py – Friday reminder to submit this week's timesheet.

Sends a personal email to every *currently working* employee (employment_status
'working', or 'resigned' but still serving notice) who has an active login and
still has something to do for the current week:
  • weekdays with no hours logged (excluding approved leave),
  • draft entries not yet submitted,
  • rejected entries that need fixing.
People whose week is already fully submitted, or who are on leave all week, are skipped.

Scheduled from run_scheduler.py: Fridays at 08:00 IST by default
(TS_REMINDER_DAY / TS_REMINDER_HOUR / TS_REMINDER_MINUTE).

Manual use:
    python timesheet_reminder.py --dry-run          # list who would get it, send nothing
    python timesheet_reminder.py --to me@x.com      # send every reminder to one test inbox
    python timesheet_reminder.py                    # send for real

Environment (all optional):
    TS_REMINDER_SKIP_DONE=true      # false = remind everyone, even if already submitted
    TS_REMINDER_INCLUDE_ADMINS=false
    TS_DAY_TARGET=9                 # hours per day shown in the email
    PORTAL_URL=https://myportal.fascinateit.com/
"""
import os
import sys
import time
import argparse
from datetime import date, timedelta
from html import escape

from db import query
from mailer import send_html_email

PORTAL_URL = os.environ.get("PORTAL_URL", "https://myportal.fascinateit.com/")
DAY_TARGET = float(os.environ.get("TS_DAY_TARGET", "9"))
SKIP_DONE = os.environ.get("TS_REMINDER_SKIP_DONE", "true").lower() != "false"
INCLUDE_ADMINS = os.environ.get("TS_REMINDER_INCLUDE_ADMINS", "false").lower() == "true"
DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


def _week(today=None):
    today = today or date.today()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


def _has_column(table, column):
    try:
        return bool(query(f"SHOW COLUMNS FROM {table} LIKE %s", (column,)))
    except Exception:
        return False


def _recipients(monday, sunday, today):
    """Currently working employees with an active login (one row per employee)."""
    status_filter = ""
    args = [sunday]
    if _has_column("employees", "employment_status"):
        # still working, or resigned but last working day is today or later
        status_filter = "AND (e.employment_status = 'working' OR (e.relieving_date IS NOT NULL AND e.relieving_date >= %s))"
        args.append(today)
    role_filter = "" if INCLUDE_ADMINS else "AND ua.role <> 'admin'"
    rows = query(
        f"""
        SELECT e.id, e.name, e.email, e.joining_date,
               {"e.relieving_date" if _has_column("employees", "relieving_date") else "NULL AS relieving_date"},
               MIN(ua.role) AS role
        FROM   employees e
        JOIN   user_accounts ua ON ua.employee_id = e.id AND ua.active = 1
        WHERE  e.email IS NOT NULL AND e.email <> ''
          AND  (e.joining_date IS NULL OR e.joining_date <= %s)
          {status_filter}
          {role_filter}
        GROUP  BY e.id, e.name, e.email, e.joining_date{", e.relieving_date" if _has_column("employees", "relieving_date") else ""}
        ORDER  BY e.name
        """,
        tuple(args),
    ) or []
    return rows


def _week_entries(monday, sunday):
    rows = query(
        """
        SELECT employee_id, work_date, hours, status
        FROM   timesheets
        WHERE  work_date BETWEEN %s AND %s
        """,
        (monday, sunday),
    ) or []
    out = {}
    for r in rows:
        out.setdefault(r["employee_id"], []).append(r)
    return out


def _week_leaves(monday, sunday):
    rows = query(
        """
        SELECT employee_id, start_date, end_date, COALESCE(is_half_day, 0) AS is_half_day
        FROM   leaves
        WHERE  status = 'approved' AND start_date <= %s AND end_date >= %s
        """,
        (sunday, monday),
    ) or []
    out = {}
    for r in rows:
        out.setdefault(r["employee_id"], []).append(r)
    return out


def _status_for(emp, entries, leaves, monday, today):
    """Work out what this employee still needs to do this week."""
    weekdays = [monday + timedelta(days=i) for i in range(5)]
    # days they are actually expected to work this week
    start = emp.get("joining_date") or monday
    end = emp.get("relieving_date") or (monday + timedelta(days=6))
    on_leave = set()
    for lv in leaves:
        if lv["is_half_day"]:
            continue  # half day still expects some hours
        d = max(lv["start_date"], monday)
        while d <= min(lv["end_date"], monday + timedelta(days=4)):
            on_leave.add(d)
            d += timedelta(days=1)
    expected_days = [d for d in weekdays if start <= d <= end and d not in on_leave and d <= today]
    if not [d for d in weekdays if start <= d <= end and d not in on_leave]:
        return None  # on leave / not employed all week → nothing to ask

    by_day = {}
    for e in entries:
        by_day.setdefault(e["work_date"], []).append(e)
    hours = lambda st: sum(float(e["hours"] or 0) for e in entries if e["status"] == st)
    drafts = [e for e in entries if e["status"] == "draft"]
    rejected = [e for e in entries if e["status"] == "rejected"]
    submitted_days = {d for d, lst in by_day.items() if any(x["status"] in ("pending", "approved") for x in lst)}
    # Earlier weekdays with nothing logged are "missing"; today (the reminder runs Friday
    # morning) is listed separately as "log today's hours", not as a gap.
    missing = [d for d in expected_days if d < today and d not in by_day]
    today_pending = today in expected_days and today not in submitted_days
    unsubmitted = [d for d in expected_days if d in by_day and d not in submitted_days]
    done = not drafts and not rejected and not missing and not unsubmitted and not today_pending
    return {
        "missing": missing, "today_pending": today_pending, "today": today,
        "drafts": drafts, "rejected": rejected, "done": done,
        "logged": sum(float(e["hours"] or 0) for e in entries),
        "submitted": hours("pending") + hours("approved"),
        "draft_h": hours("draft"),
        "leave_days": len([d for d in weekdays if d in on_leave]),
        "expected_h": len([d for d in weekdays if start <= d <= end and d not in on_leave]) * DAY_TARGET,
    }


def _fmt_day(d):
    return f"{DAY_NAMES[d.weekday()]} {d.day} {d.strftime('%b')}"


def build_html(emp, st, monday, sunday):
    first = escape((emp["name"] or "there").split()[0])
    week = f"{monday.day} {monday.strftime('%b')} – {sunday.day} {sunday.strftime('%b %Y')}"
    items = []
    if st["missing"]:
        items.append(("#ef4444", "📅", f"No hours logged for {len(st['missing'])} day{'s' if len(st['missing']) != 1 else ''}",
                      ", ".join(_fmt_day(d) for d in st["missing"])))
    if st.get("today_pending"):
        items.append(("#f59e0b", "🕗", f"Today ({_fmt_day(st['today'])})",
                      "Log today's hours before you finish for the day"))
    if st["drafts"]:
        items.append(("#3b82f6", "📝", f"{len(st['drafts'])} draft entr{'y' if len(st['drafts']) == 1 else 'ies'} not submitted",
                      f"{st['draft_h']:g}h saved as draft — click <b>Submit week</b> to send them for approval"))
    if st["rejected"]:
        items.append(("#a855f7", "↩", f"{len(st['rejected'])} rejected entr{'y' if len(st['rejected']) == 1 else 'ies'} to fix",
                      "Open the entry, correct it and choose <b>Save &amp; resubmit</b>"))
    rows = "".join(f"""
        <tr><td style="padding:10px 0;border-bottom:1px solid #f1f1f4">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="width:34px;vertical-align:top;font-size:18px">{ic}</td>
            <td><div style="font-size:14px;font-weight:700;color:{c}">{t}</div>
                <div style="font-size:13px;color:#555;margin-top:2px;line-height:1.5">{s}</div></td>
          </tr></table>
        </td></tr>""" for c, ic, t, s in items)
    pct = 0 if not st["expected_h"] else min(100, round(st["submitted"] / st["expected_h"] * 100))
    leave_note = f" · {st['leave_days']} day{'s' if st['leave_days'] != 1 else ''} on leave" if st["leave_days"] else ""
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;background:#f0f2f5;padding:24px 0;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
    <tr><td style="background:linear-gradient(135deg,#3b82f6,#7c3aed);border-radius:14px 14px 0 0;padding:26px 28px;color:#fff">
      <div style="font-size:30px;line-height:1">⏱</div>
      <div style="font-size:21px;font-weight:800;margin-top:8px">Timesheet reminder</div>
      <div style="font-size:13px;opacity:.85;margin-top:4px">Week of {week}</div>
    </td></tr>
    <tr><td style="background:#ffffff;padding:24px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 14px 14px">
      <p style="margin:0 0 14px;font-size:15px;color:#1f2937">Hi {first},</p>
      <p style="margin:0 0 18px;font-size:14px;color:#4b5563;line-height:1.6">
        Good morning! It's the last working day of the week — please complete your timesheet and
        click <b>Submit week</b> by the end of today so it can be approved. Here's what's still pending:</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 6px"><tr>
        <td style="font-size:12px;color:#6b7280">Submitted this week: <b style="color:#111827">{st['submitted']:g}h</b> of {st['expected_h']:g}h{leave_note}</td>
        <td align="right" style="font-size:12px;color:#6b7280">{pct}%</td></tr>
        <tr><td colspan="2" style="padding-top:6px"><div style="height:8px;background:#e5e7eb;border-radius:6px;overflow:hidden">
          <div style="height:8px;width:{pct}%;background:#22c55e;border-radius:6px"></div></div></td></tr>
      </table>
      <div style="text-align:center;margin:24px 0 6px">
        <a href="{PORTAL_URL}" style="display:inline-block;background:#3b82f6;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 26px;border-radius:10px">Open My Timesheets →</a>
      </div>
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af;line-height:1.5">If you've already submitted after this email was sent, you can ignore it. Questions? Reply to your manager or HR.</p>
    </td></tr>
    <tr><td style="text-align:center;font-size:11px;color:#9ca3af;padding:12px">My Portal · Fascinate IT</td></tr>
  </table></td></tr></table>
</body></html>"""


def send_timesheet_reminders(dry_run=False, override_to=None, today=None):
    """Send this week's reminders. Returns (sent, skipped, failed)."""
    today = today or date.today()
    monday, sunday = _week(today)
    people = _recipients(monday, sunday, today)
    entries = _week_entries(monday, sunday)
    leaves = _week_leaves(monday, sunday)
    sent = skipped = failed = 0
    subject = f"⏱ Reminder: submit your timesheet for {monday.day} {monday.strftime('%b')} – {sunday.day} {sunday.strftime('%b')}"
    for emp in people:
        st = _status_for(emp, entries.get(emp["id"], []), leaves.get(emp["id"], []), monday, today)
        if st is None or (SKIP_DONE and st["done"]):
            skipped += 1
            print(f"[ts-reminder] skip  {emp['name']:<28} {'on leave/not employed' if st is None else 'already submitted'}")
            continue
        to = override_to or emp["email"]
        summary = f"missing={len(st['missing'])} drafts={len(st['drafts'])} rejected={len(st['rejected'])}"
        if dry_run:
            print(f"[ts-reminder] WOULD {emp['name']:<28} -> {to}  ({summary})")
            sent += 1
            continue
        try:
            send_html_email(subject, build_html(emp, st, monday, sunday), [to])
            sent += 1
            print(f"[ts-reminder] sent  {emp['name']:<28} -> {to}  ({summary})")
            time.sleep(0.4)  # stay well under Graph send limits
        except Exception as e:
            failed += 1
            print(f"[ts-reminder] FAIL  {emp['name']:<28} -> {to}: {e}")
    print(f"[ts-reminder] done: {sent} {'would be ' if dry_run else ''}sent, {skipped} skipped, {failed} failed "
          f"(week {monday} – {sunday})")
    return sent, skipped, failed


if __name__ == "__main__":
    # Same as wishes.py / daily_report.py: load .env when run as a standalone script.
    import dotenv
    dotenv.load_dotenv()
    # pick up any reminder settings defined in .env
    PORTAL_URL = os.environ.get("PORTAL_URL", PORTAL_URL)
    DAY_TARGET = float(os.environ.get("TS_DAY_TARGET", DAY_TARGET))
    SKIP_DONE = os.environ.get("TS_REMINDER_SKIP_DONE", "true" if SKIP_DONE else "false").lower() != "false"
    INCLUDE_ADMINS = os.environ.get("TS_REMINDER_INCLUDE_ADMINS", "true" if INCLUDE_ADMINS else "false").lower() == "true"

    ap = argparse.ArgumentParser(description="Send Friday timesheet reminders")
    ap.add_argument("--dry-run", action="store_true", help="list recipients without sending")
    ap.add_argument("--to", help="send all reminders to this address instead (testing)")
    a = ap.parse_args()
    s, k, f = send_timesheet_reminders(dry_run=a.dry_run, override_to=a.to)
    sys.exit(1 if f else 0)
