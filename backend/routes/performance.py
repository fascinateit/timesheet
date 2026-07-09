"""routes/performance.py – Performance Management API"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

performance_bp = Blueprint("performance", __name__)


def _user():
    return json.loads(get_jwt_identity())


def _fmt_dates(row, fields=("due_date", "feedback_date", "review_date", "submitted_at",
                             "start_date", "end_date", "created_at", "updated_at")):
    if not row:
        return row
    for f in fields:
        if row.get(f) and hasattr(row[f], "isoformat"):
            row[f] = row[f].isoformat()
    return row


def _is_manager_of(manager_emp_id, employee_id):
    """Check that employee_id has manager_id = manager_emp_id in employees table."""
    row = query(
        "SELECT id FROM employees WHERE id=%s AND manager_id=%s",
        (employee_id, manager_emp_id), fetch="one"
    )
    return row is not None


# ════════════════════════════════════════════════
# GOALS
# ════════════════════════════════════════════════
GOAL_SELECT = """
    SELECT g.*,
           e.name AS employee_name,
           COALESCE(grp.color, '#6366F1') AS group_color
    FROM performance_goals g
    JOIN employees e ON e.id = g.employee_id
    LEFT JOIN `groups` grp ON grp.id = e.group_id
    WHERE 1=1
"""


@performance_bp.route("/goals/", methods=["GET"])
@jwt_required()
def list_goals():
    user = _user()
    emp_id = request.args.get("employee_id")
    sql, args = GOAL_SELECT, []

    if user["role"] == "employee":
        sql += " AND g.employee_id = %s"; args.append(user["employee_id"])
    elif user["role"] == "manager":
        if emp_id:
            # Check the requested employee is actually their report
            if not _is_manager_of(user["employee_id"], int(emp_id)):
                return jsonify(error="Forbidden"), 403
            sql += " AND g.employee_id = %s"; args.append(int(emp_id))
        else:
            # Show all goals from direct reports (employees whose manager_id = this manager)
            sql += " AND (SELECT manager_id FROM employees WHERE id=g.employee_id) = %s"
            args.append(user["employee_id"])
    else:  # admin
        if emp_id:
            sql += " AND g.employee_id = %s"; args.append(int(emp_id))

    sql += " ORDER BY e.name ASC, g.created_at DESC"
    return jsonify([_fmt_dates(r) for r in query(sql, args)]), 200


@performance_bp.route("/goals/", methods=["POST"])
@jwt_required()
def create_goal():
    user = _user()
    d = request.get_json(silent=True) or {}
    title = (d.get("title") or "").strip()
    if not title:
        return jsonify(error="title is required"), 400

    # Determine employee_id
    if user["role"] == "admin":
        emp_id = d.get("employeeId") or user["employee_id"]
    elif user["role"] == "manager":
        emp_id = d.get("employeeId") or user["employee_id"]
        if int(emp_id) != user["employee_id"] and not _is_manager_of(user["employee_id"], int(emp_id)):
            return jsonify(error="You can only create goals for your direct reports"), 403
    else:
        emp_id = user["employee_id"]

    gid = execute(
        """INSERT INTO performance_goals
           (employee_id, title, description, type, target, current_value, due_date, status, priority)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (emp_id, title, d.get("description") or None, d.get("type", "OKR"),
         d.get("target") or None, d.get("current") or None,
         d.get("due") or None, d.get("status", "on-track"), d.get("priority", "medium"))
    )
    row = query(GOAL_SELECT + " AND g.id=%s", (gid,), fetch="one")
    return jsonify(_fmt_dates(row)), 201


