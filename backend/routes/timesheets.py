"""routes/timesheets.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

timesheets_bp = Blueprint("timesheets", __name__)


def _fmt(row):
    for k in ("work_date", "created_at", "updated_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@timesheets_bp.route("/", methods=["GET"])
@jwt_required()
def list_timesheets():
    user     = json.loads(get_jwt_identity())
    emp_id   = request.args.get("employee_id")
    proj_id  = request.args.get("project_id")
    status   = request.args.get("status")

    # Employees can only see their own timesheets. Managers see own + subordinates.
    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql  = """
        SELECT t.*, e.name AS employee_name, e.avatar, e.group_id,
               p.code AS project_code, p.name AS project_name,
               COALESCE(e.hourly_rate, g.hourly_rate, 0) AS hourly_rate, g.color AS group_color,
               (t.hours * COALESCE(e.hourly_rate, g.hourly_rate, 0)) AS cost
        FROM   timesheets t
        JOIN   employees  e ON e.id = t.employee_id
        JOIN   projects   p ON p.id = t.project_id
        LEFT JOIN `groups` g ON g.id = e.group_id
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND t.employee_id = %s"; args.append(emp_id)
    if proj_id:
        sql += " AND t.project_id = %s";  args.append(proj_id)
    if status:
        sql += " AND t.status = %s";      args.append(status)
    if user["role"] == "manager" and not emp_id:
        sql += " AND (t.employee_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])
    sql += " ORDER BY t.work_date DESC, t.id DESC"

    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@timesheets_bp.route("/", methods=["POST"])
@jwt_required()
def create_timesheet():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}

    emp_id  = user["employee_id"] if user["role"] in ("employee", "manager") else d.get("employeeId")
    proj_id = d.get("projectId")
    date    = d.get("date")
    hours   = d.get("hours")

    if not all([emp_id, proj_id, date, hours]):
        return jsonify(error="employeeId, projectId, date, hours are required"), 400

    # Validate project exists
    proj = query("SELECT id FROM projects WHERE id=%s", (proj_id,), fetch="one")
    if not proj:
        return jsonify(error=f"Project {proj_id} does not exist"), 400

    tid = execute(
        "INSERT INTO timesheets (employee_id,project_id,work_date,hours,task,status) VALUES (%s,%s,%s,%s,%s,'pending')",
        (emp_id, proj_id, date, float(hours), d.get("task", "")),
    )
    row = query(
        """
        SELECT t.*, e.name AS employee_name, e.avatar, e.group_id,
               p.code AS project_code, p.name AS project_name,
               COALESCE(e.hourly_rate, g.hourly_rate, 0) AS hourly_rate, g.color AS group_color,
               (t.hours * COALESCE(e.hourly_rate, g.hourly_rate, 0)) AS cost
        FROM   timesheets t
        JOIN   employees e ON e.id=t.employee_id
        JOIN   projects  p ON p.id=t.project_id
        LEFT JOIN `groups` g ON g.id=e.group_id
        WHERE  t.id=%s
        """,
        (tid,), fetch="one",
    )
    return jsonify(_fmt(row)), 201


@timesheets_bp.route("/<int:tid>", methods=["PUT"])
@jwt_required()
def update_timesheet(tid):
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}

    existing_timesheet = query("SELECT * FROM timesheets WHERE id=%s", (tid,), fetch="one")
    if not existing_timesheet:
        return jsonify(error="Timesheet not found"), 404

    if existing_timesheet["status"] != "pending":
        return jsonify(error="Only pending timesheets can be updated"), 400

    # Access control
    if user["role"] in ("employee", "manager"):
        if existing_timesheet["employee_id"] != user["employee_id"]:
            # Check if user is manager of the timesheet owner
            emp = query("SELECT manager_id FROM employees WHERE id=%s", (existing_timesheet["employee_id"],), fetch="one")
            if not emp or emp.get("manager_id") != user["employee_id"]:
                return jsonify(error="You can only update your own or your subordinates' timesheets"), 403

    update_fields = []
    update_values = []

    if "hours" in d:
        try:
            hours = float(d["hours"])
            if hours <= 0:
                return jsonify(error="Hours must be a positive number"), 400
            update_fields.append("hours = %s")
            update_values.append(hours)
        except ValueError:
            return jsonify(error="Hours must be a number"), 400

    if "projectId" in d:
        proj_id = d["projectId"]
        # Validate project exists
        proj = query("SELECT id FROM projects WHERE id=%s", (proj_id,), fetch="one")
        if not proj:
            return jsonify(error=f"Project {proj_id} does not exist"), 400
        update_fields.append("project_id = %s")
        update_values.append(proj_id)

    if "task" in d:
        update_fields.append("task = %s")
        update_values.append(d["task"])

    if not update_fields:
        return jsonify(error="No valid fields provided for update (hours, projectId, task)"), 400

    sql = "UPDATE timesheets SET " + ", ".join(update_fields) + " WHERE id = %s"
    update_values.append(tid)
    execute(sql, tuple(update_values))

    row = query(
        """
        SELECT t.*, e.name AS employee_name, e.avatar, e.group_id,
               p.code AS project_code, p.name AS project_name,
               COALESCE(e.hourly_rate, g.hourly_rate, 0) AS hourly_rate, g.color AS group_color,
               (t.hours * COALESCE(e.hourly_rate, g.hourly_rate, 0)) AS cost
        FROM   timesheets t
        JOIN   employees e ON e.id=t.employee_id
        JOIN   projects  p ON p.id=t.project_id
        LEFT JOIN `groups` g ON g.id=e.group_id
        WHERE  t.id=%s
        """,
        (tid,), fetch="one",
    )
    return jsonify(_fmt(row)), 200


@timesheets_bp.route("/<int:tid>/approve", methods=["PATCH"])
@jwt_required()
def approve_timesheet(tid):
    user = json.loads(get_jwt_identity())
    ts = query("SELECT employee_id FROM timesheets WHERE id=%s", (tid,), fetch="one")
    if not ts: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and ts["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (ts["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    execute("UPDATE timesheets SET status='approved' WHERE id=%s", (tid,))
    return jsonify(updated=True), 200


@timesheets_bp.route("/<int:tid>/reject", methods=["PATCH"])
@jwt_required()
def reject_timesheet(tid):
    user = json.loads(get_jwt_identity())
    ts = query("SELECT employee_id FROM timesheets WHERE id=%s", (tid,), fetch="one")
    if not ts: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and ts["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (ts["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    execute("UPDATE timesheets SET status='rejected' WHERE id=%s", (tid,))
    return jsonify(updated=True), 200


@timesheets_bp.route("/<int:tid>", methods=["DELETE"])
@jwt_required()
def delete_timesheet(tid):
    user = json.loads(get_jwt_identity())
    ts = query("SELECT employee_id FROM timesheets WHERE id=%s", (tid,), fetch="one")
    if not ts: return jsonify(error="Not found"), 404
    if user["role"] in ("employee", "manager") and ts["employee_id"] != user["employee_id"]:
        if user["role"] == "manager":
            emp = query("SELECT manager_id FROM employees WHERE id=%s", (ts["employee_id"],), fetch="one")
            if not emp or emp.get("manager_id") != user["employee_id"]:
                return jsonify(error="Forbidden"), 403
        else:
            return jsonify(error="Forbidden"), 403

    execute("DELETE FROM timesheets WHERE id=%s", (tid,))
    return jsonify(deleted=True), 200
