"""routes/payslips.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

payslips_bp = Blueprint("payslips", __name__)


def _compute(ctc, variable_pay_annual=0, 
             use_pf=False, pf_override=None, 
             use_tds=False, tds_override=None, 
             use_vp=False, vp_override=None):
    fixed_ctc   = ctc - variable_pay_annual
    gross       = round(fixed_ctc / 12, 2)
    
    basic       = round(gross * 0.45, 2)
    hra         = round(basic * 0.40, 2)
    lta         = round(basic * 0.15, 2)
    
    transport   = 1600.00
    medical     = 1250.00
    internet    = 1200.00
    
    # special acts as the balancer
    special     = max(0, round(gross - basic - hra - lta - transport - medical - internet, 2))
    
    vp_monthly  = 0.00
    if use_vp:
        vp_monthly = round(float(vp_override) if vp_override is not None and str(vp_override).strip() != "" else (variable_pay_annual / 12), 2)
        
    pf_emp      = 0.00
    if use_pf:
        pf_emp = round(float(pf_override) if pf_override is not None and str(pf_override).strip() != "" else (basic * 0.12), 2)
        
    income_tax  = 0.00
    if use_tds:
        income_tax = round(float(tds_override) if tds_override is not None and str(tds_override).strip() != "" else 0, 2)
        
    prof_tax    = 200.00
    
    gross_total = round(basic + hra + lta + special + transport + medical + internet + vp_monthly, 2)
    net_pay     = round(gross_total - pf_emp - prof_tax - income_tax, 2)
    
    return dict(
        gross=gross_total, basic=basic, hra=hra, 
        lta=lta, transport=transport, medical=medical, internet=internet,
        special_allowance=special, variable_pay=vp_monthly,
        pf_employee=pf_emp, professional_tax=prof_tax, income_tax=income_tax,
        net_pay=net_pay
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
        ctc=ctc,
        variable_pay_annual=float(emp.get("variable_pay_amount") or 0),
        use_pf=d.get("usePf", False),
        pf_override=d.get("pfAmount"),
        use_tds=d.get("useTds", False),
        tds_override=d.get("tdsAmount"),
        use_vp=d.get("useVp", False),
        vp_override=d.get("vpAmount")
    )

    existing = query(
        "SELECT id FROM payslips WHERE employee_id=%s AND month=%s AND year=%s",
        (emp_id, month, year), fetch="one"
    )
    if existing:
        execute(
            """UPDATE payslips SET gross=%s,basic=%s,hra=%s,transport=%s,
               leave_travel_allowance=%s,medical_allowance=%s,internet_allowance=%s,
               special_allowance=%s,variable_pay=%s,pf_employee=%s,professional_tax=%s,
               income_tax=%s,net_pay=%s,generated_at=NOW() WHERE id=%s""",
            (slip["gross"], slip["basic"], slip["hra"], slip["transport"],
             slip["lta"], slip["medical"], slip["internet"],
             slip["special_allowance"], slip["variable_pay"], slip["pf_employee"],
             slip["professional_tax"], slip["income_tax"], slip["net_pay"],
             existing["id"])
        )
        psid = existing["id"]
    else:
        psid = execute(
            """INSERT INTO payslips
               (employee_id,month,year,gross,basic,hra,transport,
                leave_travel_allowance,medical_allowance,internet_allowance,
                special_allowance,variable_pay,pf_employee,professional_tax,
                income_tax,net_pay)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (emp_id, month, year, slip["gross"], slip["basic"], slip["hra"], slip["transport"],
             slip["lta"], slip["medical"], slip["internet"],
             slip["special_allowance"], slip["variable_pay"], slip["pf_employee"], 
             slip["professional_tax"], slip["income_tax"], slip["net_pay"])
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
