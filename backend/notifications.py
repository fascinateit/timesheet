"""notifications.py – Email notifications for employee actions via Microsoft Graph API."""
import logging
from db import query
from mailer import send_html_email

DEFAULT_CC = "sandeepkumar.md@fascinateit.com"
log = logging.getLogger(__name__)

# ── helpers ────────────────────────────────────────────────────────────────────

def _emp_and_manager(emp_id):
    """Return (employee row, manager_email or None) for a given employee id."""
    row = query(
        """
        SELECT e.name, e.email,
               m.name  AS manager_name,
               m.email AS manager_email
        FROM   employees e
        LEFT JOIN employees m ON m.id = e.manager_id
        WHERE  e.id = %s
        """,
        (emp_id,), fetch="one"
    )
    return row or {}


def _manager_recipients(emp_row):
    """Build recipient list for manager notifications: manager + default CC."""
    mgr_email = (emp_row.get("manager_email") or "").strip()
    recipients = []
    if mgr_email:
        recipients.append(mgr_email)
    if DEFAULT_CC not in recipients:
        recipients.append(DEFAULT_CC)
    return recipients


def _employee_recipients(emp_row):
    """Recipient list for employee notifications."""
    emp_email = (emp_row.get("email") or "").strip()
    return [emp_email] if emp_email else [DEFAULT_CC]


def _fire(subject, html, recipients):
    """Send email, swallow errors so API calls never fail due to mail issues."""
    try:
        send_html_email(subject, html, recipients)
    except Exception as exc:
        log.warning("Email send failed: %s", exc)


