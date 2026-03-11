"""routes/subscriptions.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

subscriptions_bp = Blueprint("subscriptions", __name__)


@subscriptions_bp.route("/", methods=["GET"])
@jwt_required()
def get_subscriptions():
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    rows = query(
        "SELECT * FROM subscriptions ORDER BY expire_date ASC"
    )
    for r in rows:
        for f in ("start_date", "expire_date"):
            if r.get(f) and hasattr(r[f], "isoformat"):
                r[f] = r[f].isoformat()
        for f in ("created_at", "updated_at"):
            if r.get(f) and hasattr(r[f], "isoformat"):
                r[f] = r[f].isoformat()
    return jsonify(rows), 200


@subscriptions_bp.route("/", methods=["POST"])
@jwt_required()
def create_subscription():
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    app_name    = d.get("app_name", "").strip()
    start_date  = d.get("start_date", "")
    expire_date = d.get("expire_date", "")
    amount      = d.get("amount", 0)
    link        = d.get("link", "").strip()

    if not app_name or not start_date or not expire_date or not link:
        return jsonify(error="app_name, start_date, expire_date and link are required"), 400

    sid = execute(
        "INSERT INTO subscriptions (app_name, start_date, expire_date, amount, link) "
        "VALUES (%s, %s, %s, %s, %s)",
        (app_name, start_date, expire_date, amount, link)
    )
    row = query("SELECT * FROM subscriptions WHERE id=%s", (sid,), fetch="one")
    for f in ("start_date", "expire_date", "created_at", "updated_at"):
        if row and row.get(f) and hasattr(row[f], "isoformat"):
            row[f] = row[f].isoformat()
    return jsonify(row), 201


@subscriptions_bp.route("/<int:sid>", methods=["PUT"])
@jwt_required()
def update_subscription(sid):
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    app_name    = d.get("app_name", "").strip()
    start_date  = d.get("start_date", "")
    expire_date = d.get("expire_date", "")
    amount      = d.get("amount", 0)
    link        = d.get("link", "").strip()

    if not app_name or not start_date or not expire_date or not link:
        return jsonify(error="app_name, start_date, expire_date and link are required"), 400

    execute(
        "UPDATE subscriptions SET app_name=%s, start_date=%s, expire_date=%s, amount=%s, link=%s "
        "WHERE id=%s",
        (app_name, start_date, expire_date, amount, link, sid)
    )
    row = query("SELECT * FROM subscriptions WHERE id=%s", (sid,), fetch="one")
    for f in ("start_date", "expire_date", "created_at", "updated_at"):
        if row and row.get(f) and hasattr(row[f], "isoformat"):
            row[f] = row[f].isoformat()
    return jsonify(row), 200


@subscriptions_bp.route("/<int:sid>", methods=["DELETE"])
@jwt_required()
def delete_subscription(sid):
    user = json.loads(get_jwt_identity())
    if user.get("role") not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403

    existing = query("SELECT id FROM subscriptions WHERE id=%s", (sid,), fetch="one")
    if not existing:
        return jsonify(error="Subscription not found"), 404

    execute("DELETE FROM subscriptions WHERE id=%s", (sid,))
    return jsonify(deleted=True), 200
