"""routes/groups.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query, execute

groups_bp = Blueprint("groups", __name__)


@groups_bp.route("/", methods=["GET"])
@jwt_required()
def list_groups():
    rows = query("SELECT * FROM `groups` ORDER BY name")
    return jsonify(rows), 200


@groups_bp.route("/", methods=["POST"])
@jwt_required()
def create_group():
    d = request.get_json(silent=True) or {}
    name        = (d.get("name") or "").strip()
    hourly_rate = d.get("hourlyRate") or d.get("hourly_rate") or 0
    color       = d.get("color", "#3B82F6")
    if not name:
        return jsonify(error="name is required"), 400
    gid = execute(
        "INSERT INTO `groups` (name, hourly_rate, color) VALUES (%s,%s,%s)",
        (name, float(hourly_rate), color),
    )
    row = query("SELECT * FROM `groups` WHERE id=%s", (gid,), fetch="one")
    return jsonify(row), 201


@groups_bp.route("/<int:gid>", methods=["PUT"])
@jwt_required()
def update_group(gid):
    d = request.get_json(silent=True) or {}
    execute(
        "UPDATE `groups` SET name=%s, hourly_rate=%s, color=%s WHERE id=%s",
        (d.get("name"), float(d.get("hourlyRate", 0)), d.get("color","#3B82F6"), gid),
    )
    row = query("SELECT * FROM `groups` WHERE id=%s", (gid,), fetch="one")
    return jsonify(row), 200


@groups_bp.route("/<int:gid>", methods=["DELETE"])
@jwt_required()
def delete_group(gid):
    execute("DELETE FROM `groups` WHERE id=%s", (gid,))
    return jsonify(deleted=True), 200
