"""routes/leaves.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
from notifications import notify_leave_requested, notify_leave_actioned
import json
from datetime import date

leaves_bp = Blueprint("leaves", __name__)

# Leave types that consume from the shared balance bucket
BALANCE_TYPES = {"Sick", "Annual"}


def _fmt(row):
    for k in ("start_date", "end_date", "created_at", "updated_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


def _day_count(start_str, end_str):
    """Return number of calendar days inclusive."""
    try:
        s = date.fromisoformat(str(start_str)[:10])
        e = date.fromisoformat(str(end_str)[:10])
        return max((e - s).days + 1, 0)
    except Exception:
        return 0


def _ensure_balance_row(emp_id):
    """Make sure a leave_balance row exists for this employee."""
    execute(
        "INSERT IGNORE INTO leave_balance (employee_id, balance, total_credited, total_used) VALUES (%s, 0, 0, 0)",
        (emp_id,),
    )


# ── List leaves ──────────────────────────────────────────────────────────────

@leaves_bp.route("/", methods=["GET"])
@jwt_required()
def list_leaves():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    status = request.args.get("status")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql  = """
        SELECT l.*, e.name AS employee_name, e.avatar, e.group_id,
               g.color AS group_color
        FROM   leaves l
        JOIN   employees e ON e.id = l.employee_id
        LEFT JOIN `groups` g ON g.id = e.group_id
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND l.employee_id = %s"; args.append(emp_id)
    if status:
        sql += " AND l.status = %s";      args.append(status)
    if user["role"] == "manager" and not emp_id:
        sql += " AND (l.employee_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])
    sql += " ORDER BY l.start_date DESC"

    return jsonify([_fmt(r) for r in query(sql, args)]), 200


# ── Leave balance ─────────────────────────────────────────────────────────────

@leaves_bp.route("/balance", methods=["GET"])
@jwt_required()
def get_balance():
    """Return leave balance for an employee.
    Employees see their own; admins can pass ?employee_id=N."""
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")

    if user["role"] == "employee":
        emp_id = user["employee_id"]
    elif not emp_id:
        return jsonify(error="employee_id required"), 400

    _ensure_balance_row(emp_id)
    row = query(
        "SELECT balance, total_credited, total_used, last_credited_month FROM leave_balance WHERE employee_id=%s",
        (emp_id,), fetch="one",
    )
    return jsonify(row or {"balance": 0, "total_credited": 0, "total_used": 0, "last_credited_month": None}), 200


# ── Create leave request ──────────────────────────────────────────────────────

@leaves_bp.route("/", methods=["POST"])
@jwt_required()
def create_leave():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}

    emp_id = user["employee_id"] if user["role"] in ("employee", "manager") else d.get("employeeId")
    if not all([emp_id, d.get("startDate"), d.get("endDate")]):
        return jsonify(error="employeeId, startDate, endDate are required"), 400

    leave_type = d.get("type", "Annual")
    days       = _day_count(d["startDate"], d["endDate"])

    # Deduct from balance if this is a balance-consuming leave type
    if leave_type in BALANCE_TYPES and days > 0:
        _ensure_balance_row(emp_id)
        bal_row = query(
            "SELECT balance FROM leave_balance WHERE employee_id=%s FOR UPDATE",
            (emp_id,), fetch="one",
        )
        current = float(bal_row["balance"]) if bal_row else 0.0
        if current < days:
            return jsonify(
                error=f"Insufficient leave balance. Available: {current:.0f} day(s), requested: {days} day(s)."
            ), 400
        execute(
            "UPDATE leave_balance SET balance=balance-%s, total_used=total_used+%s WHERE employee_id=%s",
            (days, days, emp_id),
        )

    lid = execute(
        "INSERT INTO leaves (employee_id,leave_type,start_date,end_date,reason,status) VALUES (%s,%s,%s,%s,%s,'pending')",
        (emp_id, leave_type, d.get("startDate"), d.get("endDate"), d.get("reason", "")),
    )
    row = query(
        """
        SELECT l.*, e.name AS employee_name, e.avatar, e.group_id, g.color AS group_color
        FROM leaves l JOIN employees e ON e.id=l.employee_id LEFT JOIN `groups` g ON g.id=e.group_id
        WHERE l.id=%s
        """,
        (lid,), fetch="one",
    )
    notify_leave_requested(emp_id, leave_type, d.get("startDate"), d.get("endDate"), d.get("reason", ""))
    return jsonify(_fmt(row)), 201


# ── Approve leave ─────────────────────────────────────────────────────────────

