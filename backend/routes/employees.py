"""routes/employees.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query, execute, get_conn

employees_bp = Blueprint("employees", __name__)

EMP_SELECT = """
    SELECT e.*, g.name AS group_name, g.hourly_rate, g.color AS group_color
    FROM   employees e
    LEFT JOIN `groups` g ON g.id = e.group_id
"""


def _fmt(row):
    for k in ("joining_date", "dob", "created_at", "updated_at"):
        if row and row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@employees_bp.route("/", methods=["GET"])
@jwt_required()
def list_employees():
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
    eid = execute(
        "INSERT INTO employees (name, email, group_id, avatar, joining_date, ctc_annual, dob, address, mobile, bank_account_no, bank_ifsc, bank_name, skillset) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (name, email, d.get("groupId") or None, initials,
         d.get("joiningDate") or None, float(d.get("ctcAnnual") or 0),
         d.get("dob") or None, d.get("address") or None,
         d.get("mobile") or None, d.get("bankAccountNo") or None,
         d.get("bankIfsc") or None, d.get("bankName") or None,
         d.get("skillset") or None),
    )
    row = query(EMP_SELECT + " WHERE e.id=%s", (eid,), fetch="one")
    return jsonify(_fmt(row)), 201


@employees_bp.route("/<int:eid>", methods=["PUT"])
@jwt_required()
def update_employee(eid):
    d = request.get_json(silent=True) or {}
    execute(
        "UPDATE employees SET name=%s, email=%s, group_id=%s, joining_date=%s, ctc_annual=%s, dob=%s, address=%s, mobile=%s, bank_account_no=%s, bank_ifsc=%s, bank_name=%s, skillset=%s WHERE id=%s",
        (d.get("name"), d.get("email"), d.get("groupId") or None,
         d.get("joiningDate") or None, float(d.get("ctcAnnual") or 0),
         d.get("dob") or None, d.get("address") or None,
         d.get("mobile") or None, d.get("bankAccountNo") or None,
         d.get("bankIfsc") or None, d.get("bankName") or None,
         d.get("skillset") or None, eid),
    )
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
