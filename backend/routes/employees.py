"""routes/employees.py"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import json
from db import query, execute, get_conn

employees_bp = Blueprint("employees", __name__)

EMP_SELECT = """
    SELECT e.*,
           g.name AS group_name, g.hourly_rate AS group_hourly_rate,
           COALESCE(e.hourly_rate, g.hourly_rate, 0) AS effective_hourly_rate,
           g.color AS group_color,
           m.name AS manager_name
    FROM   employees e
    LEFT JOIN `groups` g ON g.id = e.group_id
    LEFT JOIN employees m ON m.id = e.manager_id
"""


_status_ready = False


def _ensure_status_columns():
    """Add employment_status / relieving_date once if the migration wasn't run."""
    global _status_ready
    if _status_ready:
        return
    try:
        if not query("SHOW COLUMNS FROM employees LIKE 'employment_status'"):
            execute("ALTER TABLE employees ADD COLUMN employment_status ENUM('working','resigned') NOT NULL DEFAULT 'working'")
        if not query("SHOW COLUMNS FROM employees LIKE 'relieving_date'"):
            execute("ALTER TABLE employees ADD COLUMN relieving_date DATE NULL")
        _status_ready = True
    except Exception:
        current_app.logger.exception("Could not add employee status columns")


def _fmt(row):
    if row is not None:
        row.setdefault("employment_status", "working")
        row.setdefault("relieving_date", None)
    for k in ("joining_date", "dob", "created_at", "updated_at", "relieving_date"):
        if row and row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@employees_bp.route("/", methods=["GET"])
@jwt_required()
def list_employees():
    _ensure_status_columns()
    rows = query(EMP_SELECT + " ORDER BY e.name")
    return jsonify([_fmt(r) for r in rows]), 200


@employees_bp.route("/<int:eid>", methods=["GET"])
@jwt_required()
def get_employee(eid):
    row = query(EMP_SELECT + " WHERE e.id=%s", (eid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    # attach user account info
    ua = query(
        "SELECT id, username, role, active FROM user_accounts WHERE employee_id=%s",
        (eid,), fetch="one"
    )
    row["account"] = ua
    return jsonify(_fmt(row)), 200


@employees_bp.route("/", methods=["POST"])
@jwt_required()
def create_employee():
    d    = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    email= (d.get("email") or "").strip()
    if not name or not email:
        return jsonify(error="name and email are required"), 400
    initials = "".join(p[0].upper() for p in name.split())[:2]
    custom_employee_id = (d.get("customEmployeeId") or "").strip()
    hr = d.get("hourlyRate")
    eid = execute(
        "INSERT INTO employees (name, designation, location, pan_number, email, group_id, hourly_rate, manager_id, avatar, joining_date, ctc_annual, variable_pay_amount, dob, address, mobile, emergency_contact, bank_account_no, bank_ifsc, bank_name, skillset, custom_employee_id) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (name, d.get("designation") or None, d.get("location") or None, d.get("panNumber") or None, email, d.get("groupId") or None, float(hr) if hr else None, d.get("managerId") or None, initials,
         d.get("joiningDate") or None, float(d.get("ctcAnnual") or 0), float(d.get("variablePay") or 0),
         d.get("dob") or None, d.get("address") or None,
         d.get("mobile") or None, d.get("emergencyContact") or None,
         d.get("bankAccountNo") or None,
         d.get("bankIfsc") or None, d.get("bankName") or None,
         d.get("skillset") or None, custom_employee_id or None),
    )
    row = query(EMP_SELECT + " WHERE e.id=%s", (eid,), fetch="one")
    return jsonify(_fmt(row)), 201


@employees_bp.route("/<int:eid>", methods=["PUT"])
@jwt_required()
def update_employee(eid):
    d = request.get_json(silent=True) or {}
    hr = d.get("hourlyRate")
    try:
        execute(
          "UPDATE employees SET name=%s, designation=%s, location=%s, pan_number=%s, email=%s, group_id=%s, hourly_rate=%s, manager_id=%s, joining_date=%s, ctc_annual=%s, variable_pay_amount=%s, dob=%s, address=%s, mobile=%s, emergency_contact=%s, bank_account_no=%s, bank_ifsc=%s, bank_name=%s, skillset=%s, custom_employee_id=%s WHERE id=%s",
          (d.get("name"), d.get("designation") or None, d.get("location") or None, d.get("panNumber") or None,
           d.get("email"), d.get("groupId") or None, float(hr) if hr else None, d.get("managerId") or None,
           d.get("joiningDate") or None, float(d.get("ctcAnnual") or 0), float(d.get("variablePay") or 0),
           d.get("dob") or None, d.get("address") or None,
           d.get("mobile") or None, d.get("emergencyContact") or None,
           d.get("bankAccountNo") or None,
           d.get("bankIfsc") or None, d.get("bankName") or None,
           d.get("skillset") or None, (str(d.get("customEmployeeId") or "")).strip() or None, eid),
        )
    except Exception as e:
        current_app.logger.exception("Employee %s update failed", eid)
        return jsonify(error=f"Could not save employee: {e}"), 400
    row = query(EMP_SELECT + " WHERE e.id=%s", (eid,), fetch="one")
    return jsonify(_fmt(row)), 200


@employees_bp.route("/<int:eid>/status", methods=["PATCH"])
@jwt_required()
def update_employee_status(eid):
    """Set an employee as currently working or resigned (admin only).
    Kept separate from the full-record PUT so profile edits never change it."""
    user = json.loads(get_jwt_identity())
    if user.get("role") != "admin":
        return jsonify(error="Only admins can change employment status"), 403
    d = request.get_json(silent=True) or {}
    status = d.get("status")
    if status not in ("working", "resigned"):
        return jsonify(error="status must be 'working' or 'resigned'"), 400
    relieving = d.get("relievingDate") or None
    if status == "resigned" and not relieving:
        return jsonify(error="relievingDate (last working day) is required"), 400
    _ensure_status_columns()
    if not query("SELECT id FROM employees WHERE id=%s", (eid,), fetch="one"):
        return jsonify(error="Not found"), 404
    execute("UPDATE employees SET employment_status=%s, relieving_date=%s WHERE id=%s",
            (status, relieving if status == "resigned" else None, eid))
    row = query(EMP_SELECT + " WHERE e.id=%s", (eid,), fetch="one")
    return jsonify(_fmt(row)), 200


@employees_bp.route("/<int:eid>", methods=["DELETE"])
@jwt_required()
def delete_employee(eid):
    execute("DELETE FROM employees WHERE id=%s", (eid,))
    return jsonify(deleted=True), 200


@employees_bp.route("/<int:eid>/projects", methods=["GET"])
@jwt_required()
def get_employee_projects(eid):
    rows = query("SELECT project_id FROM project_employees WHERE employee_id=%s", (eid,))
    return jsonify([r["project_id"] for r in rows]), 200


@employees_bp.route("/<int:eid>/projects", methods=["PUT"])
@jwt_required()
def update_employee_projects(eid):
    d = request.get_json(silent=True) or {}
    project_ids = d.get("projectIds", [])
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM project_employees WHERE employee_id=%s", (eid,))
            for pid in project_ids:
                cur.execute(
                    "INSERT IGNORE INTO project_employees (project_id, employee_id) VALUES (%s,%s)",
                    (pid, eid)
                )
            conn.commit()
    except Exception:
        conn.rollback(); raise
    finally:
        conn.close()
    rows = query("SELECT project_id FROM project_employees WHERE employee_id=%s", (eid,))
    return jsonify([r["project_id"] for r in rows]), 200
