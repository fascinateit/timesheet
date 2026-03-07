"""routes/documents.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

documents_bp = Blueprint("documents", __name__)

@documents_bp.route("/", methods=["GET"])
@jwt_required()
def get_documents():
    user = json.loads(get_jwt_identity())
    role = user.get("role")
    req_type = request.args.get("type", "document")

    # Access Control for Viewing
    if req_type == "document" and role not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403
    
    # "policy" can be viewed by anyone, so no restriction block here.

    docs = query(
        "SELECT d.*, e.name AS creator_name "
        "FROM document_links d "
        "LEFT JOIN employees e ON e.id = d.created_by "
        "WHERE d.type = %s "
        "ORDER BY d.created_at DESC",
        (req_type,)
    )
    
    # Format datetimes
    for d in docs:
        if d.get("created_at") and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        if d.get("updated_at") and hasattr(d["updated_at"], "isoformat"):
            d["updated_at"] = d["updated_at"].isoformat()

    return jsonify(docs), 200

@documents_bp.route("/", methods=["POST"])
@jwt_required()
def create_document():
    user = json.loads(get_jwt_identity())
    role = user.get("role")

    d = request.get_json(silent=True) or {}
    title = d.get("title")
    url = d.get("url")
    doc_type = d.get("type", "document")

    # Access Control for Creating
    if doc_type == "policy" and role != "admin":
        return jsonify(error="Only admins can create policies"), 403
    if doc_type == "document" and role not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    if not title or not url:
        return jsonify(error="Title and URL are required"), 400

    did = execute(
        "INSERT INTO document_links (title, url, type, created_by) VALUES (%s, %s, %s, %s)",
        (title.strip(), url.strip(), doc_type, user.get("employee_id"))
    )

    doc = query("SELECT * FROM document_links WHERE id=%s", (did,), fetch="one")
    return jsonify(doc), 201

@documents_bp.route("/<int:did>", methods=["PUT"])
@jwt_required()
def update_document(did):
    user = json.loads(get_jwt_identity())
    role = user.get("role")

    d = request.get_json(silent=True) or {}
    title = d.get("title")
    url = d.get("url")

    if not title or not url:
        return jsonify(error="Title and URL are required"), 400

    # Retrieve existing document to check its type
    existing = query("SELECT type FROM document_links WHERE id=%s", (did,), fetch="one")
    if not existing:
        return jsonify(error="Document not found"), 404

    doc_type = existing["type"]

    # Access Control for Editing
    if doc_type == "policy" and role != "admin":
        return jsonify(error="Only admins can edit policies"), 403
    if doc_type == "document" and role not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    execute(
        "UPDATE document_links SET title=%s, url=%s WHERE id=%s",
        (title.strip(), url.strip(), did)
    )

    doc = query("SELECT * FROM document_links WHERE id=%s", (did,), fetch="one")
    return jsonify(doc), 200

@documents_bp.route("/<int:did>", methods=["DELETE"])
@jwt_required()
def delete_document(did):
    user = json.loads(get_jwt_identity())
    role = user.get("role")
    
    existing = query("SELECT type FROM document_links WHERE id=%s", (did,), fetch="one")
    if not existing:
        return jsonify(error="Document not found"), 404

    doc_type = existing["type"]

    # Access Control for Deleting
    if doc_type == "policy" and role != "admin":
        return jsonify(error="Only admins can delete policies"), 403
    if doc_type == "document" and role not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    execute("DELETE FROM document_links WHERE id=%s", (did,))
    return jsonify(deleted=True), 200
