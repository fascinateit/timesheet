"""routes/accounts.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
import bcrypt
from db import query, execute

accounts_bp = Blueprint("accounts", __name__)


def _fmt(row):
    row.pop("password_hash", None)   # never send hash to frontend
    for k in ("created_at", "updated_at"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


@accounts_bp.route("/", methods=["GET"])
@jwt_required()
def list_accounts():
    rows = query(
        """
        SELECT ua.*, e.name AS emp_name, e.avatar, e.group_id,
               g.name AS group_name, g.color AS group_color
        FROM   user_accounts ua
        LEFT JOIN employees e ON e.id = ua.employee_id
        LEFT JOIN `groups`  g ON g.id = e.group_id
        ORDER  BY ua.id
        """
    )
    return jsonify([_fmt(r) for r in rows]), 200


@accounts_bp.route("/", methods=["POST"])
@jwt_required()
def create_account():
    d        = request.get_json(silent=True) or {}
    username = (d.get("username") or "").strip()
    password = (d.get("password") or "")
    role     = d.get("role", "employee")
    emp_id   = d.get("employeeId") or None

    if not username or not password:
        return jsonify(error="username and password are required"), 400
    if len(password) < 4:
        return jsonify(error="password must be at least 4 characters"), 400
    existing = query("SELECT id FROM user_accounts WHERE username=%s", (username,), fetch="one")
    if existing:
        return jsonify(error="Username already taken"), 409

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    aid = execute(
        "INSERT INTO user_accounts (employee_id, username, password_hash, role, active) VALUES (%s,%s,%s,%s,1)",
        (emp_id, username, pw_hash, role),
    )
    row = query(
        """
        SELECT ua.*, e.name AS emp_name, e.avatar, e.group_id,
               g.name AS group_name, g.color AS group_color
        FROM user_accounts ua
        LEFT JOIN employees e ON e.id=ua.employee_id
        LEFT JOIN `groups`  g ON g.id=e.group_id
        WHERE ua.id=%s
        """,
        (aid,), fetch="one",
    )
    return jsonify(_fmt(row)), 201


@accounts_bp.route("/<int:aid>", methods=["PUT"])
@jwt_required()
def update_account(aid):
    d        = request.get_json(silent=True) or {}
    username = (d.get("username") or "").strip()
    role     = d.get("role", "employee")
    active   = 1 if d.get("active", True) else 0
    new_pass = d.get("newPassword") or d.get("newPass") or ""

    if new_pass:
        pw_hash = bcrypt.hashpw(new_pass.encode(), bcrypt.gensalt()).decode()
        execute(
            "UPDATE user_accounts SET username=%s, role=%s, active=%s, password_hash=%s WHERE id=%s",
            (username, role, active, pw_hash, aid),
        )
    else:
        execute(
            "UPDATE user_accounts SET username=%s, role=%s, active=%s WHERE id=%s",
            (username, role, active, aid),
        )
    row = query(
        """
        SELECT ua.*, e.name AS emp_name, e.avatar, e.group_id,
               g.name AS group_name, g.color AS group_color
        FROM user_accounts ua
        LEFT JOIN employees e ON e.id=ua.employee_id
        LEFT JOIN `groups`  g ON g.id=e.group_id
        WHERE ua.id=%s
        """,
        (aid,), fetch="one",
    )
    return jsonify(_fmt(row)), 200


@accounts_bp.route("/<int:aid>", methods=["DELETE"])
@jwt_required()
def delete_account(aid):
    execute("DELETE FROM user_accounts WHERE id=%s", (aid,))
    return jsonify(deleted=True), 200
