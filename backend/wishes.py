"""wishes.py – Detect today's employee birthdays & work anniversaries and email a wish.

Run daily (see run_scheduler.py). Sends one combined email to the fixed
notification list below whenever an employee's date of birth or joining date
matches today's month/day.
"""
import os
from datetime import date
from db import query
from mailer import send_html_email

WISH_RECIPIENTS = [
    r.strip() for r in os.environ.get(
        "WISH_RECIPIENTS",
        "naveen.kumar@fascinateit.com,madhu.bk@fascinateit.com,sandeepkumar.md@fascinateit.com",
    ).split(",") if r.strip()
]


# ── data fetchers ─────────────────────────────────────────────────────────────

def _todays_birthdays():
    return query(
        """
        SELECT id, name, email, designation
        FROM   employees
        WHERE  dob IS NOT NULL
          AND  MONTH(dob) = MONTH(CURDATE())
          AND  DAY(dob)   = DAY(CURDATE())
        """,
        fetch="all",
    ) or []


def _todays_anniversaries():
    rows = query(
        """
        SELECT id, name, email, designation, joining_date
        FROM   employees
        WHERE  joining_date IS NOT NULL
          AND  MONTH(joining_date) = MONTH(CURDATE())
          AND  DAY(joining_date)   = DAY(CURDATE())
        """,
        fetch="all",
    ) or []

    today = date.today()
    out = []
    for r in rows:
        jd = r["joining_date"]
        r["years"] = today.year - jd.year
        out.append(r)
    return out


# ── HTML template ──────────────────────────────────────────────────────────────

def _wish_card(title, color, emoji, people_rows, subtitle):
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto 20px;background:#f4f4f4;padding:0">
      <div style="background:linear-gradient(135deg,{color},{color}cc);border-radius:12px 12px 0 0;padding:26px 24px;text-align:center">
        <div style="font-size:38px;line-height:1">{emoji}</div>
        <h2 style="margin:8px 0 0;color:#ffffff;font-size:20px">{title}</h2>
        <p style="margin:6px 0 0;color:#ffffffcc;font-size:13px">{subtitle}</p>
      </div>
      <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:20px 24px;border:1px solid #e0e0e0">
        {people_rows}
      </div>
    </div>"""


def _person_row(emoji, name, note=""):
    return f"""
    <div style="display:flex;align-items:center;gap:12px;padding:12px 4px;border-bottom:1px solid #f1f1f1">
      <span style="font-size:22px">{emoji}</span>
      <div>
        <div style="font-size:15px;font-weight:700;color:#1e2a3a">{name}</div>
        {f'<div style="font-size:12px;color:#777;margin-top:2px">{note}</div>' if note else ''}
      </div>
    </div>"""


def build_wishes_html(birthdays, anniversaries):
    sections = ""
    if birthdays:
        rows = "".join(_person_row("🎂", b["name"], b.get("designation") or "") for b in birthdays)
        sections += _wish_card(
            "Happy Birthday!", "#ec4899", "🎉", rows,
            "Wishing you a wonderful day filled with happiness!"
        )
    if anniversaries:
        rows = "".join(
            _person_row(
                "🏆", a["name"],
                f"Completing {a['years']} year{'s' if a['years'] != 1 else ''} with us" if a["years"] > 0
                else "Joining us today — welcome aboard!"
            )
            for a in anniversaries
        )
        sections += _wish_card(
            "Happy Work Anniversary!", "#f59e0b", "🎊", rows,
            "Thank you for your continued dedication and hard work!"
        )
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;background:#f0f2f5;padding:20px 0">
  {sections}
  <p style="text-align:center;font-size:11px;color:#999;margin-top:4px">My Portal · Fascinate IT</p>
</body>
</html>"""


# ── main entrypoint ───────────────────────────────────────────────────────────

def send_wishes():
    """Build and send today's birthday/anniversary wishes. No-op if there's nothing to celebrate."""
    birthdays = _todays_birthdays()
    anniversaries = _todays_anniversaries()
    if not birthdays and not anniversaries:
        print(f"[wishes] Nothing to celebrate on {date.today().isoformat()}")
        return

    labels = []
    if birthdays: labels.append("Birthday")
    if anniversaries: labels.append("Work Anniversary")
    subject = f"🎉 {' & '.join(labels)} Wishes – {date.today().strftime('%d %b %Y')}"

    html = build_wishes_html(birthdays, anniversaries)
    try:
        send_html_email(subject, html, WISH_RECIPIENTS)
        print(f"[wishes] Sent: {len(birthdays)} birthday(s), {len(anniversaries)} anniversary(ies)")
    except Exception as e:
        print(f"[wishes] ERROR: {e}")
        raise


if __name__ == "__main__":
    # Allow running as a standalone script: python wishes.py
    import dotenv
    dotenv.load_dotenv()
    send_wishes()
