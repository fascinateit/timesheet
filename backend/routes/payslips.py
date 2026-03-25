"""routes/payslips.py"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from db import query, execute
import json

payslips_bp = Blueprint("payslips", __name__)


def _compute(ctc,variable_pay_annual=0,
             use_pf=False, pf_override=None,
             use_tds=False, tds_override=None,
             use_vp=False, vp_override=None,
             use_pda=False, pda_override=None,
             use_ins=False, ins_override=None,
             conveyance_override=None, medical_override=None, internet_override=None):
    """
    Compute payslip figures — algorithm matches CompensationDetails exactly:
      basic      = 50% of annual CTC / 12
      gratuity_a = basic_annual × 4.81%
      vp_a       = 5% of CTC (default) or override × 12
      gross_m    = (CTC − gratuity_a − vp_a) / 12   ← reduced pool
      special    = gross_m − basic − hra − lta − fixed  ← pure remainder, no floor
    """
    def _r(n): return round(n, 2)
    def _fixed(override, default):
        if override is not None and str(override).strip() != "":
            return _r(float(override))
        return default

    basic_m   = _r(ctc * 0.50 / 12)
    hra_m     = _r(basic_m * 0.50)
    lta_m     = _r(basic_m * 0.10)
    transport = _fixed(conveyance_override, 1600.00)
    medical   = _fixed(medical_override,    1250.00)
    internet  = _fixed(internet_override,   1200.00)
    pda_m     = _r(float(pda_override)) if use_pda and pda_override and str(pda_override).strip() else 0.00
    ins_m     = _r(float(ins_override))  if use_ins  and ins_override  and str(ins_override).strip()  else 0.00

    # Annual components deducted from CTC (same logic as CompensationDetails)
    gratuity_a = _r(basic_m * 12 * 0.0481)

    # Variable Pay — vp_override from the payslip form is a monthly amount
    vp_a = 0.00
    vp_m = 0.00
    if use_vp:
        if vp_override is not None and str(vp_override).strip() != "":
            vp_m = _r(float(vp_override))   # monthly override entered in form
            vp_a = _r(vp_m * 12)
        # else:
        #     vp_a = _r(ctc * 0.05)           # default: 5% of annual CTC
        #     vp_m = _r(vp_a / 12)

    # Monthly gross pool = CTC minus gratuity only — VP is NOT deducted, it is purely additive
    gross_m = _r((ctc - gratuity_a - variable_pay_annual) / 12)

    # Special Allowance = remaining balance after fixed components (VP excluded — added on top)
    special_m = _r(gross_m - basic_m - hra_m - lta_m - transport - medical - internet - pda_m - ins_m)

    # Payslip gross = fixed gross + VP (VP is additive, increases total take-home)
    gross_total = _r(gross_m + vp_m)

    # Deductions
    pf_emp = 0.00
    if use_pf:
        pf_emp = _r(float(pf_override)) if pf_override and str(pf_override).strip() else _r(basic_m * 0.12)

    income_tax = 0.00
    if use_tds:
        income_tax = _r(float(tds_override)) if tds_override and str(tds_override).strip() else 0.00

    pre_net  = _r(gross_total - pf_emp - income_tax)
    prof_tax = 0.00 if pre_net < 25000 else 200.00
    net_pay  = _r(pre_net - prof_tax)

    return dict(
        gross=gross_total, basic=basic_m, hra=hra_m,
        lta=lta_m, transport=transport, medical=medical, internet=internet,
        special_allowance=special_m, variable_pay=vp_m,
        professional_dev_allowance=pda_m, insurance_allowance=ins_m,
        pf_employee=pf_emp, professional_tax=prof_tax, income_tax=income_tax,
        net_pay=net_pay, gratuity_contribution=_r(basic_m * 0.0481)
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

    gratuity_increment = slip["gratuity_contribution"]

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
