"""routes/onboarding.py – Employee on-boarding with SharePoint document upload."""
import json
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import sharepoint as sp

onboarding_bp = Blueprint("onboarding", __name__)

# ── helpers ──────────────────────────────────────────────────────────────────

def _fmt_row(row):
    for f in ("joining_date", "created_at", "updated_at", "uploaded_at"):
        if row and row.get(f) and hasattr(row[f], "isoformat"):
            row[f] = row[f].isoformat()
    return row


def _folder_name(emp):
    """Use custom_employee_id when available, fall back to DB id."""
    return str(emp.get("custom_employee_id") or emp["id"])


def _load_record(rid):
    rec = query(
        "SELECT ob.*, e.name AS employee_name, e.custom_employee_id, e.email "
        "FROM onboarding_records ob "
        "JOIN employees e ON e.id = ob.employee_id "
        "WHERE ob.id = %s", (rid,), fetch="one"
    )
    if not rec:
        return None
    _fmt_row(rec)
    docs = query(
        "SELECT * FROM onboarding_documents WHERE onboarding_id = %s ORDER BY uploaded_at DESC",
        (rid,)
    )
    rec["documents"] = [_fmt_row(d) for d in docs]
    return rec


# ── CRUD for onboarding records ───────────────────────────────────────────────

@onboarding_bp.route("/", methods=["GET"])
@jwt_required()
def list_records():
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    rows = query(
        "SELECT ob.*, e.name AS employee_name, e.custom_employee_id, e.email, e.designation "
        "FROM onboarding_records ob "
        "JOIN employees e ON e.id = ob.employee_id "
        "ORDER BY ob.created_at DESC"
    )
    for r in rows:
        _fmt_row(r)
        doc_count = query(
            "SELECT COUNT(*) AS cnt FROM onboarding_documents WHERE onboarding_id = %s",
            (r["id"],), fetch="one"
        )
        r["document_count"] = doc_count["cnt"] if doc_count else 0
    return jsonify(rows), 200


@onboarding_bp.route("/<int:rid>", methods=["GET"])
@jwt_required()
def get_record(rid):
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403
    rec = _load_record(rid)
    if not rec:
        return jsonify(error="Not found"), 404
    return jsonify(rec), 200


@onboarding_bp.route("/", methods=["POST"])
@jwt_required()
def create_record():
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    emp_id = d.get("employee_id")
    if not emp_id:
        return jsonify(error="employee_id is required"), 400

    emp = query("SELECT id, custom_employee_id FROM employees WHERE id=%s", (emp_id,), fetch="one")
    if not emp:
        return jsonify(error="Employee not found"), 404

    # One record per employee – update if exists
    existing = query(
        "SELECT id FROM onboarding_records WHERE employee_id=%s", (emp_id,), fetch="one"
    )
    if existing:
        execute(
            "UPDATE onboarding_records SET status=%s, joining_date=%s, "
            "laptop_issued=%s, id_card_issued=%s, email_created=%s, "
            "system_access=%s, induction_done=%s, notes=%s WHERE id=%s",
            (d.get("status", "pending"), d.get("joining_date") or None,
             int(bool(d.get("laptop_issued"))), int(bool(d.get("id_card_issued"))),
             int(bool(d.get("email_created"))), int(bool(d.get("system_access"))),
             int(bool(d.get("induction_done"))), d.get("notes") or None,
             existing["id"])
        )
        rid = existing["id"]
    else:
        rid = execute(
            "INSERT INTO onboarding_records "
            "(employee_id, status, joining_date, laptop_issued, id_card_issued, "
            "email_created, system_access, induction_done, notes) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (emp_id, d.get("status", "pending"), d.get("joining_date") or None,
             int(bool(d.get("laptop_issued"))), int(bool(d.get("id_card_issued"))),
             int(bool(d.get("email_created"))), int(bool(d.get("system_access"))),
             int(bool(d.get("induction_done"))), d.get("notes") or None)
        )
        # Create the employee folder in SharePoint
        if sp.is_configured():
            try:
                sp.ensure_folder(_folder_name(emp))
            except Exception as e:
                pass  # non-fatal – folder can be created later on first upload

    return jsonify(_load_record(rid)), 201


