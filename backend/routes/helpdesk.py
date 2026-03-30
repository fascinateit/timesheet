"""routes/helpdesk.py – Helpdesk / Ticketing System + Document Requests"""
from flask import Blueprint, request, jsonify, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json, os, uuid
from datetime import datetime

helpdesk_bp = Blueprint("helpdesk", __name__)

HELPDESK_DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "helpdesk_docs")


def _fmt(row):
    for k in ("created_at", "updated_at", "requested_at", "uploaded_at", "approved_at", "downloaded_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


def _next_ticket_number():
    row = query("SELECT MAX(CAST(SUBSTR(ticket_number,4) AS UNSIGNED)) AS n FROM helpdesk_tickets", fetch="one")
    n = (row["n"] or 0) + 1
    return f"TKT{n:05d}"


def _next_req_number():
    row = query("SELECT MAX(CAST(SUBSTR(request_number,4) AS UNSIGNED)) AS n FROM helpdesk_document_requests", fetch="one")
    n = (row["n"] or 0) + 1
    return f"DOC{n:05d}"


# ── TICKETS ────────────────────────────────────────────────────────────────────

@helpdesk_bp.route("/tickets", methods=["GET"])
@jwt_required()
def list_tickets():
    user   = json.loads(get_jwt_identity())
    status = request.args.get("status")
    ttype  = request.args.get("ticket_type")
    emp_id = request.args.get("employee_id")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """
        SELECT t.*,
               e.name AS employee_name, e.avatar,
               a.name AS assignee_name
        FROM   helpdesk_tickets t
        JOIN   employees e ON e.id = t.employee_id
        LEFT JOIN employees a ON a.id = t.assigned_to
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND t.employee_id = %s"; args.append(emp_id)
    if status:
        sql += " AND t.status = %s"; args.append(status)
    if ttype:
        sql += " AND t.ticket_type = %s"; args.append(ttype)
    if user["role"] == "manager" and not emp_id:
        sql += " AND (t.employee_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])
    sql += " ORDER BY t.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@helpdesk_bp.route("/tickets", methods=["POST"])
@jwt_required()
def create_ticket():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}
    emp_id  = user["employee_id"] if user["role"] == "employee" else (d.get("employeeId") or user["employee_id"])
    subject = (d.get("subject") or "").strip()
    if not subject:
        return jsonify(error="subject is required"), 400

    tid = execute(
        """INSERT INTO helpdesk_tickets
           (ticket_number, employee_id, ticket_type, category, subject, description, priority, status)
           VALUES (%s,%s,%s,%s,%s,%s,%s,'open')""",
        (_next_ticket_number(), emp_id,
         d.get("ticketType", "HR"), d.get("category", ""),
         subject, d.get("description", ""),
         d.get("priority", "medium"))
    )
    row = query("""SELECT t.*, e.name AS employee_name FROM helpdesk_tickets t
                   JOIN employees e ON e.id=t.employee_id WHERE t.id=%s""", (tid,), fetch="one")
    return jsonify(_fmt(row)), 201


@helpdesk_bp.route("/tickets/<int:tid>", methods=["GET"])
@jwt_required()
def get_ticket(tid):
    user = json.loads(get_jwt_identity())
    t = query("""SELECT t.*, e.name AS employee_name, e.avatar, a.name AS assignee_name
                 FROM helpdesk_tickets t JOIN employees e ON e.id=t.employee_id
                 LEFT JOIN employees a ON a.id=t.assigned_to WHERE t.id=%s""", (tid,), fetch="one")
    if not t:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and t["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    comments = query("""SELECT c.*, e.name AS author_name, e.avatar
                        FROM helpdesk_comments c JOIN employees e ON e.id=c.author_id
                        WHERE c.ticket_id=%s ORDER BY c.created_at ASC""", (tid,))
    # employees see only non-internal comments
    if user["role"] == "employee":
        comments = [c for c in comments if not c.get("is_internal")]
    return jsonify({ **_fmt(t), "comments": [_fmt(c) for c in comments] }), 200


@helpdesk_bp.route("/tickets/<int:tid>", methods=["PUT"])
@jwt_required()
def update_ticket(tid):
    user = json.loads(get_jwt_identity())
    t = query("SELECT * FROM helpdesk_tickets WHERE id=%s", (tid,), fetch="one")
    if not t:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and t["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}

    # employees can only edit open tickets they own
    if user["role"] == "employee":
        if t["status"] != "open":
            return jsonify(error="Cannot edit a ticket that is not open"), 400
        execute("UPDATE helpdesk_tickets SET subject=%s, description=%s, priority=%s WHERE id=%s",
                (d.get("subject", t["subject"]), d.get("description", t.get("description","")),
                 d.get("priority", t["priority"]), tid))
    else:
        execute("""UPDATE helpdesk_tickets SET status=%s, assigned_to=%s, resolution=%s,
                   ticket_type=%s, category=%s, priority=%s WHERE id=%s""",
                (d.get("status", t["status"]),
                 d.get("assignedTo") or t.get("assigned_to"),
                 d.get("resolution", t.get("resolution","")),
                 d.get("ticketType", t["ticket_type"]),
                 d.get("category", t.get("category","")),
                 d.get("priority", t["priority"]), tid))
    row = query("""SELECT t.*, e.name AS employee_name, a.name AS assignee_name
                   FROM helpdesk_tickets t JOIN employees e ON e.id=t.employee_id
                   LEFT JOIN employees a ON a.id=t.assigned_to WHERE t.id=%s""", (tid,), fetch="one")
    return jsonify(_fmt(row)), 200


@helpdesk_bp.route("/tickets/<int:tid>/comments", methods=["POST"])
@jwt_required()
def add_comment(tid):
    user = json.loads(get_jwt_identity())
    t = query("SELECT employee_id FROM helpdesk_tickets WHERE id=%s", (tid,), fetch="one")
    if not t:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and t["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    comment = (d.get("comment") or "").strip()
    if not comment:
        return jsonify(error="comment is required"), 400
    is_internal = bool(d.get("isInternal", False)) and user["role"] != "employee"
    cid = execute("INSERT INTO helpdesk_comments (ticket_id, author_id, comment, is_internal) VALUES (%s,%s,%s,%s)",
                  (tid, user["employee_id"], comment, is_internal))
    row = query("SELECT c.*, e.name AS author_name FROM helpdesk_comments c JOIN employees e ON e.id=c.author_id WHERE c.id=%s",
                (cid,), fetch="one")
    return jsonify(_fmt(row)), 201


@helpdesk_bp.route("/tickets/<int:tid>", methods=["DELETE"])
@jwt_required()
def delete_ticket(tid):
    user = json.loads(get_jwt_identity())
    t = query("SELECT employee_id, status FROM helpdesk_tickets WHERE id=%s", (tid,), fetch="one")
    if not t:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee":
        if t["employee_id"] != user["employee_id"] or t["status"] != "open":
            return jsonify(error="Forbidden"), 403
    elif user["role"] not in ("admin",):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM helpdesk_tickets WHERE id=%s", (tid,))
    return jsonify(deleted=True), 200


# ── DOCUMENT REQUESTS ─────────────────────────────────────────────────────────

@helpdesk_bp.route("/document-requests", methods=["GET"])
@jwt_required()
def list_document_requests():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    status = request.args.get("status")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """
        SELECT dr.*, e.name AS employee_name, e.avatar,
               u.name AS uploaded_by_name
        FROM   helpdesk_document_requests dr
        JOIN   employees e ON e.id = dr.employee_id
        LEFT JOIN employees u ON u.id = dr.uploaded_by
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND dr.employee_id = %s"; args.append(emp_id)
    if status:
        sql += " AND dr.status = %s"; args.append(status)
    sql += " ORDER BY dr.requested_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@helpdesk_bp.route("/document-requests", methods=["POST"])
@jwt_required()
def create_document_request():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}
    emp_id   = user["employee_id"] if user["role"] == "employee" else (d.get("employeeId") or user["employee_id"])
    doc_type = (d.get("documentType") or "").strip()
    if not doc_type:
        return jsonify(error="documentType is required"), 400

    rid = execute(
        """INSERT INTO helpdesk_document_requests
           (request_number, employee_id, document_type, purpose)
           VALUES (%s,%s,%s,%s)""",
        (_next_req_number(), emp_id, doc_type, d.get("purpose", ""))
    )
    row = query("""SELECT dr.*, e.name AS employee_name
                   FROM helpdesk_document_requests dr JOIN employees e ON e.id=dr.employee_id
                   WHERE dr.id=%s""", (rid,), fetch="one")
    return jsonify(_fmt(row)), 201


