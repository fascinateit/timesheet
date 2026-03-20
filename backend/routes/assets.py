"""routes/assets.py – Company asset management"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

assets_bp = Blueprint("assets", __name__)

ASSET_SELECT = """
    SELECT a.*, e.name AS employee_name, e.avatar
    FROM   assets a
    LEFT JOIN employees e ON e.id = a.employee_id
    WHERE  1=1
"""


def _fmt(row):
    for k in ("purchase_date", "assigned_date", "warranty_expiry", "created_at"):
        if row and row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@assets_bp.route("/", methods=["GET"])
@jwt_required()
def list_assets():
    status     = request.args.get("status")
    asset_type = request.args.get("type")
    emp_id     = request.args.get("employee_id")

    sql  = ASSET_SELECT
    args = []
    if status:     sql += " AND a.status = %s";      args.append(status)
    if asset_type: sql += " AND a.asset_type = %s";  args.append(asset_type)
    if emp_id:     sql += " AND a.employee_id = %s"; args.append(emp_id)

    sql += " ORDER BY a.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@assets_bp.route("/", methods=["POST"])
@jwt_required()
def create_asset():
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    if not d.get("asset_tag") or not d.get("asset_type"):
        return jsonify(error="asset_tag and asset_type are required"), 400

    aid = execute(
        """INSERT INTO assets
           (asset_tag, asset_type, brand, model, serial_number,
            purchase_date, purchase_cost, warranty_expiry, status, notes)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (d["asset_tag"], d["asset_type"],
         d.get("brand") or None, d.get("model") or None,
         d.get("serial_number") or None,
         d.get("purchase_date") or None,
         float(d["purchase_cost"]) if d.get("purchase_cost") else None,
         d.get("warranty_expiry") or None,
         d.get("status", "available"),
         d.get("notes") or None)
    )
    row = query(ASSET_SELECT + " AND a.id=%s", (aid,), fetch="one")
    return jsonify(_fmt(row)), 201


@assets_bp.route("/<int:aid>", methods=["PUT"])
@jwt_required()
def update_asset(aid):
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    execute(
        """UPDATE assets SET
           asset_tag=%s, asset_type=%s, brand=%s, model=%s, serial_number=%s,
           purchase_date=%s, purchase_cost=%s, warranty_expiry=%s, status=%s, notes=%s
           WHERE id=%s""",
        (d.get("asset_tag"), d.get("asset_type"),
         d.get("brand") or None, d.get("model") or None,
         d.get("serial_number") or None,
         d.get("purchase_date") or None,
         float(d["purchase_cost"]) if d.get("purchase_cost") else None,
         d.get("warranty_expiry") or None,
         d.get("status", "available"),
         d.get("notes") or None, aid)
    )
    row = query(ASSET_SELECT + " AND a.id=%s", (aid,), fetch="one")
    return jsonify(_fmt(row)), 200


@assets_bp.route("/<int:aid>/assign", methods=["PATCH"])
@jwt_required()
def assign_asset(aid):
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d      = request.get_json(silent=True) or {}
    emp_id = d.get("employee_id") or None
    date   = d.get("assigned_date") or None
    status = "assigned" if emp_id else "available"

    execute(
        "UPDATE assets SET employee_id=%s, assigned_date=%s, status=%s WHERE id=%s",
        (emp_id, date, status, aid)
    )
    row = query(ASSET_SELECT + " AND a.id=%s", (aid,), fetch="one")
    return jsonify(_fmt(row)), 200


@assets_bp.route("/<int:aid>", methods=["DELETE"])
@jwt_required()
def delete_asset(aid):
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin",):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM assets WHERE id=%s", (aid,))
    return jsonify(deleted=True), 200