@onboarding_bp.route("/<int:rid>", methods=["PUT"])
@jwt_required()
def update_record(rid):
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    execute(
        "UPDATE onboarding_records SET status=%s, joining_date=%s, "
        "laptop_issued=%s, id_card_issued=%s, email_created=%s, "
        "system_access=%s, induction_done=%s, notes=%s WHERE id=%s",
        (d.get("status", "pending"), d.get("joining_date") or None,
         int(bool(d.get("laptop_issued"))), int(bool(d.get("id_card_issued"))),
         int(bool(d.get("email_created"))), int(bool(d.get("system_access"))),
         int(bool(d.get("induction_done"))), d.get("notes") or None, rid)
    )
    rec = _load_record(rid)
    if not rec:
        return jsonify(error="Not found"), 404
    return jsonify(rec), 200


@onboarding_bp.route("/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_record(rid):
    user = json.loads(get_jwt_identity())
    if user.get("role") != "admin":
        return jsonify(error="Only admin can delete onboarding records"), 403
    existing = query("SELECT id FROM onboarding_records WHERE id=%s", (rid,), fetch="one")
    if not existing:
        return jsonify(error="Not found"), 404
    execute("DELETE FROM onboarding_records WHERE id=%s", (rid,))
    return jsonify(deleted=True), 200


# ── Document upload / delete ──────────────────────────────────────────────────

@onboarding_bp.route("/<int:rid>/documents", methods=["POST"])
@jwt_required()
def upload_document(rid):
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    rec = query(
        "SELECT ob.id, e.id AS emp_id, e.custom_employee_id "
        "FROM onboarding_records ob JOIN employees e ON e.id=ob.employee_id "
        "WHERE ob.id=%s", (rid,), fetch="one"
    )
    if not rec:
        return jsonify(error="Onboarding record not found"), 404

    if "file" not in request.files:
        return jsonify(error="No file provided"), 400

    file = request.files["file"]
    doc_type = request.form.get("doc_type", "Other").strip()

    if not file.filename:
        return jsonify(error="Empty filename"), 400

    folder = _folder_name({"id": rec["emp_id"], "custom_employee_id": rec.get("custom_employee_id")})
    file_bytes = file.read()
    sharepoint_url = ""

    if sp.is_configured():
        try:
            sp.ensure_folder(folder)
            sharepoint_url = sp.upload_file(folder, file.filename, file_bytes, file.content_type or "application/octet-stream")
        except Exception as e:
            return jsonify(error=f"SharePoint upload failed: {str(e)}"), 502

    did = execute(
        "INSERT INTO onboarding_documents (onboarding_id, doc_type, filename, sharepoint_url) "
        "VALUES (%s, %s, %s, %s)",
        (rid, doc_type, file.filename, sharepoint_url)
    )
    doc = query("SELECT * FROM onboarding_documents WHERE id=%s", (did,), fetch="one")
    return jsonify(_fmt_row(doc)), 201


@onboarding_bp.route("/<int:rid>/documents/<int:did>", methods=["DELETE"])
@jwt_required()
def delete_document(rid, did):
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    doc = query(
        "SELECT od.*, e.custom_employee_id, e.id AS emp_id "
        "FROM onboarding_documents od "
        "JOIN onboarding_records ob ON ob.id = od.onboarding_id "
        "JOIN employees e ON e.id = ob.employee_id "
        "WHERE od.id=%s AND od.onboarding_id=%s", (did, rid), fetch="one"
    )
    if not doc:
        return jsonify(error="Document not found"), 404

    # Best-effort delete from SharePoint
    if sp.is_configured() and doc.get("sharepoint_url"):
        folder = _folder_name({"id": doc["emp_id"], "custom_employee_id": doc.get("custom_employee_id")})
        sp.delete_file(folder, doc["filename"])

    execute("DELETE FROM onboarding_documents WHERE id=%s", (did,))
    return jsonify(deleted=True), 200


# ── SharePoint config status ──────────────────────────────────────────────────

@onboarding_bp.route("/sp-status", methods=["GET"])
@jwt_required()
def sp_status():
    user = json.loads(get_jwt_identity())
    if user.get("role") != "admin":
        return jsonify(error="Forbidden"), 403
    return jsonify(configured=sp.is_configured()), 200
