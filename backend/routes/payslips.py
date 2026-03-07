"""routes/payslips.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

payslips_bp = Blueprint("payslips", __name__)


def _compute(ctc, bonus=0, extra_deductions=0, special_override=None):
    gross       = round(ctc / 12, 2)
    basic       = round(gross * 0.40, 2)
    hra         = round(basic * 0.50, 2)
    transport   = 1600.00
    # Always auto-compute the base special allowance first
    special = max(0, round(gross - basic - hra - transport, 2))
    # If override is provided, add it to the auto-computed base
    if special_override is not None and float(special_override) >= 0:
        special = round(special + float(special_override), 2)
    bonus       = round(float(bonus or 0), 2)
    extra_ded   = round(float(extra_deductions or 0), 2)
    pf_emp      = round(basic * 0.12, 2)
    prof_tax    = 200.00
    # Gross includes all allowances and bonus; net = gross - deductions
    gross_total = round(basic + hra + transport + special + bonus, 2)
    net_pay     = round(gross_total - pf_emp - prof_tax - extra_ded, 2)
    return dict(
        gross=gross_total, basic=basic, hra=hra, transport=transport,
        special_allowance=special, bonus=bonus,
        pf_employee=pf_emp, professional_tax=prof_tax,
        extra_deductions=extra_ded, net_pay=net_pay
    )


def _fmt(row):
    if row and row.get("generated_at") and hasattr(row["generated_at"], "isoformat"):
        row["generated_at"] = row["generated_at"].isoformat()
    return row


SLIP_SELECT = """
    SELECT ps.*, e.name AS employee_name, e.avatar, e.email,
           g.name AS group_name, g.color AS group_color
    FROM   payslips ps
    JOIN   employees e ON e.id = ps.employee_id
    LEFT JOIN `groups` g ON g.id = e.group_id
    WHERE  1=1
"""


@payslips_bp.route("/", methods=["GET"])
@jwt_required()
def list_payslips():
    user   = json.loads(get_jwt_identity())
    emp_id = request.args.get("employee_id")
    month  = request.args.get("month")
    year   = request.args.get("year")

    sql  = SLIP_SELECT
    args = []

    if user["role"] in ("employee", "manager"):
        sql += " AND ps.employee_id = %s"; args.append(user["employee_id"])
    elif emp_id:
        sql += " AND ps.employee_id = %s"; args.append(emp_id)

    if month: sql += " AND ps.month = %s";  args.append(int(month))
    if year:  sql += " AND ps.year  = %s";  args.append(int(year))

    sql += " ORDER BY ps.year DESC, ps.month DESC"
    return jsonify([_fmt(r) for r in query(sql, args)]), 200


@payslips_bp.route("/generate", methods=["POST"])
@jwt_required()
def generate_payslip():
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Only admin or manager can generate payslips"), 403

    d       = request.get_json(silent=True) or {}
    emp_id  = d.get("employeeId")
    month   = d.get("month")
    year    = d.get("year")

    if not all([emp_id, month, year]):
        return jsonify(error="employeeId, month and year are required"), 400

    emp = query(
        "SELECT e.*, g.name AS group_name, g.color AS group_color "
        "FROM employees e LEFT JOIN `groups` g ON g.id=e.group_id WHERE e.id=%s",
        (emp_id,), fetch="one"
    )
    if not emp:
        return jsonify(error="Employee not found"), 404

    ctc = float(emp.get("ctc_annual") or 0)
    if ctc <= 0:
        return jsonify(error="Employee has no CTC configured. Set CTC first."), 400

    slip = _compute(
        ctc,
        bonus=d.get("bonus", 0),
        extra_deductions=d.get("extraDeductions", 0),
        special_override=d.get("specialAllowance") if d.get("specialAllowance") != "" else None,
    )

    existing = query(
        "SELECT id FROM payslips WHERE employee_id=%s AND month=%s AND year=%s",
        (emp_id, month, year), fetch="one"
    )
    if existing:
        execute(
            """UPDATE payslips SET gross=%s,basic=%s,hra=%s,transport=%s,
               special_allowance=%s,bonus=%s,pf_employee=%s,professional_tax=%s,
               extra_deductions=%s,net_pay=%s,generated_at=NOW() WHERE id=%s""",
            (slip["gross"], slip["basic"], slip["hra"], slip["transport"],
             slip["special_allowance"], slip["bonus"], slip["pf_employee"],
             slip["professional_tax"], slip["extra_deductions"], slip["net_pay"],
             existing["id"])
        )
        psid = existing["id"]
    else:
        psid = execute(
            """INSERT INTO payslips
               (employee_id,month,year,gross,basic,hra,transport,special_allowance,
                bonus,pf_employee,professional_tax,extra_deductions,net_pay)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (emp_id, month, year, slip["gross"], slip["basic"], slip["hra"],
             slip["transport"], slip["special_allowance"], slip["bonus"],
             slip["pf_employee"], slip["professional_tax"], slip["extra_deductions"],
             slip["net_pay"])
        )

    row = query(SLIP_SELECT + " AND ps.id=%s", (psid,), fetch="one")
    return jsonify(_fmt(row)), 201


@payslips_bp.route("/<int:psid>", methods=["DELETE"])
@jwt_required()
def delete_payslip(psid):
    user = json.loads(get_jwt_identity())
    if user["role"] not in ("admin", "manager"):
        return jsonify(error="Forbidden"), 403
    execute("DELETE FROM payslips WHERE id=%s", (psid,))
    return jsonify(deleted=True), 200