@leaves_bp.route("/<int:lid>/approve", methods=["PATCH"])
@jwt_required()
def approve_leave(lid):
    user = json.loads(get_jwt_identity())
    lv = query("SELECT employee_id FROM leaves WHERE id=%s", (lid,), fetch="one")
    if not lv: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and lv["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (lv["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    execute("UPDATE leaves SET status='approved' WHERE id=%s", (lid,))
    notify_leave_actioned(lid, "approved")
    return jsonify(updated=True), 200


# ── Reject leave (refund balance) ─────────────────────────────────────────────

@leaves_bp.route("/<int:lid>/reject", methods=["PATCH"])
@jwt_required()
def reject_leave(lid):
    user = json.loads(get_jwt_identity())
    lv = query(
        "SELECT employee_id, leave_type, start_date, end_date, status FROM leaves WHERE id=%s",
        (lid,), fetch="one",
    )
    if not lv: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and lv["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (lv["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    # Refund balance if the leave was pending and used bucket days
    if lv["status"] == "pending" and lv["leave_type"] in BALANCE_TYPES:
        days = _day_count(lv["start_date"], lv["end_date"])
        if days > 0:
            execute(
                "UPDATE leave_balance SET balance=balance+%s, total_used=GREATEST(total_used-%s,0) WHERE employee_id=%s",
                (days, days, lv["employee_id"]),
            )

    execute("UPDATE leaves SET status='rejected' WHERE id=%s", (lid,))
    notify_leave_actioned(lid, "rejected")
    return jsonify(updated=True), 200


# ── Delete leave (refund balance if pending) ──────────────────────────────────

@leaves_bp.route("/<int:lid>", methods=["DELETE"])
@jwt_required()
def delete_leave(lid):
    user = json.loads(get_jwt_identity())
    lv = query(
        "SELECT employee_id, leave_type, start_date, end_date, status FROM leaves WHERE id=%s",
        (lid,), fetch="one",
    )
    if not lv: return jsonify(error="Not found"), 404
    if user["role"] in ("employee", "manager") and lv["employee_id"] != user["employee_id"]:
        if user["role"] == "manager":
            emp = query("SELECT manager_id FROM employees WHERE id=%s", (lv["employee_id"],), fetch="one")
            if not emp or emp.get("manager_id") != user["employee_id"]:
                return jsonify(error="Forbidden"), 403
        else:
            return jsonify(error="Forbidden"), 403

    # Refund balance for pending bucket-type leaves
    if lv["status"] == "pending" and lv["leave_type"] in BALANCE_TYPES:
        days = _day_count(lv["start_date"], lv["end_date"])
        if days > 0:
            execute(
                "UPDATE leave_balance SET balance=balance+%s, total_used=GREATEST(total_used-%s,0) WHERE employee_id=%s",
                (days, days, lv["employee_id"]),
            )

    execute("DELETE FROM leaves WHERE id=%s", (lid,))
    return jsonify(deleted=True), 200


# ── All balances (admin / manager) ───────────────────────────────────────────

@leaves_bp.route("/all-balances", methods=["GET"])
@jwt_required()
def all_balances():
    """Return { employee_id: balance, ... } for all employees.
    Admin sees everyone; manager sees their direct reports."""
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    if user["role"] == "manager":
        rows = query(
            """
            SELECT lb.employee_id, lb.balance, lb.total_credited, lb.total_used
            FROM   leave_balance lb
            JOIN   employees e ON e.id = lb.employee_id
            WHERE  e.manager_id = %s OR e.id = %s
            """,
            (user["employee_id"], user["employee_id"]),
            fetch="all",
        ) or []
    else:
        rows = query(
            "SELECT employee_id, balance, total_credited, total_used FROM leave_balance",
            fetch="all",
        ) or []

    return jsonify({
        str(r["employee_id"]): {
            "balance": float(r["balance"]),
            "total_credited": float(r["total_credited"]),
            "total_used": float(r["total_used"]),
        }
        for r in rows
    }), 200


# ── Monthly credit endpoint (admin-triggered or cron) ────────────────────────

@leaves_bp.route("/credit-monthly", methods=["POST"])
@jwt_required()
def credit_monthly():
    """Credit 2 leaves to every active employee for the current month.
    Idempotent – skips employees already credited this month."""
    user = json.loads(get_jwt_identity())
    if user["role"] != "admin":
        return jsonify(error="Admin only"), 403

    month_key = date.today().strftime("%Y-%m")
    employees = query("SELECT id FROM employees", fetch="all") or []
    credited = 0

    for emp in employees:
        eid = emp["id"]
        _ensure_balance_row(eid)
        bal = query(
            "SELECT last_credited_month FROM leave_balance WHERE employee_id=%s",
            (eid,), fetch="one",
        )
        if bal and bal.get("last_credited_month") == month_key:
            continue  # already credited this month
        execute(
            "UPDATE leave_balance SET balance=balance+2, total_credited=total_credited+2, last_credited_month=%s WHERE employee_id=%s",
            (month_key, eid),
        )
        credited += 1

    return jsonify(credited=credited, month=month_key), 200
