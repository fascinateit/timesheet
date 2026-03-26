"""mailer.py – Send email via Microsoft Graph API (app-only auth)."""
import os
import json
import requests

TENANT_ID     = os.environ.get("MAIL_TENANT_ID", "ec822022-88bd-47c3-bb56-fa921ec6656e")
CLIENT_ID     = os.environ.get("MAIL_CLIENT_ID",  "ee67cd24-43fd-4a1c-98f6-82710b2a4d32")
CLIENT_SECRET = os.environ.get("MAIL_CLIENT_SECRET", "XhR8Q~pLia-mywTDg-3wzFRmcb7ojaphQ9gSSb-f")
MAIL_FROM     = "yourbuddy@fascinateit.com"
MAIL_TO_RAW   = os.environ.get("MAIL_RECIPIENTS", "sandeepkumar.md@fascinateit.com,naveen.kumar@fascinateit.com,madhu.bk@fascinateit.com")   # comma-separated

TOKEN_URL  = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
GRAPH_BASE = "https://graph.microsoft.com/v1.0"


def _get_token() -> str:
    resp = requests.post(TOKEN_URL, data={
        "grant_type":    "client_credentials",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "https://graph.microsoft.com/.default",
    }, timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"]


def send_html_email(subject: str, html_body: str, recipients: list[str] | None = None):
    """
    Send an HTML email from MAIL_FROM via Graph API.
    recipients: list of email strings; defaults to MAIL_RECIPIENTS env var.
    """
    if not CLIENT_SECRET:
        raise ValueError("MAIL_CLIENT_SECRET env var is not set.")

    to_list = recipients or [r.strip() for r in MAIL_TO_RAW.split(",") if r.strip()]
    if not to_list:
        raise ValueError("No recipients configured. Set MAIL_RECIPIENTS env var.")

    token = _get_token()
    payload = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": html_body,
            },
            "toRecipients": [
                {"emailAddress": {"address": addr}} for addr in to_list
            ],
        },
        "saveToSentItems": "true",
    }
    url = f"{GRAPH_BASE}/users/{MAIL_FROM}/sendMail"
    r = requests.post(url, json=payload,
                      headers={"Authorization": f"Bearer {token}",
                               "Content-Type": "application/json"},
                      timeout=30)
    r.raise_for_status()
    return True
