"""routes/projects.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query, execute, execute_many, get_conn
import random, datetime

projects_bp = Blueprint("projects", __name__)


def _enrich(project_id):
    """Add assigned_groups and assigned_employees lists."""
    row   = query("SELECT * FROM projects WHERE id=%s", (project_id,), fetch="one")
    if not row:
        return None
    groups = query(
        "SELECT group_id FROM project_groups WHERE project_id=%s", (project_id,)
    )
    emps   = query(
        "SELECT employee_id FROM project_employees WHERE project_id=%s", (project_id,)
    )
    row["assigned_groups"]    = [r["group_id"]    for r in groups]
    row["assigned_employees"] = [r["employee_id"] for r in emps]
    # Dates → str
    for k in ("start_date", "end_date", "created_at", "updated_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@projects_bp.route("/", methods=["GET"])
@jwt_required()
def list_projects():
    ids = [r["id"] for r in query("SELECT id FROM projects ORDER BY id")]
    return jsonify([_enrich(i) for i in ids]), 200


@projects_bp.route("/", methods=["POST"])
@jwt_required()
def create_project():
    d    = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify(error="name is required"), 400
    year = datetime.date.today().year
    code = f"PRJ-{year}-{random.randint(10000,99999)}"
    pid  = execute(
        "INSERT INTO projects (code,name,client,budget,status,start_date,end_date) VALUES (%s,%s,%s,%s,%s,%s,%s)",
        (code, name, d.get("client"), float(d.get("budget",0)), d.get("status","active"),
         d.get("startDate") or None, d.get("endDate") or None),
    )
    _sync_assignments(pid, d)
    return jsonify(_enrich(pid)), 201


@projects_bp.route("/<int:pid>", methods=["PUT"])
@jwt_required()
def update_project(pid):
    d = request.get_json(silent=True) or {}
    execute(
        "UPDATE projects SET name=%s,client=%s,budget=%s,status=%s,start_date=%s,end_date=%s WHERE id=%s",
        (d.get("name"), d.get("client"), float(d.get("budget",0)),
         d.get("status","active"), d.get("startDate") or None, d.get("endDate") or None, pid),
    )
    _sync_assignments(pid, d)
    return jsonify(_enrich(pid)), 200


@projects_bp.route("/<int:pid>", methods=["DELETE"])
@jwt_required()
def delete_project(pid):
    execute("DELETE FROM projects WHERE id=%s", (pid,))
    return jsonify(deleted=True), 200


def _sync_assignments(pid, d):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # groups
            cur.execute("DELETE FROM project_groups WHERE project_id=%s", (pid,))
            for gid in (d.get("assignedGroups") or []):
                cur.execute("INSERT IGNORE INTO project_groups VALUES (%s,%s)", (pid, gid))
            # employees
            cur.execute("DELETE FROM project_employees WHERE project_id=%s", (pid,))
            for eid in (d.get("assignedEmployees") or []):
                cur.execute("INSERT IGNORE INTO project_employees VALUES (%s,%s)", (pid, eid))
            conn.commit()
    except Exception:
        conn.rollback(); raise
    finally:
        conn.close()
