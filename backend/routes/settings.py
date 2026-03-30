"""routes/settings.py – Admin-configurable app settings"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

settings_bp = Blueprint("settings", __name__)


# ── Leave Settings ────────────────────────────────────────────────────────────

@settings_bp.route("/leave", methods=["GET"])
@jwt_required()
def get_leave_settings():
    """Return leave settings (all authenticated users)."""
    rows = query("SELECT setting_key, setting_value FROM leave_settings", fetch="all") or []
    return jsonify({r["setting_key"]: r["setting_value"] for r in rows}), 200


@settings_bp.route("/leave", methods=["PUT"])
@jwt_required()
def update_leave_settings():
    """Update leave settings (admin only)."""
    user = json.loads(get_jwt_identity())
    if user["role"] != "admin":
        return jsonify(error="Admin only"), 403

    d = request.get_json(silent=True) or {}
    allowed_keys = {"holiday_link"}

    updated = 0
    for key, value in d.items():
        if key not in allowed_keys:
            continue
        execute(
            "INSERT INTO leave_settings (setting_key, setting_value) VALUES (%s, %s) "
            "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
            (key, value if value else None),
        )
        updated += 1

    return jsonify(updated=updated), 200
