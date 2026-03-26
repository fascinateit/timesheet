"""routes/leaves.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
from notifications import notify_leave_requested, notify_leave_actioned
import json

leaves_bp = Blueprint("leaves", __name__)


def _fmt(row):
    for k in ("start_date", "end_date", "created_at", "updated_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


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


@leaves_bp.route("/", methods=["POST"])
@jwt_required()
def create_leave():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}

    emp_id = user["employee_id"] if user["role"] in ("employee", "manager") else d.get("employeeId")
    if not all([emp_id, d.get("startDate"), d.get("endDate")]):
        return jsonify(error="employeeId, startDate, endDate are required"), 400

    leave_type = d.get("type", "Annual")
    lid = execute(
        "INSERT INTO leaves (employee_id,leave_type,start_date,end_date,reason,status) VALUES (%s,%s,%s,%s,%s,'pending')",
        (emp_id, leave_type, d.get("startDate"), d.get("endDate"), d.get("reason","")),
    )
    row = query(
        """
        SELECT l.*, e.name AS employee_name, e.avatar, e.group_id, g.color AS group_color
        FROM leaves l JOIN employees e ON e.id=l.employee_id LEFT JOIN `groups` g ON g.id=e.group_id
        WHERE l.id=%s
        """,
        (lid,), fetch="one",
    )
    notify_leave_requested(emp_id, leave_type, d.get("startDate"), d.get("endDate"), d.get("reason",""))
    return jsonify(_fmt(row)), 201


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


@leaves_bp.route("/<int:lid>/reject", methods=["PATCH"])
@jwt_required()
def reject_leave(lid):
    user = json.loads(get_jwt_identity())
    lv = query("SELECT employee_id FROM leaves WHERE id=%s", (lid,), fetch="one")
    if not lv: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and lv["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (lv["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    execute("UPDATE leaves SET status='rejected' WHERE id=%s", (lid,))
    notify_leave_actioned(lid, "rejected")
    return jsonify(updated=True), 200


@leaves_bp.route("/<int:lid>", methods=["DELETE"])
@jwt_required()
def delete_leave(lid):
    user = json.loads(get_jwt_identity())
    lv = query("SELECT employee_id FROM leaves WHERE id=%s", (lid,), fetch="one")
    if not lv: return jsonify(error="Not found"), 404
    if user["role"] in ("employee", "manager") and lv["employee_id"] != user["employee_id"]:
        if user["role"] == "manager":
            emp = query("SELECT manager_id FROM employees WHERE id=%s", (lv["employee_id"],), fetch="one")
            if not emp or emp.get("manager_id") != user["employee_id"]:
                return jsonify(error="Forbidden"), 403
        else:
            return jsonify(error="Forbidden"), 403

    execute("DELETE FROM leaves WHERE id=%s", (lid,))
    return jsonify(deleted=True), 200
