"""routes/reports.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query

reports_bp = Blueprint("reports", __name__)


@reports_bp.route("/project/<int:pid>", methods=["GET"])
@jwt_required()
def project_report(pid):
    project = query("SELECT * FROM projects WHERE id=%s", (pid,), fetch="one")
    if not project:
        return jsonify(error="Project not found"), 404

    for k in ("start_date","end_date","created_at","updated_at"):
        if project.get(k) and hasattr(project[k],"isoformat"):
            project[k] = project[k].isoformat()

    # Per-employee hours & cost
    by_employee = query(
        """
        SELECT e.id, e.name, e.avatar, e.group_id,
               g.name AS group_name, COALESCE(e.hourly_rate, g.hourly_rate, 0) AS hourly_rate, g.color AS group_color,
               SUM(t.hours)                                                        AS total_hours,
               SUM(t.hours * COALESCE(e.hourly_rate, g.hourly_rate, 0))           AS total_cost
        FROM   timesheets t
        JOIN   employees e ON e.id = t.employee_id
        LEFT JOIN `groups` g ON g.id = e.group_id
        WHERE  t.project_id = %s AND t.status = 'approved'
        GROUP  BY e.id, e.name, e.avatar, e.group_id, g.name, e.hourly_rate, g.hourly_rate, g.color
        ORDER  BY total_cost DESC
        """,
        (pid,),
    )

    # Per-task breakdown
    by_task = query(
        """
        SELECT task, SUM(hours) AS total_hours
        FROM   timesheets
        WHERE  project_id=%s AND status='approved'
        GROUP  BY task
        ORDER  BY total_hours DESC
        """,
        (pid,),
    )

    total_hours = sum(float(r["total_hours"] or 0) for r in by_employee)
    total_cost  = sum(float(r["total_cost"]  or 0) for r in by_employee)

    return jsonify(
        project=project,
        by_employee=by_employee,
        by_task=by_task,
        total_hours=total_hours,
        total_cost=total_cost,
    ), 200


@reports_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    projects = query("SELECT * FROM projects")
    burn_rows = query(
        """
        SELECT t.project_id,
               SUM(t.hours * COALESCE(e.hourly_rate, g.hourly_rate, 0)) AS burned
        FROM   timesheets t
        JOIN   employees e ON e.id=t.employee_id
        LEFT JOIN `groups` g ON g.id=e.group_id
        GROUP  BY t.project_id
        """
    )
    burn_map = {r["project_id"]: float(r["burned"] or 0) for r in burn_rows}
    for p in projects:
        p["burned"] = burn_map.get(p["id"], 0)
        for k in ("start_date","end_date","created_at","updated_at"):
            if p.get(k) and hasattr(p[k],"isoformat"):
                p[k] = p[k].isoformat()

    total_budget        = sum(float(p["budget"]) for p in projects)
    active_budget       = sum(float(p["budget"]) for p in projects if p.get("status") == "active")
    inactive_budget     = sum(float(p["budget"]) for p in projects if p.get("status") != "active")
    total_burned        = sum(p["burned"] for p in projects)

    pending_ts = query("SELECT COUNT(*) AS n FROM timesheets WHERE status='pending'", fetch="one")["n"]
    pending_lv = query("SELECT COUNT(*) AS n FROM leaves    WHERE status='pending'", fetch="one")["n"]

    # Invoice summary
    inv_row = query(
        """
        SELECT
            COALESCE(SUM(amount), 0)                                           AS total_raised,
            COALESCE(SUM(CASE WHEN status='cleared' THEN COALESCE(payment_received, amount) ELSE 0 END), 0) AS total_cleared,
            COALESCE(SUM(CASE WHEN status!='cleared' THEN amount ELSE 0 END), 0) AS total_pending
        FROM invoices
        """,
        fetch="one",
    ) or {}

    # Pending invoice details for tooltip
    pending_inv_rows = query(
        """
        SELECT COALESCE(c.client_name, 'Unknown') AS client_name,
               i.invoice_number, i.amount
        FROM   invoices i
        LEFT JOIN clients c ON c.id = i.client_id
        WHERE  i.status != 'cleared'
        ORDER  BY i.amount DESC
        """
    )
    pending_invoices = [
        {"client_name": r["client_name"], "invoice_number": r["invoice_number"], "amount": float(r["amount"] or 0)}
        for r in pending_inv_rows
    ]

    return jsonify(
        projects=projects,
        total_budget=total_budget,
        active_budget=active_budget,
        inactive_budget=inactive_budget,
        total_burned=total_burned,
        pending_timesheets=pending_ts,
        pending_leaves=pending_lv,
        invoice_total_raised=float(inv_row.get("total_raised") or 0),
        invoice_cleared=float(inv_row.get("total_cleared") or 0),
        invoice_pending=float(inv_row.get("total_pending") or 0),
        pending_invoices=pending_invoices,
    ), 200


