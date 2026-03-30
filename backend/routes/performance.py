"""routes/performance.py – Performance Management"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

performance_bp = Blueprint("performance", __name__)


def _fmt(row):
    for k in ("created_at", "updated_at", "submitted_at", "acknowledged_at", "due_date"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


# ── GOALS ─────────────────────────────────────────────────────────────────────

@performance_bp.route("/goals", methods=["GET"])
@jwt_required()
def list_goals():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    cycle  = request.args.get("cycle")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """SELECT g.*, e.name AS employee_name
             FROM performance_goals g JOIN employees e ON e.id=g.employee_id WHERE 1=1"""
    args = []
    if emp_id:
        sql += " AND g.employee_id=%s"; args.append(emp_id)
    if cycle:
        sql += " AND g.review_cycle=%s"; args.append(cycle)
    sql += " ORDER BY g.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/goals", methods=["POST"])
@jwt_required()
def create_goal():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}
    emp_id = user["employee_id"] if user["role"] == "employee" else (d.get("employeeId") or user["employee_id"])
    title = (d.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400
    gid = execute(
        """INSERT INTO performance_goals
           (employee_id, title, description, goal_type, review_cycle, due_date, weight, progress, status, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'active',%s)""",
        (emp_id, title, d.get("description", ""),
         d.get("goalType", "KPI"), d.get("cycle", "Annual"),
         d.get("dueDate") or None,
         d.get("weight", 100), d.get("progress", 0),
         user["employee_id"])
    )
    row = query("SELECT g.*, e.name AS employee_name FROM performance_goals g JOIN employees e ON e.id=g.employee_id WHERE g.id=%s", (gid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/goals/<int:gid>", methods=["PUT"])
@jwt_required()
def update_goal(gid):
    user = json.loads(get_jwt_identity())
    g = query("SELECT * FROM performance_goals WHERE id=%s", (gid,), fetch="one")
    if not g:
        return jsonify(error="Not found"), 404
    d = request.get_json(silent=True) or {}
    execute("""UPDATE performance_goals
               SET title=%s, description=%s, goal_type=%s, review_cycle=%s,
                   due_date=%s, weight=%s, progress=%s, status=%s WHERE id=%s""",
            (d.get("title", g["title"]),
             d.get("description", g.get("description", "")),
             d.get("goalType", g["goal_type"]),
             d.get("cycle", g["review_cycle"]),
             d.get("dueDate") or g.get("due_date"),
             d.get("weight", g["weight"]),
             d.get("progress", g["progress"]),
             d.get("status", g["status"]), gid))
    row = query("SELECT g.*, e.name AS employee_name FROM performance_goals g JOIN employees e ON e.id=g.employee_id WHERE g.id=%s", (gid,), fetch="one")
    return jsonify(_fmt(row)), 200


@performance_bp.route("/goals/<int:gid>", methods=["DELETE"])
@jwt_required()
def delete_goal(gid):
    user = json.loads(get_jwt_identity())
    g = query("SELECT employee_id FROM performance_goals WHERE id=%s", (gid,), fetch="one")
    if not g:
        return jsonify(error="Not found"), 404
    execute("DELETE FROM performance_goals WHERE id=%s", (gid,))
    return jsonify(deleted=True), 200


# ── SELF ASSESSMENTS ──────────────────────────────────────────────────────────

@performance_bp.route("/self-assessments", methods=["GET"])
@jwt_required()
def list_self_assessments():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    cycle  = request.args.get("cycle")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = "SELECT sa.*, e.name AS employee_name FROM performance_self_assessments sa JOIN employees e ON e.id=sa.employee_id WHERE 1=1"
    args = []
    if emp_id:
        sql += " AND sa.employee_id=%s"; args.append(emp_id)
    if cycle:
        sql += " AND sa.review_period=%s"; args.append(cycle)
    sql += " ORDER BY sa.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/self-assessments", methods=["POST"])
@jwt_required()
def create_self_assessment():
    user = json.loads(get_jwt_identity())
    d    = request.get_json(silent=True) or {}
    emp_id = user["employee_id"] if user["role"] == "employee" else (d.get("employeeId") or user["employee_id"])
    sid = execute(
        """INSERT INTO performance_self_assessments
           (employee_id, review_period, achievements, challenges, goals_next, self_rating, status)
           VALUES (%s,%s,%s,%s,%s,%s,'draft')""",
        (emp_id, d.get("cycle", "Annual"),
         d.get("achievements", ""), d.get("challenges", ""),
         d.get("goalsNext", ""), d.get("rating", 0))
    )
    row = query("SELECT sa.*, e.name AS employee_name FROM performance_self_assessments sa JOIN employees e ON e.id=sa.employee_id WHERE sa.id=%s", (sid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/self-assessments/<int:sid>", methods=["PUT"])
@jwt_required()
def update_self_assessment(sid):
    user = json.loads(get_jwt_identity())
    sa = query("SELECT * FROM performance_self_assessments WHERE id=%s", (sid,), fetch="one")
    if not sa:
        return jsonify(error="Not found"), 404
    d = request.get_json(silent=True) or {}
    execute("""UPDATE performance_self_assessments
               SET achievements=%s, challenges=%s, goals_next=%s, self_rating=%s WHERE id=%s""",
            (d.get("achievements", sa.get("achievements", "")),
             d.get("challenges", sa.get("challenges", "")),
             d.get("goalsNext", sa.get("goals_next", "")),
             d.get("rating", sa["self_rating"]), sid))
    row = query("SELECT sa.*, e.name AS employee_name FROM performance_self_assessments sa JOIN employees e ON e.id=sa.employee_id WHERE sa.id=%s", (sid,), fetch="one")
    return jsonify(_fmt(row)), 200


@performance_bp.route("/self-assessments/<int:sid>/submit", methods=["PATCH"])
@jwt_required()
def submit_self_assessment(sid):
    sa = query("SELECT id FROM performance_self_assessments WHERE id=%s", (sid,), fetch="one")
    if not sa:
        return jsonify(error="Not found"), 404
    execute("UPDATE performance_self_assessments SET status='submitted' WHERE id=%s", (sid,))
    return jsonify(updated=True), 200


# ── FEEDBACK ──────────────────────────────────────────────────────────────────

@performance_bp.route("/feedback", methods=["GET"])
@jwt_required()
def list_feedback():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    cycle  = request.args.get("cycle")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """SELECT f.*, e.name AS employee_name, r.name AS reviewer_name
             FROM performance_feedback f
             JOIN employees e ON e.id=f.employee_id
             JOIN employees r ON r.id=f.reviewer_id
             WHERE 1=1"""
    args = []
    if emp_id:
        sql += " AND f.employee_id=%s"; args.append(emp_id)
    if cycle:
        sql += " AND f.review_period=%s"; args.append(cycle)
    sql += " ORDER BY f.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/feedback", methods=["POST"])
@jwt_required()
def create_feedback():
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    emp_id = d.get("employeeId")
    if not emp_id:
        return jsonify(error="employeeId is required"), 400
    fid = execute(
        """INSERT INTO performance_feedback
           (employee_id, reviewer_id, review_period, category, feedback_text, rating)
           VALUES (%s,%s,%s,%s,%s,%s)""",
        (emp_id, user["employee_id"], d.get("cycle", "Annual"),
         d.get("category", "General"), d.get("feedbackText", ""), d.get("rating", 0))
    )
    row = query("""SELECT f.*, e.name AS employee_name, r.name AS reviewer_name
                   FROM performance_feedback f JOIN employees e ON e.id=f.employee_id
                   JOIN employees r ON r.id=f.reviewer_id WHERE f.id=%s""", (fid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/feedback/<int:fid>", methods=["DELETE"])
@jwt_required()
def delete_feedback(fid):
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin",):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_feedback WHERE id=%s", (fid,))
    return jsonify(deleted=True), 200


# ── REVIEWS ───────────────────────────────────────────────────────────────────

@performance_bp.route("/reviews", methods=["GET"])
@jwt_required()
def list_reviews():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    cycle  = request.args.get("cycle")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """SELECT rv.*, e.name AS employee_name, r.name AS reviewer_name
             FROM performance_reviews rv
             JOIN employees e ON e.id=rv.employee_id
             JOIN employees r ON r.id=rv.reviewer_id
             WHERE 1=1"""
    args = []
    if emp_id:
        sql += " AND rv.employee_id=%s"; args.append(emp_id)
    if cycle:
        sql += " AND rv.review_period=%s"; args.append(cycle)
    sql += " ORDER BY rv.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/reviews", methods=["POST"])
@jwt_required()
def create_review():
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    emp_id = d.get("employeeId")
    if not emp_id:
        return jsonify(error="employeeId is required"), 400
    rid = execute(
        """INSERT INTO performance_reviews
           (employee_id, reviewer_id, review_period, technical_rating, communication_rating,
            teamwork_rating, leadership_rating, overall_rating, strengths, improvements, comments, status)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'draft')""",
        (emp_id, user["employee_id"], d.get("cycle", "Annual"),
         d.get("technical", 0), d.get("communication", 0),
         d.get("teamwork", 0), d.get("leadership", 0), d.get("overall", 0),
         d.get("strengths", ""), d.get("improvements", ""), d.get("comments", ""))
    )
    row = query("""SELECT rv.*, e.name AS employee_name, r.name AS reviewer_name
                   FROM performance_reviews rv JOIN employees e ON e.id=rv.employee_id
                   JOIN employees r ON r.id=rv.reviewer_id WHERE rv.id=%s""", (rid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/reviews/<int:rid>", methods=["PUT"])
@jwt_required()
def update_review(rid):
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    rv = query("SELECT * FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    d = request.get_json(silent=True) or {}
    execute("""UPDATE performance_reviews SET technical_rating=%s, communication_rating=%s,
               teamwork_rating=%s, leadership_rating=%s, overall_rating=%s,
               strengths=%s, improvements=%s, comments=%s WHERE id=%s""",
            (d.get("technical", rv["technical_rating"]),
             d.get("communication", rv["communication_rating"]),
             d.get("teamwork", rv["teamwork_rating"]),
             d.get("leadership", rv["leadership_rating"]),
             d.get("overall", rv["overall_rating"]),
             d.get("strengths", rv.get("strengths", "")),
             d.get("improvements", rv.get("improvements", "")),
             d.get("comments", rv.get("comments", "")), rid))
    row = query("""SELECT rv.*, e.name AS employee_name, r.name AS reviewer_name
                   FROM performance_reviews rv JOIN employees e ON e.id=rv.employee_id
                   JOIN employees r ON r.id=rv.reviewer_id WHERE rv.id=%s""", (rid,), fetch="one")
    return jsonify(_fmt(row)), 200


@performance_bp.route("/reviews/<int:rid>/submit", methods=["PATCH"])
@jwt_required()
def submit_review(rid):
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    rv = query("SELECT id FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    execute("UPDATE performance_reviews SET status='submitted' WHERE id=%s", (rid,))
    return jsonify(updated=True), 200


@performance_bp.route("/reviews/<int:rid>/acknowledge", methods=["PATCH"])
@jwt_required()
def acknowledge_review(rid):
    user = json.loads(get_jwt_identity())
    rv = query("SELECT employee_id FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and str(rv["employee_id"]) != str(user["employee_id"]):
        return jsonify(error="Forbidden"), 403
    execute("UPDATE performance_reviews SET status='acknowledged' WHERE id=%s", (rid,))
    return jsonify(updated=True), 200


@performance_bp.route("/reviews/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_review(rid):
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin",):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_reviews WHERE id=%s", (rid,))
    return jsonify(deleted=True), 200
