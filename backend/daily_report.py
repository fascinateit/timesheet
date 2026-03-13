"""daily_report.py – Build and send the daily morning summary email."""
import os
from datetime import date, datetime
from db import query
from mailer import send_html_email

# ── helpers ──────────────────────────────────────────────────────────────────

def _fmt_date(d):
    if not d:
        return "—"
    if hasattr(d, "strftime"):
        return d.strftime("%d %b %Y")
    try:
        return datetime.strptime(str(d), "%Y-%m-%d").strftime("%d %b %Y")
    except Exception:
        return str(d)


def _fmt_inr(n):
    try:
        return f"₹{float(n):,.2f}"
    except Exception:
        return str(n) if n else "—"


# ── HTML building blocks ──────────────────────────────────────────────────────

_STYLE = """
<style>
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f0f2f5; margin: 0; padding: 24px; color: #1a202c; }
  .wrapper { max-width: 860px; margin: 0 auto; }
  .header  { background: #1e2740; color: #ffffff; border-radius: 12px 12px 0 0; padding: 28px 32px; }
  .header h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: .3px; }
  .header p  { margin: 0; font-size: 13px; color: #94a3b8; }
  .body    { background: #ffffff; border-radius: 0 0 12px 12px; padding: 32px; }
  .section { margin-bottom: 36px; }
  .section-title {
    font-size: 16px; font-weight: 700; color: #1e2740;
    border-left: 4px solid #3b82f6; padding-left: 12px;
    margin: 0 0 14px;
  }
  .badge-count {
    display: inline-block; background: #ef444422; color: #ef4444;
    border-radius: 20px; padding: 2px 10px; font-size: 12px;
    font-weight: 700; margin-left: 8px; vertical-align: middle;
  }
  .empty { color: #94a3b8; font-size: 13px; padding: 10px 0; font-style: italic; }
  table  { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead tr { background: #f8fafc; }
  th  { padding: 10px 14px; text-align: left; font-weight: 700; color: #64748b;
        font-size: 11px; text-transform: uppercase; letter-spacing: .5px;
        border-bottom: 2px solid #e2e8f0; white-space: nowrap; }
  td  { padding: 10px 14px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td      { background: #f8fafc; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px;
           font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
  .badge-pending    { background: #f59e0b22; color: #f59e0b; }
  .badge-warning    { background: #ef444422; color: #ef4444; }
  .divider { border: none; border-top: 1px solid #e2e8f0; margin: 28px 0; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 24px; }
</style>
"""


def _section(title: str, rows_html: str, count: int) -> str:
    count_badge = f'<span class="badge-count">{count}</span>' if count else ""
    return f"""
    <div class="section">
      <h2 class="section-title">{title}{count_badge}</h2>
      {rows_html}
    </div>
    <hr class="divider">
    """


def _table(headers: list[str], rows: list[list[str]]) -> str:
    if not rows:
        return '<p class="empty">No records found.</p>'
    ths = "".join(f"<th>{h}</th>" for h in headers)
    trs = ""
    for row in rows:
        tds = "".join(f"<td>{cell}</td>" for cell in row)
        trs += f"<tr>{tds}</tr>"
    return f"<table><thead><tr>{ths}</tr></thead><tbody>{trs}</tbody></table>"


# ── data fetchers ─────────────────────────────────────────────────────────────

def _pending_invoices():
    rows = query(
        "SELECT i.invoice_number, p.name AS project_name, p.code AS project_code, "
        "c.client_name, i.amount, i.raised_date, i.payment_due_date "
        "FROM invoices i "
        "LEFT JOIN projects p ON p.id = i.project_id "
        "LEFT JOIN clients c ON c.id = i.client_id "
        "WHERE i.status = 'pending' "
        "ORDER BY i.raised_date DESC"
    )
    return rows


def _pending_timesheets():
    rows = query(
        "SELECT e.name AS employee_name, p.name AS project_name, p.code AS project_code, "
        "t.work_date, t.hours, t.task "
        "FROM timesheets t "
        "JOIN employees e ON e.id = t.employee_id "
        "JOIN projects p  ON p.id  = t.project_id "
        "WHERE t.status = 'pending' "
        "ORDER BY t.work_date DESC"
    )
    return rows


def _pending_leaves():
    rows = query(
        "SELECT e.name AS employee_name, l.leave_type, l.start_date, l.end_date, l.reason "
        "FROM leaves l "
        "JOIN employees e ON e.id = l.employee_id "
        "WHERE l.status = 'pending' "
        "ORDER BY l.start_date DESC"
    )
    return rows


def _pending_expenses():
    rows = query(
        "SELECT e.name AS employee_name, ex.title, ex.category, ex.amount, "
        "ex.submitted_at, p.name AS project_name "
        "FROM expenses ex "
        "JOIN employees e ON e.id = ex.employee_id "
        "LEFT JOIN projects p ON p.id = ex.project_id "
        "WHERE ex.status = 'pending' "
        "ORDER BY ex.submitted_at DESC"
    )
    return rows


