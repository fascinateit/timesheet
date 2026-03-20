"""routes/payslips.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

payslips_bp = Blueprint("payslips", __name__)


def _compute(ctc, variable_pay_annual=0,
             use_pf=False, pf_override=None,
             use_tds=False, tds_override=None,
             use_vp=False, vp_override=None,
             use_pda=False, pda_override=None,
             use_ins=False, ins_override=None,
             conveyance_override=None, medical_override=None, internet_override=None):
    fixed_ctc   = ctc
    gross       = round(fixed_ctc / 12, 2)
    variable_pay_monthly = round(variable_pay_annual / 12, 2)
    basic       = round(gross * 0.50, 2)
    hra         = round(basic * 0.50, 2)
    lta         = round(basic * 0.10, 2)

    def _fixed(override, default):
        if override is not None and str(override).strip() != "":
            return round(float(override), 2)
        return default

    transport = _fixed(conveyance_override, 1600.00)
    medical   = _fixed(medical_override,    1250.00)
    internet  = _fixed(internet_override,   1200.00)

    vp_monthly  = 0.00
    if use_vp:
        vp_monthly = round(float(vp_override) if vp_override is not None and str(vp_override).strip() != "" else (gross * 0.05), 2)


    pda = 0.00
    if use_pda:
        pda = round(float(pda_override) if pda_override is not None and str(pda_override).strip() != "" else 0, 2)

    ins = 0.00
    if use_ins:
        ins = round(float(ins_override) if ins_override is not None and str(ins_override).strip() != "" else 0, 2)

    # Special Allowance = MAX(Gross − components, Gross × 10%)
    gratuity_contribution = round(basic * 0.0481, 2)

    remaining     = gross - basic - hra - lta - transport - medical - internet
    default_vp    = variable_pay_monthly if vp_monthly == 0.00 else vp_monthly
    floor_special = round(gross * 0.10, 2)
    special       = max(floor_special, round(remaining - gratuity_contribution - default_vp - pda - ins, 2))
    pf_emp      = 0.00
    if use_pf:
        pf_emp = round(float(pf_override) if pf_override is not None and str(pf_override).strip() != "" else (basic * 0.12), 2)

    income_tax  = 0.00
    if use_tds:
        income_tax = round(float(tds_override) if tds_override is not None and str(tds_override).strip() != "" else 0, 2)

    gross_total = round(basic + hra + lta + special + transport + medical + internet + vp_monthly + pda + ins, 2)
    pre_net     = gross_total - pf_emp - income_tax
    prof_tax    = 0.00 if pre_net < 25000 else 200.00
    net_pay     = round(pre_net - prof_tax, 2)

    return dict(
        gross=gross_total, basic=basic, hra=hra,
        lta=lta, transport=transport, medical=medical, internet=internet,
        special_allowance=special, variable_pay=vp_monthly,
        professional_dev_allowance=pda, insurance_allowance=ins,
        pf_employee=pf_emp, professional_tax=prof_tax, income_tax=income_tax,
        net_pay=net_pay
    )


def _fmt(row):
    if row and row.get("generated_at") and hasattr(row["generated_at"], "isoformat"):
        row["generated_at"] = row["generated_at"].isoformat()
    if row and row.get("joining_date") and hasattr(row["joining_date"], "isoformat"):
        row["joining_date"] = row["joining_date"].isoformat()
    return row


SLIP_SELECT = """
    SELECT ps.*, e.name AS employee_name, e.avatar, e.email,
           e.joining_date, e.pan_number, e.bank_name, e.bank_account_no,
           e.designation, e.location,
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
        vp_override=d.get("vpAmount"),
        use_pda=d.get("usePda", False),
        pda_override=d.get("pdaAmount"),
        use_ins=d.get("useIns", False),
        ins_override=d.get("insAmount"),
        conveyance_override=d.get("conveyanceAmount"),
        medical_override=d.get("medicalAmount"),
        internet_override=d.get("internetAmount"),
    )

    gratuity_increment = round(slip["basic"] * 0.0481, 2)

    existing = query(
        "SELECT id FROM payslips WHERE employee_id=%s AND month=%s AND year=%s",
        (emp_id, month, year), fetch="one"
    )
    if existing:
        execute(
            """UPDATE payslips SET gross=%s,basic=%s,hra=%s,transport=%s,
               leave_travel_allowance=%s,medical_allowance=%s,internet_allowance=%s,
               professional_dev_allowance=%s,insurance_allowance=%s,
               special_allowance=%s,variable_pay=%s,pf_employee=%s,professional_tax=%s,
               income_tax=%s,net_pay=%s,generated_at=NOW() WHERE id=%s""",
            (slip["gross"], slip["basic"], slip["hra"], slip["transport"],
             slip["lta"], slip["medical"], slip["internet"],
             slip["professional_dev_allowance"], slip["insurance_allowance"],
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
                professional_dev_allowance,insurance_allowance,
                special_allowance,variable_pay,pf_employee,professional_tax,
                income_tax,net_pay)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (emp_id, month, year, slip["gross"], slip["basic"], slip["hra"], slip["transport"],
             slip["lta"], slip["medical"], slip["internet"],
             slip["professional_dev_allowance"], slip["insurance_allowance"],
             slip["special_allowance"], slip["variable_pay"], slip["pf_employee"],
             slip["professional_tax"], slip["income_tax"], slip["net_pay"])
        )
        # Accumulate gratuity (4.81% of Basic) only when a new payslip month is created
        execute(
            "UPDATE employees SET gratuity = gratuity + %s WHERE id=%s",
            (gratuity_increment, emp_id)
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
