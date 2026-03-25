import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute

company_expenses_bp = Blueprint("company_expenses", __name__, url_prefix="/api/company-expenses")

def _fmt(r):
    if not r: return None
    import datetime
    for k in ("expense_date", "cleared_date"):
        if k in r and isinstance(r[k], datetime.date):
            r[k] = r[k].isoformat()
    if "created_at" in r and isinstance(r["created_at"], datetime.datetime):
        r["created_at"] = r["created_at"].isoformat()
    for k in ["amount", "gst_amount"]:
        if k in r and r[k] is not None:
            r[k] = float(r[k])
    return r

@company_expenses_bp.route("/", methods=["GET"])
@jwt_required()
def get_expenses():
    identity = json.loads(get_jwt_identity())
    if identity.get("role") != "admin":
        return jsonify(error="Unauthorized"), 403

    rows = query("SELECT * FROM company_expenses ORDER BY expense_date DESC, id DESC")
    return jsonify([_fmt(r) for r in rows]), 200

@company_expenses_bp.route("/", methods=["POST"])
@jwt_required()
def create_expense():
    identity = json.loads(get_jwt_identity())
    if identity.get("role") != "admin":
        return jsonify(error="Unauthorized"), 403

    d = request.get_json(silent=True) or {}
    req_fields = ["expenseDate", "purpose", "amount", "paidBy"]
    if not all(d.get(f) for f in req_fields):
        return jsonify(error="Missing required fields"), 400

    new_id = execute(
        """
        INSERT INTO company_expenses 
        (expense_date, purpose, amount, paid_by, itr_type, tax_type, gst_amount, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            d["expenseDate"], d["purpose"], float(d["amount"]), d["paidBy"], 
            d.get("itrType") or None, d.get("taxType") or None, 
            float(d.get("gstAmount") or 0.0), d.get("status", "pending")
        )
    )
    row = query("SELECT * FROM company_expenses WHERE id=%s", (new_id,), fetch="one")
    return jsonify(_fmt(row)), 201

@company_expenses_bp.route("/<int:eid>", methods=["PUT"])
@jwt_required()
def update_expense(eid):
    identity = json.loads(get_jwt_identity())
    if identity.get("role") != "admin":
        return jsonify(error="Unauthorized"), 403

    d = request.get_json(silent=True) or {}
    execute(
        """
        UPDATE company_expenses 
        SET expense_date=%s, purpose=%s, amount=%s, paid_by=%s, itr_type=%s, 
            tax_type=%s, gst_amount=%s, status=%s
        WHERE id=%s
        """,
        (
            d.get("expenseDate"), d.get("purpose"), float(d.get("amount") or 0), d.get("paidBy"),
            d.get("itrType") or None, d.get("taxType") or None, 
            float(d.get("gstAmount") or 0.0), d.get("status", "pending"), eid
        )
    )
    row = query("SELECT * FROM company_expenses WHERE id=%s", (eid,), fetch="one")
    return jsonify(_fmt(row)), 200
@company_expenses_bp.route("/<int:eid>/status", methods=["PUT"])
@jwt_required()
def update_expense_status(eid):
    identity = json.loads(get_jwt_identity())
    if identity.get("role") != "admin":
        return jsonify(error="Unauthorized"), 403

    d = request.get_json(silent=True) or {}
    new_status = d.get("status")
    if new_status not in ["pending", "cleared", "sent to auditing"]:
        return jsonify(error="Invalid status"), 400

    cleared_date = d.get("cleared_date") or None
    if new_status == "cleared":
        execute("UPDATE company_expenses SET status=%s, cleared_date=%s WHERE id=%s", (new_status, cleared_date, eid))
    else:
        execute("UPDATE company_expenses SET status=%s WHERE id=%s", (new_status, eid))
    row = query("SELECT * FROM company_expenses WHERE id=%s", (eid,), fetch="one")
    return jsonify(_fmt(row)), 200


@company_expenses_bp.route("/<int:eid>", methods=["DELETE"])
@jwt_required()
def delete_expense(eid):
    identity = json.loads(get_jwt_identity())
    if identity.get("role") != "admin":
        return jsonify(error="Unauthorized"), 403

    execute("DELETE FROM company_expenses WHERE id=%s", (eid,))
    return jsonify(deleted=True), 200