def _expiring_subscriptions():
    rows = query(
        "SELECT app_name, start_date, expire_date, amount, link "
        "FROM subscriptions "
        "WHERE expire_date <= DATE_ADD(CURDATE(), INTERVAL 10 DAY) "
        "ORDER BY expire_date ASC"
    )
    return rows


# ── HTML section builders ─────────────────────────────────────────────────────

def _build_invoices_section():
    rows = _pending_invoices()
    headers = ["Invoice #", "Project", "Client", "Amount", "Raised Date", "Payment Due Date"]
    table_rows = [
        [
            r.get("invoice_number") or "—",
            f"{r.get('project_code', '')} – {r.get('project_name', '')}".strip(" –"),
            r.get("client_name") or "—",
            _fmt_inr(r["amount"]),
            _fmt_date(r["raised_date"]),
            _fmt_date(r.get("payment_due_date")),
        ]
        for r in rows
    ]
    return _section("Invoice Raised – Pending", _table(headers, table_rows), len(rows))


def _build_timesheets_section():
    rows = _pending_timesheets()
    headers = ["Employee", "Project", "Work Date", "Hours", "Task"]
    table_rows = [
        [
            r["employee_name"],
            f"{r.get('project_code', '')} – {r.get('project_name', '')}".strip(" –"),
            _fmt_date(r["work_date"]),
            str(r["hours"]),
            (r.get("task") or "—")[:80],
        ]
        for r in rows
    ]
    return _section("Timesheet – Not Approved", _table(headers, table_rows), len(rows))


def _build_leaves_section():
    rows = _pending_leaves()
    headers = ["Employee", "Leave Type", "From", "To", "Reason"]
    table_rows = [
        [
            r["employee_name"],
            f'<span class="badge badge-pending">{r["leave_type"]}</span>',
            _fmt_date(r["start_date"]),
            _fmt_date(r["end_date"]),
            (r.get("reason") or "—")[:80],
        ]
        for r in rows
    ]
    return _section("Leave – Not Approved", _table(headers, table_rows), len(rows))


def _build_expenses_section():
    rows = _pending_expenses()
    headers = ["Employee", "Title", "Category", "Amount", "Project", "Submitted"]
    table_rows = [
        [
            r["employee_name"],
            (r.get("title") or "—")[:60],
            f'<span class="badge badge-pending">{r["category"]}</span>',
            _fmt_inr(r["amount"]),
            r.get("project_name") or "—",
            _fmt_date(r.get("submitted_at")),
        ]
        for r in rows
    ]
    return _section("Expenses – Not Approved", _table(headers, table_rows), len(rows))


def _build_subscriptions_section():
    rows = _expiring_subscriptions()
    today = date.today()
    headers = ["App Name", "Expire Date", "Days Left", "Amount", "Link"]

    table_rows = []
    for r in rows:
        exp = r["expire_date"]
        if hasattr(exp, "date"):
            exp = exp.date()
        elif isinstance(exp, str):
            try:
                exp = datetime.strptime(exp, "%Y-%m-%d").date()
            except Exception:
                exp = None

        days_left = (exp - today).days if exp else 0
        if days_left < 0:
            days_cell = '<span class="badge badge-warning">Expired</span>'
        elif days_left == 0:
            days_cell = '<span class="badge badge-warning">Today!</span>'
        else:
            days_cell = f'<span class="badge badge-warning">{days_left}d left</span>'

        link_cell = f'<a href="{r["link"]}" style="color:#3b82f6;text-decoration:none;">Open ↗</a>' if r.get("link") else "—"

        table_rows.append([
            r["app_name"],
            _fmt_date(r["expire_date"]),
            days_cell,
            _fmt_inr(r["amount"]),
            link_cell,
        ])

    return _section("Subscriptions – Expiring Soon (≤ 10 days)", _table(headers, table_rows), len(rows))


# ── main entrypoint ───────────────────────────────────────────────────────────

def build_html() -> str:
    today_str = datetime.now().strftime("%A, %d %B %Y")
    sections = (
        _build_invoices_section()
        + _build_timesheets_section()
        + _build_leaves_section()
        + _build_expenses_section()
        + _build_subscriptions_section()
    )
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8">{_STYLE}</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Fascinate IT – Daily Summary</h1>
      <p>Report generated on {today_str}</p>
    </div>
    <div class="body">
      {sections}
      <p class="footer">This is an automated report sent every morning at 6:00 AM by Fascinate IT.</p>
    </div>
  </div>
</body>
</html>"""


def send_daily_report():
    """Build and send the daily report email. Safe to call multiple times; logs errors."""
    try:
        today_str = datetime.now().strftime("%d %b %Y")
        subject = f"Fascinate IT Daily Summary – {today_str}"
        html = build_html()
        send_html_email(subject, html)
        print(f"[daily_report] Email sent successfully at {datetime.now().isoformat()}")
    except Exception as e:
        print(f"[daily_report] ERROR: {e}")
        raise


if __name__ == "__main__":
    # Allow running as a standalone script: python daily_report.py
    import dotenv
    dotenv.load_dotenv()
    send_daily_report()