@performance_bp.route("/goals/<int:gid>", methods=["PUT"])
@jwt_required()
def update_goal(gid):
    user = _user()
    row = query("SELECT * FROM performance_goals WHERE id=%s", (gid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and row["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    if user["role"] == "manager" and row["employee_id"] != user["employee_id"] and not _is_manager_of(user["employee_id"], row["employee_id"]):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    execute(
        """UPDATE performance_goals SET title=%s, description=%s, type=%s, target=%s,
           current_value=%s, due_date=%s, status=%s, priority=%s WHERE id=%s""",
        (d.get("title", row["title"]), d.get("description") or None,
         d.get("type", row["type"]), d.get("target") or None, d.get("current") or None,
         d.get("due") or None, d.get("status", row["status"]), d.get("priority", row["priority"]), gid)
    )
    row = query(GOAL_SELECT + " AND g.id=%s", (gid,), fetch="one")
    return jsonify(_fmt_dates(row)), 200


@performance_bp.route("/goals/<int:gid>", methods=["DELETE"])
@jwt_required()
def delete_goal(gid):
    user = _user()
    row = query("SELECT * FROM performance_goals WHERE id=%s", (gid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee" and row["employee_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    if user["role"] == "manager" and row["employee_id"] != user["employee_id"] and not _is_manager_of(user["employee_id"], row["employee_id"]):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_goals WHERE id=%s", (gid,))
    return jsonify(deleted=True), 200


# ════════════════════════════════════════════════
# REVIEW CYCLES
# ════════════════════════════════════════════════
@performance_bp.route("/review-cycles/", methods=["GET"])
@jwt_required()
def list_cycles():
    rows = query("SELECT * FROM review_cycles ORDER BY start_date DESC, id DESC")
    return jsonify([_fmt_dates(r) for r in rows]), 200


@performance_bp.route("/review-cycles/", methods=["POST"])
@jwt_required()
def create_cycle():
    user = _user()
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    name = (d.get("name") or "").strip()
    if not name:
        return jsonify(error="name is required"), 400
    cid = execute(
        "INSERT INTO review_cycles (name, start_date, end_date, status) VALUES (%s,%s,%s,%s)",
        (name, d.get("startDate") or None, d.get("endDate") or None, d.get("status", "active"))
    )
    row = query("SELECT * FROM review_cycles WHERE id=%s", (cid,), fetch="one")
    return jsonify(_fmt_dates(row)), 201


@performance_bp.route("/review-cycles/<int:cid>", methods=["PUT"])
@jwt_required()
def update_cycle(cid):
    user = _user()
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403
    d = request.get_json(silent=True) or {}
    row = query("SELECT * FROM review_cycles WHERE id=%s", (cid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    execute(
        "UPDATE review_cycles SET name=%s, start_date=%s, end_date=%s, status=%s WHERE id=%s",
        (d.get("name", row["name"]), d.get("startDate") or None,
         d.get("endDate") or None, d.get("status", row["status"]), cid)
    )
    row = query("SELECT * FROM review_cycles WHERE id=%s", (cid,), fetch="one")
    return jsonify(_fmt_dates(row)), 200


@performance_bp.route("/review-cycles/<int:cid>", methods=["DELETE"])
@jwt_required()
def delete_cycle(cid):
    user = _user()
    if user["role"] != "admin":
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM review_cycles WHERE id=%s", (cid,))
    return jsonify(deleted=True), 200


# ════════════════════════════════════════════════
# SELF-ASSESSMENTS
# ════════════════════════════════════════════════
SA_SELECT = """
    SELECT sa.*, e.name AS employee_name,
           COALESCE(grp.color, '#6366F1') AS group_color,
           rc.name AS cycle_name
    FROM self_assessments sa
    JOIN employees e ON e.id = sa.employee_id
    LEFT JOIN `groups` grp ON grp.id = e.group_id
    LEFT JOIN review_cycles rc ON rc.id = sa.review_cycle_id
    WHERE 1=1
"""


@performance_bp.route("/self-assessments/", methods=["GET"])
@jwt_required()
def list_self_assessments():
    user = _user()
    emp_id = request.args.get("employee_id")
    cycle_id = request.args.get("review_cycle_id")
    sql, args = SA_SELECT, []

    if user["role"] == "employee":
        sql += " AND sa.employee_id = %s"; args.append(user["employee_id"])
    elif user["role"] == "manager":
        if emp_id:
            sql += " AND sa.employee_id = %s"; args.append(int(emp_id))
        else:
            sql += " AND (SELECT manager_id FROM employees WHERE id=sa.employee_id) = %s"
            args.append(user["employee_id"])
    else:
        if emp_id:
            sql += " AND sa.employee_id = %s"; args.append(int(emp_id))

    if cycle_id:
        sql += " AND sa.review_cycle_id = %s"; args.append(int(cycle_id))

    sql += " ORDER BY e.name ASC, sa.created_at DESC"
    return jsonify([_fmt_dates(r) for r in query(sql, args)]), 200


@performance_bp.route("/self-assessments/", methods=["POST"])
@jwt_required()
def upsert_self_assessment():
    user = _user()
    d = request.get_json(silent=True) or {}

    # Employees can only submit for themselves
    if user["role"] == "employee":
        emp_id = user["employee_id"]
    else:
        emp_id = d.get("employeeId") or user["employee_id"]

    period = (d.get("period") or "").strip()
    cycle_id = d.get("reviewCycleId") or None

    existing = query(
        "SELECT id FROM self_assessments WHERE employee_id=%s AND period=%s",
        (emp_id, period), fetch="one"
    )

    fields = ("technical_skill", "communication", "teamwork", "leadership", "innovation")
    ratings = {f: int(d.get(f.replace("_", ""), d.get(f, 3))) for f in fields}

    if existing:
        execute(
            """UPDATE self_assessments SET review_cycle_id=%s, technical_skill=%s,
               communication=%s, teamwork=%s, leadership=%s, innovation=%s,
               accomplishments=%s, challenges=%s, learnings=%s, next_goals=%s,
               support_needed=%s, submitted_at=NOW() WHERE id=%s""",
            (cycle_id, ratings["technical_skill"], ratings["communication"], ratings["teamwork"],
             ratings["leadership"], ratings["innovation"],
             d.get("accomplishments") or None, d.get("challenges") or None,
             d.get("learnings") or None, d.get("nextGoals") or None,
             d.get("supportNeeded") or None, existing["id"])
        )
        sid = existing["id"]
    else:
        sid = execute(
            """INSERT INTO self_assessments
               (employee_id, review_cycle_id, period, technical_skill, communication,
                teamwork, leadership, innovation, accomplishments, challenges, learnings,
                next_goals, support_needed, submitted_at)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())""",
            (emp_id, cycle_id, period,
             ratings["technical_skill"], ratings["communication"], ratings["teamwork"],
             ratings["leadership"], ratings["innovation"],
             d.get("accomplishments") or None, d.get("challenges") or None,
             d.get("learnings") or None, d.get("nextGoals") or None, d.get("supportNeeded") or None)
        )

    row = query(SA_SELECT + " AND sa.id=%s", (sid,), fetch="one")
    return jsonify(_fmt_dates(row)), 200


# ════════════════════════════════════════════════
# MANAGER FEEDBACK
# ════════════════════════════════════════════════
FB_SELECT = """
    SELECT mf.*,
           emp.name AS employee_name,
           COALESCE(egrp.color, '#6366F1') AS employee_group_color,
           mgr.name AS manager_name,
           rc.name AS cycle_name
    FROM manager_feedback mf
    JOIN employees emp ON emp.id = mf.employee_id
    LEFT JOIN `groups` egrp ON egrp.id = emp.group_id
    JOIN employees mgr ON mgr.id = mf.manager_id
    LEFT JOIN review_cycles rc ON rc.id = mf.review_cycle_id
    WHERE 1=1
"""


@performance_bp.route("/feedbacks/", methods=["GET"])
@jwt_required()
def list_feedbacks():
    user = _user()
    emp_id = request.args.get("employee_id")
    sql, args = FB_SELECT, []

    if user["role"] == "employee":
        sql += " AND mf.employee_id = %s"; args.append(user["employee_id"])
    elif user["role"] == "manager":
        if emp_id:
            sql += " AND mf.employee_id = %s AND mf.manager_id = %s"
            args += [int(emp_id), user["employee_id"]]
        else:
            sql += " AND mf.manager_id = %s"; args.append(user["employee_id"])
    else:  # admin
        if emp_id:
            sql += " AND mf.employee_id = %s"; args.append(int(emp_id))

    sql += " ORDER BY mf.created_at DESC"
    return jsonify([_fmt_dates(r) for r in query(sql, args)]), 200


@performance_bp.route("/feedbacks/", methods=["POST"])
@jwt_required()
def create_feedback():
    user = _user()
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Only managers and admins can give feedback"), 403

    d = request.get_json(silent=True) or {}
    emp_id = d.get("employeeId")
    if not emp_id:
        return jsonify(error="employeeId is required"), 400

    # Manager can only give feedback to their direct reports
    if user["role"] == "manager":
        if not _is_manager_of(user["employee_id"], int(emp_id)):
            return jsonify(error="You can only give feedback to your direct reports"), 403
        mgr_id = user["employee_id"]
    else:
        mgr_id = d.get("managerId") or user.get("employee_id")

    fid = execute(
        """INSERT INTO manager_feedback
           (employee_id, manager_id, review_cycle_id, period, feedback_date,
            overall_rating, strengths, areas_to_improve, manager_comment)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (emp_id, mgr_id, d.get("reviewCycleId") or None,
         d.get("period") or None, d.get("feedbackDate") or None,
         int(d.get("overallRating", 3)),
         d.get("strengths") or None, d.get("areasToImprove") or None,
         d.get("managerComment") or None)
    )
    row = query(FB_SELECT + " AND mf.id=%s", (fid,), fetch="one")
    return jsonify(_fmt_dates(row)), 201


@performance_bp.route("/feedbacks/<int:fid>", methods=["PUT"])
@jwt_required()
def update_feedback(fid):
    user = _user()
    row = query("SELECT * FROM manager_feedback WHERE id=%s", (fid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    if user["role"] == "manager" and row["manager_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    execute(
        """UPDATE manager_feedback SET review_cycle_id=%s, period=%s, feedback_date=%s,
           overall_rating=%s, strengths=%s, areas_to_improve=%s, manager_comment=%s WHERE id=%s""",
        (d.get("reviewCycleId") or row["review_cycle_id"],
         d.get("period") or row["period"],
         d.get("feedbackDate") or row["feedback_date"],
         int(d.get("overallRating", row["overall_rating"])),
         d.get("strengths") or row["strengths"],
         d.get("areasToImprove") or row["areas_to_improve"],
         d.get("managerComment") or row["manager_comment"], fid)
    )
    row = query(FB_SELECT + " AND mf.id=%s", (fid,), fetch="one")
    return jsonify(_fmt_dates(row)), 200


@performance_bp.route("/feedbacks/<int:fid>", methods=["DELETE"])
@jwt_required()
def delete_feedback(fid):
    user = _user()
    row = query("SELECT * FROM manager_feedback WHERE id=%s", (fid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    # Admin can delete any; manager can delete their own feedback
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    if user["role"] == "manager" and row["manager_id"] != user["employee_id"]:
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM manager_feedback WHERE id=%s", (fid,))
    return jsonify(deleted=True), 200


# ════════════════════════════════════════════════
# PERFORMANCE REVIEWS
# ════════════════════════════════════════════════
REV_SELECT = """
    SELECT pr.*,
           emp.name AS employee_name,
           COALESCE(egrp.color, '#6366F1') AS group_color,
           mgr.name AS reviewer_name,
           rc.name AS cycle_name, rc.start_date AS cycle_start, rc.end_date AS cycle_end
    FROM performance_reviews pr
    JOIN employees emp ON emp.id = pr.employee_id
    LEFT JOIN `groups` egrp ON egrp.id = emp.group_id
    LEFT JOIN employees mgr ON mgr.id = pr.reviewer_id
    LEFT JOIN review_cycles rc ON rc.id = pr.review_cycle_id
    WHERE 1=1
"""


@performance_bp.route("/reviews/", methods=["GET"])
@jwt_required()
def list_reviews():
    user = _user()
    emp_id = request.args.get("employee_id")
    cycle_id = request.args.get("review_cycle_id")
    sql, args = REV_SELECT, []

    if user["role"] == "employee":
        sql += " AND pr.employee_id = %s"; args.append(user["employee_id"])
    elif user["role"] == "manager":
        if emp_id:
            sql += " AND pr.employee_id = %s"; args.append(int(emp_id))
        else:
            sql += " AND (SELECT manager_id FROM employees WHERE id=pr.employee_id) = %s"
            args.append(user["employee_id"])
    else:
        if emp_id:
            sql += " AND pr.employee_id = %s"; args.append(int(emp_id))

    if cycle_id:
        sql += " AND pr.review_cycle_id = %s"; args.append(int(cycle_id))

    sql += " ORDER BY pr.created_at DESC"
    return jsonify([_fmt_dates(r) for r in query(sql, args)]), 200


@performance_bp.route("/reviews/", methods=["POST"])
@jwt_required()
def create_review():
    user = _user()
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Only admin or manager can create reviews"), 403

    d = request.get_json(silent=True) or {}
    emp_id = d.get("employeeId")
    if not emp_id:
        return jsonify(error="employeeId is required"), 400

    if user["role"] == "manager" and not _is_manager_of(user["employee_id"], int(emp_id)):
        return jsonify(error="You can only review your direct reports"), 403

    cycle_id = d.get("reviewCycleId") or None
    cycle_name = d.get("reviewCycle") or None

    # Auto-populate cycle name from cycle table if cycle_id provided
    if cycle_id and not cycle_name:
        cyc = query("SELECT name FROM review_cycles WHERE id=%s", (cycle_id,), fetch="one")
        if cyc:
            cycle_name = cyc["name"]

    rid = execute(
        """INSERT INTO performance_reviews
           (employee_id, reviewer_id, review_cycle_id, review_cycle, period, status,
            final_score, badge, review_date, notes)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (emp_id, user.get("employee_id"), cycle_id, cycle_name,
         d.get("period") or None, d.get("status", "pending"),
         float(d["finalScore"]) if d.get("finalScore") else None,
         d.get("badge") or None,
         d.get("reviewDate") or None,
         d.get("notes") or None)
    )
    row = query(REV_SELECT + " AND pr.id=%s", (rid,), fetch="one")
    return jsonify(_fmt_dates(row)), 201


@performance_bp.route("/reviews/<int:rid>", methods=["PUT"])
@jwt_required()
def update_review(rid):
    user = _user()
    row = query("SELECT * FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    if user["role"] == "employee":
        return jsonify(error="Forbidden"), 403
    if user["role"] == "manager" and not _is_manager_of(user["employee_id"], row["employee_id"]):
        return jsonify(error="Forbidden"), 403

    d = request.get_json(silent=True) or {}
    cycle_id = d.get("reviewCycleId") or row["review_cycle_id"]
    cycle_name = d.get("reviewCycle") or row["review_cycle"]
    if cycle_id and not d.get("reviewCycle"):
        cyc = query("SELECT name FROM review_cycles WHERE id=%s", (cycle_id,), fetch="one")
        if cyc:
            cycle_name = cyc["name"]

    execute(
        """UPDATE performance_reviews SET review_cycle_id=%s, review_cycle=%s, period=%s,
           status=%s, final_score=%s, badge=%s, review_date=%s, notes=%s WHERE id=%s""",
        (cycle_id, cycle_name, d.get("period") or row["period"],
         d.get("status", row["status"]),
         float(d["finalScore"]) if d.get("finalScore") else row["final_score"],
         d.get("badge") or row["badge"],
         d.get("reviewDate") or row["review_date"],
         d.get("notes") or row["notes"], rid)
    )
    row = query(REV_SELECT + " AND pr.id=%s", (rid,), fetch="one")
    return jsonify(_fmt_dates(row)), 200


@performance_bp.route("/reviews/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_review(rid):
    user = _user()
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403
    row = query("SELECT * FROM performance_reviews WHERE id=%s", (rid,), fetch="one")
    if not row:
        return jsonify(error="Not found"), 404
    if user["role"] == "manager" and not _is_manager_of(user["employee_id"], row["employee_id"]):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM performance_reviews WHERE id=%s", (rid,))
    return jsonify(deleted=True), 200


# ════════════════════════════════════════════════
# HELPER — manager's assigned employees list
# ════════════════════════════════════════════════
@performance_bp.route("/my-reports/", methods=["GET"])
@jwt_required()
def my_reports():
    """Returns list of employees assigned to the current manager."""
    user = _user()
    if user["role"] == "employee":
        return jsonify([]), 200
    if user["role"] == "manager":
        rows = query(
            "SELECT id, name, COALESCE(g.color,'#6366F1') AS group_color FROM employees e LEFT JOIN `groups` g ON g.id=e.group_id WHERE e.manager_id=%s ORDER BY e.name",
            (user["employee_id"],)
        )
    else:  # admin sees all
        rows = query("SELECT id, name, COALESCE(g.color,'#6366F1') AS group_color FROM employees e LEFT JOIN `groups` g ON g.id=e.group_id ORDER BY e.name")
    return jsonify(rows), 200