def _card(title, color, rows_html, footer=""):
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f4f4f4;padding:24px">
      <div style="background:#1e2a3a;border-radius:10px 10px 0 0;padding:20px 24px">
        <h2 style="margin:0;color:{color};font-size:18px">{title}</h2>
      </div>
      <div style="background:#ffffff;border-radius:0 0 10px 10px;padding:24px;border:1px solid #e0e0e0">
        <table style="width:100%;border-collapse:collapse">
          {rows_html}
        </table>
        {f'<p style="margin-top:20px;font-size:13px;color:#666">{footer}</p>' if footer else ''}
      </div>
      <p style="text-align:center;font-size:11px;color:#999;margin-top:16px">
        My Portal · Fascinate IT
      </p>
    </div>"""


def _row(label, value):
    return f"""
      <tr>
        <td style="padding:8px 4px;color:#555;font-size:13px;width:40%;vertical-align:top">{label}</td>
        <td style="padding:8px 4px;color:#1e2a3a;font-size:13px;font-weight:600">{value}</td>
      </tr>"""


# ── LEAVE notifications ────────────────────────────────────────────────────────

def notify_leave_requested(emp_id, leave_type, start_date, end_date, reason):
    emp = _emp_and_manager(emp_id)
    if not emp:
        return
    rows = (
        _row("Employee", emp.get("name", "—")) +
        _row("Leave Type", leave_type) +
        _row("From", str(start_date)) +
        _row("To", str(end_date)) +
        _row("Reason", reason or "—")
    )
    html = _card(
        "📋 New Leave Request",
        "#4f9cf9",
        rows,
        "Please log in to My Portal to approve or reject this request."
    )
    _fire(
        f"Leave Request – {emp.get('name', 'Employee')} ({leave_type})",
        html,
        _manager_recipients(emp)
    )


def notify_leave_actioned(leave_id, action):
    lv = query(
        """
        SELECT l.leave_type, l.start_date, l.end_date,
               e.name AS emp_name, e.email AS emp_email
        FROM   leaves l
        JOIN   employees e ON e.id = l.employee_id
        WHERE  l.id = %s
        """,
        (leave_id,), fetch="one"
    )
    if not lv:
        return
    color   = "#22c55e" if action == "approved" else "#ef4444"
    icon    = "✅" if action == "approved" else "❌"
    rows = (
        _row("Leave Type", lv.get("leave_type", "—")) +
        _row("From",       str(lv.get("start_date", "—"))) +
        _row("To",         str(lv.get("end_date", "—"))) +
        _row("Status",     action.upper())
    )
    html = _card(f"{icon} Leave Request {action.capitalize()}", color, rows)
    _fire(
        f"Your Leave Request has been {action.capitalize()}",
        html,
        [lv["emp_email"]] if lv.get("emp_email") else [DEFAULT_CC]
    )


# ── EXPENSE notifications ──────────────────────────────────────────────────────

def notify_expense_requested(emp_id, title, amount, category):
    emp = _emp_and_manager(emp_id)
    if not emp:
        return
    rows = (
        _row("Employee", emp.get("name", "—")) +
        _row("Title",    title) +
        _row("Amount",   f"₹{float(amount):,.2f}") +
        _row("Category", category)
    )
    html = _card(
        "💳 New Expense Request",
        "#f59e0b",
        rows,
        "Please log in to My Portal to approve or reject this expense."
    )
    _fire(
        f"Expense Request – {emp.get('name', 'Employee')} (₹{float(amount):,.2f})",
        html,
        _manager_recipients(emp)
    )


def notify_expense_actioned(expense_id, action, note=""):
    ex = query(
        """
        SELECT ex.title, ex.amount, ex.category,
               e.name AS emp_name, e.email AS emp_email
        FROM   expenses ex
        JOIN   employees e ON e.id = ex.employee_id
        WHERE  ex.id = %s
        """,
        (expense_id,), fetch="one"
    )
    if not ex:
        return
    color_map = {"approved": "#22c55e", "rejected": "#ef4444", "needs_correction": "#f59e0b", "paid": "#4f9cf9"}
    icon_map  = {"approved": "✅", "rejected": "❌", "needs_correction": "🔄", "paid": "💸"}
    color = color_map.get(action, "#4f9cf9")
    icon  = icon_map.get(action, "ℹ")
    label = action.replace("_", " ").title()
    rows = (
        _row("Title",    ex.get("title", "—")) +
        _row("Amount",   f"₹{float(ex.get('amount', 0)):,.2f}") +
        _row("Category", ex.get("category", "—")) +
        _row("Status",   label) +
        (_row("Note", note) if note else "")
    )
    html = _card(f"{icon} Expense {label}", color, rows)
    _fire(
        f"Your Expense Request has been {label}",
        html,
        [ex["emp_email"]] if ex.get("emp_email") else [DEFAULT_CC]
    )


# ── PAYSLIP notifications ──────────────────────────────────────────────────────

def notify_payslip_download_requested(payslip_id):
    ps = query(
        """
        SELECT ps.month, ps.year,
               e.id AS emp_id, e.name AS emp_name,
               m.name  AS manager_name,
               m.email AS manager_email,
               e.email AS emp_email
        FROM   payslips ps
        JOIN   employees e ON e.id = ps.employee_id
        LEFT JOIN employees m ON m.id = e.manager_id
        WHERE  ps.id = %s
        """,
        (payslip_id,), fetch="one"
    )
    if not ps:
        return
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    period = f"{months[int(ps['month']) - 1]} {ps['year']}"
    rows = (
        _row("Employee", ps.get("emp_name", "—")) +
        _row("Payslip Period", period)
    )
    html = _card(
        "📥 Payslip Download Request",
        "#4f9cf9",
        rows,
        "Please log in to My Portal and approve the payslip download request."
    )
    mgr_email = (ps.get("manager_email") or "").strip()
    recipients = []
    if mgr_email:
        recipients.append(mgr_email)
    if DEFAULT_CC not in recipients:
        recipients.append(DEFAULT_CC)
    _fire(
        f"Payslip Download Request – {ps.get('emp_name', 'Employee')} ({period})",
        html,
        recipients
    )


def notify_payslip_approved(payslip_id):
    ps = query(
        """
        SELECT ps.month, ps.year,
               e.name AS emp_name, e.email AS emp_email
        FROM   payslips ps
        JOIN   employees e ON e.id = ps.employee_id
        WHERE  ps.id = %s
        """,
        (payslip_id,), fetch="one"
    )
    if not ps:
        return
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    period = f"{months[int(ps['month']) - 1]} {ps['year']}"
    rows = (
        _row("Payslip Period", period) +
        _row("Status", "APPROVED")
    )
    html = _card(
        "✅ Payslip Download Approved",
        "#22c55e",
        rows,
        "You can now log in to My Portal and download your payslip."
    )
    _fire(
        f"Your Payslip for {period} has been Approved",
        html,
        [ps["emp_email"]] if ps.get("emp_email") else [DEFAULT_CC]
    )
