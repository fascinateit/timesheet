from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from db import query, execute

clients_bp = Blueprint("clients", __name__)

@clients_bp.route("/", methods=["GET"])
@jwt_required()
def get_clients():
    sql = "SELECT * FROM clients ORDER BY client_name ASC"
    return jsonify(query(sql))

@clients_bp.route("/", methods=["POST"])
@jwt_required()
def create_client():
    data = request.json
    if not data or "client_name" not in data:
        return jsonify({"error": "Missing client_name"}), 400
    
    sql = """
        INSERT INTO clients (client_name, address, pay_day, gst_number)
        VALUES (%s, %s, %s, %s)
    """
    params = (
        data["client_name"],
        data.get("address"),
        data.get("pay_day"),
        data.get("gst_number")
    )
    res = execute(sql, params)
    return jsonify({"message": "Client created", "id": res}), 201

@clients_bp.route("/<int:client_id>", methods=["PUT"])
@jwt_required()
def update_client(client_id):
    data = request.json
    if not data or "client_name" not in data:
        return jsonify({"error": "Missing client_name"}), 400
        
    sql = """
        UPDATE clients
        SET client_name = %s, address = %s, pay_day = %s, gst_number = %s
        WHERE id = %s
    """
    params = (
        data["client_name"],
        data.get("address"),
        data.get("pay_day"),
        data.get("gst_number"),
        client_id
    )
    execute(sql, params)
    return jsonify({"message": "Client updated"})

@clients_bp.route("/<int:client_id>", methods=["DELETE"])
@jwt_required()
def delete_client(client_id):
    execute("DELETE FROM clients WHERE id = %s", (client_id,))
    return jsonify({"message": "Client deleted"})
