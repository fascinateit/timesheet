"""routes/expenses.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

expenses_bp = Blueprint("expenses", __name__)


def _fmt(row):
    for k in ("submitted_at", "updated_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@expenses_bp.route("/", methods=["GET"])
@jwt_required()
def list_expenses():
    user   = json.loads(get_jwt_identity())
    status = request.args.get("status")
    emp_id = request.args.get("employee_id")

    sql = """
        SELECT ex.*, e.name AS employee_name, e.avatar, g.color AS group_color,
               p.code AS project_code, p.name AS project_name
        FROM   expenses ex
        JOIN   employees e ON e.id = ex.employee_id
        LEFT JOIN `groups` g ON g.id = e.group_id
        LEFT JOIN projects p ON p.id  = ex.project_id
        WHERE  1=1
    """
    args = []
    if user["role"] == "employee":
        sql += " AND ex.employee_id = %s"; args.append(user["employee_id"])
    elif emp_id:
        sql += " AND ex.employee_id = %s"; args.append(emp_id)

    if user["role"] == "manager" and not (user["role"] == "employee") and not emp_id:
        sql += " AND (ex.employee_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])

    if status:
        sql += " AND ex.status = %s"; args.append(status)
    sql += " ORDER BY ex.submitted_at DESC"

    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@expenses_bp.route("/", methods=["POST"])
@jwt_required()
def create_expense():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}

    emp_id = user["employee_id"] if user["role"] in ("employee", "manager") else d.get("employeeId")
    title  = (d.get("title") or "").strip()
    amount = d.get("amount")

    if not emp_id or not title or not amount:
        return jsonify(error="employeeId, title and amount are required"), 400

    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify(error="Amount must be positive"), 400
    except (ValueError, TypeError):
        return jsonify(error="Amount must be a number"), 400

    eid = execute(
        """INSERT INTO expenses
           (employee_id, project_id, title, amount, category, description, receipt_url)
           VALUES (%s,%s,%s,%s,%s,%s,%s)""",
        (emp_id, d.get("projectId") or None, title, amount,
         d.get("category", "Other"), d.get("description", ""),
         d.get("receiptUrl", ""))
    )
    row = query(
        """SELECT ex.*, e.name AS employee_name, e.avatar, g.color AS group_color,
                  p.code AS project_code, p.name AS project_name
           FROM   expenses ex
           JOIN   employees e ON e.id = ex.employee_id
           LEFT JOIN `groups` g ON g.id = e.group_id
           LEFT JOIN projects p ON p.id = ex.project_id
           WHERE  ex.id = %s""", (eid,), fetch="one"
    )
    return jsonify(_fmt(row)), 201


@expenses_bp.route("/<int:eid>", methods=["PUT"])
@jwt_required()
def update_expense(eid):
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}

    ex = query("SELECT * FROM expenses WHERE id=%s", (eid,), fetch="one")
    if not ex:
        return jsonify(error="Expense not found"), 404
    if user["role"] in ("employee", "manager"):
        if ex["employee_id"] != user["employee_id"]:
            if user["role"] == "manager":
                emp = query("SELECT manager_id FROM employees WHERE id=%s", (ex["employee_id"],), fetch="one")
                if not emp or emp.get("manager_id") != user["employee_id"]:
                    return jsonify(error="Forbidden"), 403
            else:
                return jsonify(error="Forbidden"), 403
        if ex["status"] not in ("pending", "needs_correction") and ex["employee_id"] == user["employee_id"]:
            # Note: Even if manager, can they edit subordinates' approved expenses? No, let's keep it simple: can edit if pending/needs_correction
            return jsonify(error="Only pending or needs-correction expenses can be edited"), 400

    execute(
        """UPDATE expenses SET title=%s, amount=%s, category=%s,
           description=%s, project_id=%s, receipt_url=%s, status='pending', admin_note=NULL
           WHERE id=%s""",
        (d.get("title", ex["title"]), float(d.get("amount", ex["amount"])),
         d.get("category", ex["category"]), d.get("description", ex.get("description", "")),
         d.get("projectId") or None, d.get("receiptUrl", ex.get("receipt_url", "")), eid)
    )
    row = query(
        """SELECT ex.*, e.name AS employee_name, e.avatar, g.color AS group_color,
                  p.code AS project_code, p.name AS project_name
           FROM   expenses ex
           JOIN   employees e ON e.id = ex.employee_id
           LEFT JOIN `groups` g ON g.id = e.group_id
           LEFT JOIN projects p ON p.id = ex.project_id
           WHERE  ex.id = %s""", (eid,), fetch="one"
    )
    return jsonify(_fmt(row)), 200


@expenses_bp.route("/<int:eid>/approve", methods=["PATCH"])
@jwt_required()
def approve_expense(eid):
    user = json.loads(get_jwt_identity())
    ex = query("SELECT employee_id FROM expenses WHERE id=%s", (eid,), fetch="one")
    if not ex: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and ex["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (ex["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    execute("UPDATE expenses SET status='approved', admin_note=NULL WHERE id=%s", (eid,))
    return jsonify(updated=True), 200


@expenses_bp.route("/<int:eid>/pay", methods=["PATCH"])
@jwt_required()
def pay_expense(eid):
    user = json.loads(get_jwt_identity())
    ex = query("SELECT employee_id, status FROM expenses WHERE id=%s", (eid,), fetch="one")
    if not ex: return jsonify(error="Not found"), 404
    if ex["status"] != "approved":
        return jsonify(error="Expense must be approved before marking as paid"), 400
    if user["role"] == "manager" and ex["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (ex["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    execute("UPDATE expenses SET status='paid' WHERE id=%s", (eid,))
    return jsonify(updated=True), 200


@expenses_bp.route("/<int:eid>/reject", methods=["PATCH"])
@jwt_required()
def reject_expense(eid):
    user = json.loads(get_jwt_identity())
    ex = query("SELECT employee_id FROM expenses WHERE id=%s", (eid,), fetch="one")
    if not ex: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and ex["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (ex["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    execute("UPDATE expenses SET status='rejected', admin_note=%s WHERE id=%s",
            (d.get("note", ""), eid))
    return jsonify(updated=True), 200


@expenses_bp.route("/<int:eid>/sendback", methods=["PATCH"])
@jwt_required()
def sendback_expense(eid):
    user = json.loads(get_jwt_identity())
    ex = query("SELECT employee_id FROM expenses WHERE id=%s", (eid,), fetch="one")
    if not ex: return jsonify(error="Not found"), 404
    if user["role"] == "manager" and ex["employee_id"] != user["employee_id"]:
        emp = query("SELECT manager_id FROM employees WHERE id=%s", (ex["employee_id"],), fetch="one")
        if not emp or emp.get("manager_id") != user["employee_id"]:
            return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    execute("UPDATE expenses SET status='needs_correction', admin_note=%s WHERE id=%s",
            (d.get("note", ""), eid))
    return jsonify(updated=True), 200


@expenses_bp.route("/<int:eid>", methods=["DELETE"])
@jwt_required()
def delete_expense(eid):
    user = json.loads(get_jwt_identity())
    ex   = query("SELECT * FROM expenses WHERE id=%s", (eid,), fetch="one")
    if not ex:
        return jsonify(error="Expense not found"), 404
    if user["role"] in ("employee", "manager") and ex["employee_id"] != user["employee_id"]:
        if user["role"] == "manager":
            emp = query("SELECT manager_id FROM employees WHERE id=%s", (ex["employee_id"],), fetch="one")
            if not emp or emp.get("manager_id") != user["employee_id"]:
                return jsonify(error="Forbidden"), 403
        else:
            return jsonify(error="Forbidden"), 403
    execute("DELETE FROM expenses WHERE id=%s", (eid,))
    return jsonify(deleted=True), 200
