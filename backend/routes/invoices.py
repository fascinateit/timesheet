from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query, execute

invoices_bp = Blueprint("invoices", __name__)

@invoices_bp.route("/", methods=["GET"])
@jwt_required()
def get_invoices():
    sql = """
        SELECT i.*, p.name as project_name, p.code as project_code
        FROM invoices i
        JOIN projects p ON i.project_id = p.id
        ORDER BY i.created_at DESC
    """
    return jsonify(query(sql))

@invoices_bp.route("/", methods=["POST"])
@jwt_required()
def create_invoice():
    data = request.json
    req_fields = ["project_id", "amount", "task_details", "raised_date"]
    if not all(k in data for k in req_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    sql = """
        INSERT INTO invoices (project_id, amount, task_details, raised_date, next_invoice_date, status)
        VALUES (%s, %s, %s, %s, %s, %s)
    """
    params = (
        data["project_id"],
        data["amount"],
        data["task_details"],
        data["raised_date"],
        data.get("next_invoice_date") or None,
        data.get("status", "pending")
    )
    res = execute(sql, params)
    return jsonify({"message": "Invoice created", "id": res}), 201

@invoices_bp.route("/<int:invoice_id>/status", methods=["PUT"])
@jwt_required()
def update_invoice_status(invoice_id):
    data = request.json
    if "status" not in data or data["status"] not in ["pending", "cleared"]:
        return jsonify({"error": "Invalid status"}), 400
    
    sql = "UPDATE invoices SET status = %s WHERE id = %s"
    execute(sql, (data["status"], invoice_id))
    return jsonify({"message": "Invoice status updated"})

@invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@jwt_required()
def update_invoice(invoice_id):
    data = request.json
    req_fields = ["project_id", "amount", "task_details", "raised_date"]
    if not all(k in data for k in req_fields):
        return jsonify({"error": "Missing required fields"}), 400
        
    sql = """
        UPDATE invoices
        SET project_id = %s, amount = %s, task_details = %s, 
            raised_date = %s, next_invoice_date = %s, status = %s
        WHERE id = %s
    """
    params = (
        data["project_id"],
        data["amount"],
        data["task_details"],
        data["raised_date"],
        data.get("next_invoice_date") or None,
        data.get("status", "pending"),
        invoice_id
    )
    execute(sql, params)
    return jsonify({"message": "Invoice updated"})

@invoices_bp.route("/<int:invoice_id>", methods=["DELETE"])
@jwt_required()
def delete_invoice(invoice_id):
    execute("DELETE FROM invoices WHERE id = %s", (invoice_id,))
    return jsonify({"message": "Invoice deleted"})
