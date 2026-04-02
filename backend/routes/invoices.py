import re
import os
import uuid
from datetime import date
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query, execute

VENDOR_INVOICES_DIR = os.path.join(os.path.dirname(__file__), "..", "receipts")
ALLOWED_EXT = {"png", "jpg", "jpeg", "gif", "pdf", "webp"}


def _root_invoice_number(inv_number):
    """Strip any leading BAL-MMDD- prefixes to get the original invoice number."""
    return re.sub(r'^(BAL-\d{4}-)+', '', inv_number or '') or inv_number

invoices_bp = Blueprint("invoices", __name__)

@invoices_bp.route("/upload-vendor-invoice", methods=["POST"])
@jwt_required()
def upload_vendor_invoice():
    if "file" not in request.files:
        return jsonify(error="No file provided"), 400
    f = request.files["file"]
    if not f.filename:
        return jsonify(error="No file selected"), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in ALLOWED_EXT:
        return jsonify(error="File type not allowed. Use PNG, JPG, GIF, PDF or WEBP"), 400
    os.makedirs(VENDOR_INVOICES_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    f.save(os.path.join(VENDOR_INVOICES_DIR, filename))
    return jsonify(filename=filename), 200


@invoices_bp.route("/", methods=["GET"])
@jwt_required()
def get_invoices():
    sql = """
        SELECT i.*, p.name as project_name, p.code as project_code,
               c.client_name, c.address as client_address, c.gst_number as client_gst_number,
               pi.invoice_number as parent_invoice_number
        FROM invoices i
        LEFT JOIN projects p ON i.project_id = p.id
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN invoices pi ON pi.id = i.parent_invoice_id
        ORDER BY i.created_at DESC
    """
    return jsonify(query(sql))

@invoices_bp.route("/", methods=["POST"])
@jwt_required()
def create_invoice():
    data = request.json
    req_fields = ["amount", "task_details", "raised_date"]
    if not all(k in data for k in req_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    sql = """
        INSERT INTO invoices (
            client_id, invoice_number, project_id, amount, task_details, remarks,
            hours, rate, tax_rate, subtotal, tds_amount,
            raised_date, payment_due_date, status, vendor_invoice_url
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    params = (
        data.get("client_id") or None,
        data.get("invoice_number") or None,
        data.get("project_id") or None,
        data["amount"],
        data["task_details"],
        data.get("remarks") or None,
        data.get("hours") or None,
        data.get("rate") or None,
        data.get("tax_rate", 18.00),
        data.get("subtotal") or None,
        data.get("tds_amount") or None,
        data["raised_date"],
        data.get("payment_due_date") or None,
        data.get("status", "pending"),
        data.get("vendor_invoice_url") or None,
    )
    res = execute(sql, params)
    return jsonify({"message": "Invoice created", "id": res}), 201

@invoices_bp.route("/<int:invoice_id>/status", methods=["PUT"])
@jwt_required()
def update_invoice_status(invoice_id):
    data = request.json
    new_status = data.get("status")
    if new_status not in ["pending", "cleared", "partial"]:
        return jsonify({"error": "Invalid status"}), 400

    invoice = query("SELECT * FROM invoices WHERE id = %s", (invoice_id,), fetch="one")
    if not invoice:
        return jsonify({"error": "Invoice not found"}), 404

    if new_status == "cleared":
        payment_received_date = data.get("payment_received_date") or None
        payment_received = data.get("payment_received")
        payment_received = float(payment_received) if payment_received not in (None, "") else None

        raised_amount = float(invoice["amount"] or 0)
        tds_amount = float(invoice.get("tds_amount") or 0)
        effective_payment = (payment_received if payment_received is not None else 0) + tds_amount

        if payment_received is not None and effective_payment < raised_amount - 0.005:
            # Partial payment — mark as partial, auto-create balance invoice
            balance = round(raised_amount - effective_payment, 2)

            execute(
                "UPDATE invoices SET status=%s, payment_received_date=%s, payment_received=%s, balance_amount=%s WHERE id=%s",
                ("partial", payment_received_date, payment_received, balance, invoice_id)
            )

            # Always use the root invoice number to avoid BAL-BAL-BAL chains
            root_num = _root_invoice_number(invoice.get("invoice_number") or str(invoice_id))
            date_tag = date.today().strftime("%m%d")
            bal_inv_num = f"BAL-{date_tag}-{root_num}"

            # The canonical parent is always the root invoice (follow chain up if needed)
            root_parent_id = invoice.get("parent_invoice_id") or invoice_id

            bal_id = execute(
                """INSERT INTO invoices
                   (client_id, invoice_number, project_id, amount, task_details, remarks,
                    tax_rate, raised_date, status, parent_invoice_id)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (invoice.get("client_id"), bal_inv_num, invoice.get("project_id"),
                 balance, invoice.get("task_details"),
                 f"Balance due against {root_num}",
                 invoice.get("tax_rate", 18.00),
                 payment_received_date or invoice.get("raised_date"),
                 "pending", root_parent_id)
            )

            return jsonify({
                "message": "Partial payment recorded. Balance invoice created.",
                "balance_invoice_id": bal_id,
                "balance_invoice_number": bal_inv_num,
                "balance_amount": balance
            })
        else:
            # Full payment — mark this invoice cleared
            execute(
                "UPDATE invoices SET status=%s, payment_received_date=%s, payment_received=%s, balance_amount=NULL WHERE id=%s",
                ("cleared", payment_received_date, payment_received, invoice_id)
            )

            # If this is a balance invoice, check whether the root parent can be auto-cleared
            parent_id = invoice.get("parent_invoice_id")
            if parent_id:
                open_balances = query(
                    "SELECT id FROM invoices WHERE parent_invoice_id=%s AND id!=%s AND status IN ('pending','partial')",
                    (parent_id, invoice_id)
                )
                if not open_balances:
                    execute(
                        "UPDATE invoices SET status='cleared', balance_amount=NULL WHERE id=%s AND status='partial'",
                        (parent_id,)
                    )
    else:
        # Reverting to pending – clear payment fields
        execute(
            "UPDATE invoices SET status=%s, payment_received_date=NULL, payment_received=NULL, balance_amount=NULL WHERE id=%s",
            (new_status, invoice_id)
        )
    return jsonify({"message": "Invoice status updated"})

@invoices_bp.route("/<int:invoice_id>", methods=["PUT"])
@jwt_required()
def update_invoice(invoice_id):
    data = request.json
    req_fields = ["amount", "task_details", "raised_date"]
    if not all(k in data for k in req_fields):
        return jsonify({"error": "Missing required fields"}), 400
        
    sql = """
        UPDATE invoices
        SET client_id = %s, invoice_number = %s, project_id = %s, amount = %s, task_details = %s, remarks = %s,
            hours = %s, rate = %s, tax_rate = %s, subtotal = %s, tds_amount = %s,
            raised_date = %s, payment_due_date = %s, status = %s, vendor_invoice_url = %s
        WHERE id = %s
    """
    params = (
        data.get("client_id") or None,
        data.get("invoice_number") or None,
        data.get("project_id") or None,
        data["amount"],
        data["task_details"],
        data.get("remarks") or None,
        data.get("hours") or None,
        data.get("rate") or None,
        data.get("tax_rate", 18.00),
        data.get("subtotal") or None,
        data.get("tds_amount") or None,
        data["raised_date"],
        data.get("payment_due_date") or None,
        data.get("status", "pending"),
        data.get("vendor_invoice_url") or None,
        invoice_id
    )
    execute(sql, params)
    return jsonify({"message": "Invoice updated"})

@invoices_bp.route("/<int:invoice_id>", methods=["DELETE"])
@jwt_required()
def delete_invoice(invoice_id):
    execute("DELETE FROM invoices WHERE id = %s", (invoice_id,))
    return jsonify({"message": "Invoice deleted"})