@helpdesk_bp.route("/document-requests/<int:rid>/upload", methods=["POST"])
@jwt_required()
def upload_document(rid):
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    dr = query("SELECT * FROM helpdesk_document_requests WHERE id=%s", (rid,), fetch="one")
    if not dr:
        return jsonify(error="Not found"), 404
    if "file" not in request.files:
        return jsonify(error="No file provided"), 400

    f = request.files["file"]
    if not f.filename:
        return jsonify(error="No file selected"), 400
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else "bin"
    ALLOWED = {"pdf", "doc", "docx", "png", "jpg", "jpeg"}
    if ext not in ALLOWED:
        return jsonify(error="Only PDF, DOC, DOCX, PNG, JPG allowed"), 400

    os.makedirs(HELPDESK_DOCS_DIR, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    f.save(os.path.join(HELPDESK_DOCS_DIR, filename))

    execute("""UPDATE helpdesk_document_requests
               SET file_url=%s, original_name=%s, uploaded_by=%s,
                   status='approved', uploaded_at=NOW(), approved_at=NOW()
               WHERE id=%s""",
            (filename, f.filename, user["employee_id"], rid))
    row = query("""SELECT dr.*, e.name AS employee_name, u.name AS uploaded_by_name
                   FROM helpdesk_document_requests dr JOIN employees e ON e.id=dr.employee_id
                   LEFT JOIN employees u ON u.id=dr.uploaded_by WHERE dr.id=%s""", (rid,), fetch="one")
    return jsonify(_fmt(row)), 200


@helpdesk_bp.route("/document-requests/<int:rid>/approve", methods=["PATCH"])
@jwt_required()
def approve_document_request(rid):
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    dr = query("SELECT status FROM helpdesk_document_requests WHERE id=%s", (rid,), fetch="one")
    if not dr:
        return jsonify(error="Not found"), 404
    if dr["status"] not in ("uploaded",):
        return jsonify(error="Document must be uploaded before approving"), 400
    d = request.get_json(silent=True) or {}
    execute("UPDATE helpdesk_document_requests SET status='approved', admin_note=%s, approved_at=NOW() WHERE id=%s",
            (d.get("note",""), rid))
    return jsonify(updated=True), 200


@helpdesk_bp.route("/document-requests/<int:rid>/reject", methods=["PATCH"])
@jwt_required()
def reject_document_request(rid):
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    execute("UPDATE helpdesk_document_requests SET status='rejected', admin_note=%s WHERE id=%s",
            (d.get("note",""), rid))
    return jsonify(updated=True), 200


@helpdesk_bp.route("/document-requests/<int:rid>/download", methods=["GET"])
@jwt_required()
def download_document(rid):
    user = json.loads(get_jwt_identity())
    dr = query("SELECT * FROM helpdesk_document_requests WHERE id=%s", (rid,), fetch="one")
    if not dr:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and dr["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    if dr["status"] not in ("uploaded", "approved", "downloaded"):
        return jsonify(error="Document not yet approved for download"), 403
    if not dr.get("file_url"):
        return jsonify(error="No file uploaded"), 404
    # Mark as downloaded (only for employee)
    if user["role"] == "employee":
        execute("UPDATE helpdesk_document_requests SET status='downloaded', downloaded_at=NOW() WHERE id=%s", (rid,))
    return send_from_directory(HELPDESK_DOCS_DIR, dr["file_url"],
                               as_attachment=True,
                               download_name=dr.get("original_name") or dr["file_url"])


@helpdesk_bp.route("/document-requests/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_document_request(rid):
    user = json.loads(get_jwt_identity())
    dr = query("SELECT employee_id, status, file_url FROM helpdesk_document_requests WHERE id=%s", (rid,), fetch="one")
    if not dr:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and (dr["employee_id"] != user["employee_id"] or dr["status"] != "pending"):
        return jsonify(error="Forbidden"), 403
    if dr.get("file_url"):
        try:
            os.remove(os.path.join(HELPDESK_DOCS_DIR, dr["file_url"]))
        except OSError:
            pass
    execute("DELETE FROM helpdesk_document_requests WHERE id=%s", (rid,))
    return jsonify(deleted=True), 200


# ── STATS (for dashboard) ─────────────────────────────────────────────────────

@helpdesk_bp.route("/stats", methods=["GET"])
@jwt_required()
def get_stats():
    user   = json.loads(get_jwt_identity())
    emp_id = user["employee_id"] if user["role"] == "employee" else None
    base   = "AND employee_id=%s" if emp_id else ""
    args   = [emp_id] if emp_id else []
    open_t    = query(f"SELECT COUNT(*) AS n FROM helpdesk_tickets WHERE status='open' {base}", args, fetch="one")["n"]
    inprog_t  = query(f"SELECT COUNT(*) AS n FROM helpdesk_tickets WHERE status='in_progress' {base}", args, fetch="one")["n"]
    resolved  = query(f"SELECT COUNT(*) AS n FROM helpdesk_tickets WHERE status IN ('resolved','closed') {base}", args, fetch="one")["n"]
    pending_d = query(f"SELECT COUNT(*) AS n FROM helpdesk_document_requests WHERE status='pending' {base}", args, fetch="one")["n"]
    approved_d= query(f"SELECT COUNT(*) AS n FROM helpdesk_document_requests WHERE status='approved' {base}", args, fetch="one")["n"]
    return jsonify(open_tickets=open_t, inprogress_tickets=inprog_t, resolved_tickets=resolved,
                   pending_docs=pending_d, approved_docs=approved_d), 200
