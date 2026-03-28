"""routes/performance.py – Performance Management (Goals, Self-Assessment, Feedback, Reviews)"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

performance_bp = Blueprint("performance", __name__)


def _fmt(row):
    for k in ("created_at", "updated_at", "due_date"):
        if row.get(k) and hasattr(row[k], "isoformat"):
            row[k] = row[k].isoformat()
    return row


# ── GOALS ──────────────────────────────────────────────────────────────────────

@performance_bp.route("/goals", methods=["GET"])
@jwt_required()
def list_goals():
    user = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    cycle  = request.args.get("review_cycle")
    status = request.args.get("status")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """
        SELECT g.*, e.name AS employee_name, e.avatar
        FROM   performance_goals g
        JOIN   employees e ON e.id = g.employee_id
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND g.employee_id = %s"; args.append(emp_id)
    if cycle:
        sql += " AND g.review_cycle = %s"; args.append(cycle)
    if status:
        sql += " AND g.status = %s"; args.append(status)
    if user["role"] == "manager" and not emp_id:
        sql += " AND (g.employee_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])
    sql += " ORDER BY g.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/goals", methods=["POST"])
@jwt_required()
def create_goal():
    user = json.loads(get_jwt_identity())
    d = request.get_json(silent=True) or {}
    emp_id = user["employee_id"] if user["role"] == "employee" else (d.get("employeeId") or user["employee_id"])
    title  = (d.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400

    gid = execute(
        """INSERT INTO performance_goals
           (employee_id, title, description, goal_type, review_cycle, due_date, weight, progress, status, created_by)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (emp_id, title, d.get("description",""), d.get("goalType","OKR"),
         d.get("reviewCycle","Annual"), d.get("dueDate") or None,
         int(d.get("weight",100)), int(d.get("progress",0)),
         d.get("status","active"), user["employee_id"])
    )
    row = query("SELECT g.*, e.name AS employee_name, e.avatar FROM performance_goals g JOIN employees e ON e.id=g.employee_id WHERE g.id=%s", (gid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/goals/<int:gid>", methods=["PUT"])
@jwt_required()
def update_goal(gid):
    user = json.loads(get_jwt_identity())
    d = request.get_json(silent=True) or {}
    g = query("SELECT * FROM performance_goals WHERE id=%s", (gid,), fetch="one")
    if not g:
        return jsonify(error="Goal not found"), 404
    if user["role"] == "employee" and g["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403

    execute(
        """UPDATE performance_goals
           SET title=%s, description=%s, goal_type=%s, review_cycle=%s,
               due_date=%s, weight=%s, progress=%s, status=%s
           WHERE id=%s""",
        (d.get("title", g["title"]), d.get("description", g.get("description","")),
         d.get("goalType", g["goal_type"]), d.get("reviewCycle", g["review_cycle"]),
         d.get("dueDate") or g.get("due_date"), int(d.get("weight", g["weight"])),
         int(d.get("progress", g["progress"])), d.get("status", g["status"]), gid)
    )
    row = query("SELECT g.*, e.name AS employee_name, e.avatar FROM performance_goals g JOIN employees e ON e.id=g.employee_id WHERE g.id=%s", (gid,), fetch="one")
    return jsonify(_fmt(row)), 200


@performance_bp.route("/goals/<int:gid>", methods=["DELETE"])
@jwt_required()
def delete_goal(gid):
    user = json.loads(get_jwt_identity())
    g = query("SELECT employee_id FROM performance_goals WHERE id=%s", (gid,), fetch="one")
    if not g:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and g["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_goals WHERE id=%s", (gid,))
    return jsonify(deleted=True), 200


# ── SELF-ASSESSMENTS ───────────────────────────────────────────────────────────

@performance_bp.route("/self-assessments", methods=["GET"])
@jwt_required()
def list_self_assessments():
    user = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    period = request.args.get("review_period")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """
        SELECT sa.*, e.name AS employee_name, e.avatar
        FROM   performance_self_assessments sa
        JOIN   employees e ON e.id = sa.employee_id
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND sa.employee_id = %s"; args.append(emp_id)
    if period:
        sql += " AND sa.review_period = %s"; args.append(period)
    if user["role"] == "manager" and not emp_id:
        sql += " AND e.manager_id = %s"; args.append(user["employee_id"])
    sql += " ORDER BY sa.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/self-assessments", methods=["POST"])
@jwt_required()
def save_self_assessment():
    user = json.loads(get_jwt_identity())
    d = request.get_json(silent=True) or {}
    emp_id = user["employee_id"] if user["role"] == "employee" else (d.get("employeeId") or user["employee_id"])
    period = (d.get("reviewPeriod") or "").strip()
    if not period:
        return jsonify(error="reviewPeriod is required"), 400

    existing = query("SELECT id FROM performance_self_assessments WHERE employee_id=%s AND review_period=%s", (emp_id, period), fetch="one")
    if existing:
        execute(
            """UPDATE performance_self_assessments
               SET achievements=%s, challenges=%s, goals_next=%s, self_rating=%s, status=%s
               WHERE id=%s""",
            (d.get("achievements",""), d.get("challenges",""), d.get("goalsNext",""),
             float(d["selfRating"]) if d.get("selfRating") else None,
             d.get("status","draft"), existing["id"])
        )
        sid = existing["id"]
    else:
        sid = execute(
            """INSERT INTO performance_self_assessments
               (employee_id, review_period, achievements, challenges, goals_next, self_rating, status)
               VALUES (%s,%s,%s,%s,%s,%s,%s)""",
            (emp_id, period, d.get("achievements",""), d.get("challenges",""),
             d.get("goalsNext",""), float(d["selfRating"]) if d.get("selfRating") else None,
             d.get("status","draft"))
        )
    row = query("SELECT sa.*, e.name AS employee_name FROM performance_self_assessments sa JOIN employees e ON e.id=sa.employee_id WHERE sa.id=%s", (sid,), fetch="one")
    return jsonify(_fmt(row)), 200


@performance_bp.route("/self-assessments/<int:sid>/submit", methods=["PATCH"])
@jwt_required()
def submit_self_assessment(sid):
    user = json.loads(get_jwt_identity())
    sa = query("SELECT employee_id FROM performance_self_assessments WHERE id=%s", (sid,), fetch="one")
    if not sa:
        return jsonify(error="Not found"), 404
    if sa["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    execute("UPDATE performance_self_assessments SET status='submitted' WHERE id=%s", (sid,))
    return jsonify(updated=True), 200


# ── FEEDBACK ───────────────────────────────────────────────────────────────────

@performance_bp.route("/feedback", methods=["GET"])
@jwt_required()
def list_feedback():
    user = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    period = request.args.get("review_period")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """
        SELECT f.*, e.name AS employee_name, e.avatar,
               r.name AS reviewer_name
        FROM   performance_feedback f
        JOIN   employees e ON e.id = f.employee_id
        JOIN   employees r ON r.id = f.reviewer_id
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND f.employee_id = %s"; args.append(emp_id)
    if period:
        sql += " AND f.review_period = %s"; args.append(period)
    if user["role"] == "manager" and not emp_id:
        sql += " AND (f.reviewer_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])
    sql += " ORDER BY f.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/feedback", methods=["POST"])
@jwt_required()
def create_feedback():
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Employees cannot add feedback"), 403
    d = request.get_json(silent=True) or {}
    emp_id = d.get("employeeId")
    period = (d.get("reviewPeriod") or "").strip()
    text   = (d.get("feedbackText") or "").strip()
    if not all([emp_id, period, text]):
        return jsonify(error="employeeId, reviewPeriod and feedbackText are required"), 400

    fid = execute(
        """INSERT INTO performance_feedback
           (employee_id, reviewer_id, review_period, category, feedback_text, rating)
           VALUES (%s,%s,%s,%s,%s,%s)""",
        (emp_id, user["employee_id"], period,
         d.get("category","General"), text,
         float(d["rating"]) if d.get("rating") else None)
    )
    row = query("""SELECT f.*, e.name AS employee_name, r.name AS reviewer_name
                   FROM performance_feedback f
                   JOIN employees e ON e.id=f.employee_id
                   JOIN employees r ON r.id=f.reviewer_id
                   WHERE f.id=%s""", (fid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/feedback/<int:fid>", methods=["PUT"])
@jwt_required()
def update_feedback(fid):
    user = json.loads(get_jwt_identity())
    fb = query("SELECT reviewer_id FROM performance_feedback WHERE id=%s", (fid,), fetch="one")
    if not fb:
        return jsonify(error="Not found"), 404
    if fb["reviewer_id"] != user["employee_id"] and user["role"] != "admin":
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    execute(
        "UPDATE performance_feedback SET category=%s, feedback_text=%s, rating=%s WHERE id=%s",
        (d.get("category","General"), d.get("feedbackText",""),
         float(d["rating"]) if d.get("rating") else None, fid)
    )
    return jsonify(updated=True), 200


@performance_bp.route("/feedback/<int:fid>", methods=["DELETE"])
@jwt_required()
def delete_feedback(fid):
    user = json.loads(get_jwt_identity())
    fb = query("SELECT reviewer_id FROM performance_feedback WHERE id=%s", (fid,), fetch="one")
    if not fb:
        return jsonify(error="Not found"), 404
    if fb["reviewer_id"] != user["employee_id"] and user["role"] != "admin":
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_feedback WHERE id=%s", (fid,))
    return jsonify(deleted=True), 200


# ── REVIEWS ────────────────────────────────────────────────────────────────────

@performance_bp.route("/reviews", methods=["GET"])
@jwt_required()
def list_reviews():
    user = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    period = request.args.get("review_period")

    if user["role"] == "employee":
        emp_id = user["employee_id"]

    sql = """
        SELECT rv.*, e.name AS employee_name, e.avatar,
               r.name AS reviewer_name
        FROM   performance_reviews rv
        JOIN   employees e ON e.id = rv.employee_id
        JOIN   employees r ON r.id = rv.reviewer_id
        WHERE  1=1
    """
    args = []
    if emp_id:
        sql += " AND rv.employee_id = %s"; args.append(emp_id)
    if period:
        sql += " AND rv.review_period = %s"; args.append(period)
    if user["role"] == "manager" and not emp_id:
        sql += " AND (rv.reviewer_id = %s OR e.manager_id = %s)"
        args.extend([user["employee_id"], user["employee_id"]])
    sql += " ORDER BY rv.created_at DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@performance_bp.route("/reviews", methods=["POST"])
@jwt_required()
def create_review():
    user = json.loads(get_jwt_identity())
    if user["role"] == "employee":
        return jsonify(error="Employees cannot create reviews"), 403
    d = request.get_json(silent=True) or {}
    emp_id = d.get("employeeId")
    period = (d.get("reviewPeriod") or "").strip()
    if not all([emp_id, period]):
        return jsonify(error="employeeId and reviewPeriod are required"), 400

    existing = query("SELECT id FROM performance_reviews WHERE employee_id=%s AND review_period=%s", (emp_id, period), fetch="one")
    if existing:
        return jsonify(error=f"A review for this period already exists (id={existing['id']})"), 409

    def _r(k): return float(d[k]) if d.get(k) else None
    rid = execute(
        """INSERT INTO performance_reviews
           (employee_id, reviewer_id, review_period, technical_rating, communication_rating,
            teamwork_rating, leadership_rating, overall_rating, strengths, improvements, comments, status)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (emp_id, user["employee_id"], period,
         _r("technicalRating"), _r("communicationRating"), _r("teamworkRating"),
         _r("leadershipRating"), _r("overallRating"),
         d.get("strengths",""), d.get("improvements",""), d.get("comments",""),
         d.get("status","draft"))
    )
    row = query("""SELECT rv.*, e.name AS employee_name, r.name AS reviewer_name
                   FROM performance_reviews rv JOIN employees e ON e.id=rv.employee_id
                   JOIN employees r ON r.id=rv.reviewer_id WHERE rv.id=%s""", (rid,), fetch="one")
    return jsonify(_fmt(row)), 201


@performance_bp.route("/reviews/<int:rid>", methods=["PUT"])
@jwt_required()
def update_review(rid):
    user = json.loads(get_jwt_identity())
    rv = query("SELECT reviewer_id, status FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    if rv["reviewer_id"] != user["employee_id"] and user["role"] != "admin":
        return jsonify(error="Forbidden"), 403
    if rv["status"] == "acknowledged":
        return jsonify(error="Acknowledged reviews cannot be modified"), 400
    d = request.get_json(silent=True) or {}
    def _r(k): return float(d[k]) if d.get(k) else None
    execute(
        """UPDATE performance_reviews
           SET technical_rating=%s, communication_rating=%s, teamwork_rating=%s,
               leadership_rating=%s, overall_rating=%s,
               strengths=%s, improvements=%s, comments=%s, status=%s
           WHERE id=%s""",
        (_r("technicalRating"), _r("communicationRating"), _r("teamworkRating"),
         _r("leadershipRating"), _r("overallRating"),
         d.get("strengths",""), d.get("improvements",""),
         d.get("comments",""), d.get("status","draft"), rid)
    )
    row = query("""SELECT rv.*, e.name AS employee_name, r.name AS reviewer_name
                   FROM performance_reviews rv JOIN employees e ON e.id=rv.employee_id
                   JOIN employees r ON r.id=rv.reviewer_id WHERE rv.id=%s""", (rid,), fetch="one")
    return jsonify(_fmt(row)), 200


@performance_bp.route("/reviews/<int:rid>/submit", methods=["PATCH"])
@jwt_required()
def submit_review(rid):
    user = json.loads(get_jwt_identity())
    rv = query("SELECT reviewer_id FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    if rv["reviewer_id"] != user["employee_id"] and user["role"] != "admin":
        return jsonify(error="Forbidden"), 403
    execute("UPDATE performance_reviews SET status='submitted' WHERE id=%s", (rid,))
    return jsonify(updated=True), 200


@performance_bp.route("/reviews/<int:rid>/acknowledge", methods=["PATCH"])
@jwt_required()
def acknowledge_review(rid):
    user = json.loads(get_jwt_identity())
    rv = query("SELECT employee_id FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    if rv["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    execute("UPDATE performance_reviews SET status='acknowledged' WHERE id=%s", (rid,))
    return jsonify(updated=True), 200


@performance_bp.route("/reviews/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_review(rid):
    user = json.loads(get_jwt_identity())
    rv = query("SELECT reviewer_id FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not rv:
        return jsonify(error="Not found"), 404
    if rv["reviewer_id"] != user["employee_id"] and user["role"] != "admin":
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_reviews WHERE id=%s", (rid,))
    return jsonify(deleted=True), 200
