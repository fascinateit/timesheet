"""routes/auth.py – login & token management."""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt
from db import query
import json

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "")
    print(username, password)
    if not username or not password:
        return jsonify(error="Username and password required"), 400

    row = query(
        """
        SELECT ua.id, ua.employee_id, ua.username, ua.password_hash, ua.role, ua.active,
               e.name AS emp_name, e.avatar, e.group_id
        FROM   user_accounts ua
        LEFT JOIN employees e ON e.id = ua.employee_id
        WHERE  ua.username = %s
        LIMIT  1
        """,
        (username,),
        fetch="one",
    )
    print(row["password_hash"].encode())
    print(password.encode())
    if not row:
        return jsonify(error="Invalid username or password"), 401

    if not row["active"]:
        return jsonify(error="Account deactivated. Contact your administrator."), 403

    if not bcrypt.checkpw(password.encode(), row["password_hash"].encode()):
        return jsonify(error="Invalid username or password"), 401

    identity = {
        "id":          row["id"],
        "employee_id": row["employee_id"],
        "username":    row["username"],
        "role":        row["role"],
        "emp_name":    row["emp_name"],
        "avatar":      row["avatar"],
        "group_id":    row["group_id"],
    }
    token = create_access_token(identity=json.dumps(identity))
    return jsonify(access_token=token, user=identity), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    return jsonify(get_jwt_identity()), 200

@auth_bp.route("/password", methods=["PUT"])
@jwt_required()
def change_password():
    identity = json.loads(get_jwt_identity())
    user_id = identity.get("id")

    data = request.get_json(silent=True) or {}
    old_pw = (data.get("oldPassword") or "").strip()
    new_pw = (data.get("newPassword") or "").strip()

    if not old_pw or not new_pw:
        return jsonify(error="Both current and new passwords are required"), 400

    row = query("SELECT password_hash FROM user_accounts WHERE id=%s", (user_id,), fetch="one")
    if not row:
        return jsonify(error="User account not found"), 404

    if not bcrypt.checkpw(old_pw.encode(), row["password_hash"].encode()):
        return jsonify(error="Incorrect current password"), 401

    hashed = bcrypt.hashpw(new_pw.encode(), bcrypt.gensalt()).decode()
    from db import execute
    execute("UPDATE user_accounts SET password_hash=%s WHERE id=%s", (hashed, user_id))

    return jsonify({"message": "Password updated successfully"}), 200
