"""sharepoint.py – Microsoft Graph API helper for SharePoint file operations."""
import os
import requests

TENANT_ID    = os.environ.get("SP_TENANT_ID", "")
CLIENT_ID    = os.environ.get("SP_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("SP_CLIENT_SECRET", "")
SITE_ID      = os.environ.get("SP_SITE_ID", "")        # e.g. "contoso.sharepoint.com,<guid1>,<guid2>"
DRIVE_ID     = os.environ.get("SP_DRIVE_ID", "")       # document library drive id
BASE_FOLDER  = os.environ.get("SP_BASE_FOLDER", "Onboarding")  # root folder inside the library

GRAPH_BASE   = "https://graph.microsoft.com/v1.0"
TOKEN_URL    = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"


def _get_token() -> str:
    """Obtain an app-only access token via client credentials flow."""
    resp = requests.post(TOKEN_URL, data={
        "grant_type":    "client_credentials",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "https://graph.microsoft.com/.default",
    }, timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"]


def _headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/octet-stream"}


def ensure_folder(folder_name: str) -> str:
    """
    Create BASE_FOLDER/folder_name in the SharePoint drive if it doesn't exist.
    Returns the SharePoint web URL of the folder.
    """
    token = _get_token()
    auth  = {"Authorization": f"Bearer {token}"}

    # Ensure the base folder exists first
    _ensure_single_folder(token, auth, "root", BASE_FOLDER)

    # Ensure the employee sub-folder exists
    _ensure_single_folder(token, auth, f"root:/{BASE_FOLDER}:", folder_name)

    # Fetch folder metadata to get its web URL
    url = f"{GRAPH_BASE}/sites/{SITE_ID}/drives/{DRIVE_ID}/root:/{BASE_FOLDER}/{folder_name}"
    r = requests.get(url, headers=auth, timeout=15)
    r.raise_for_status()
    return r.json().get("webUrl", "")


def _ensure_single_folder(token: str, auth: dict, parent_ref: str, name: str):
    """Create a child folder inside parent_ref if it doesn't exist."""
    url = f"{GRAPH_BASE}/sites/{SITE_ID}/drives/{DRIVE_ID}/{parent_ref}/children"
    payload = {
        "name": name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail"
    }
    r = requests.post(url, json=payload,
                      headers={**auth, "Content-Type": "application/json"}, timeout=15)
    # 409 Conflict means folder already exists – that's fine
    if r.status_code not in (201, 409):
        r.raise_for_status()


def upload_file(folder_name: str, filename: str, file_bytes: bytes, content_type: str = "application/octet-stream") -> str:
    """
    Upload file_bytes to BASE_FOLDER/folder_name/filename via Graph API.
    Returns the SharePoint download/webUrl of the uploaded file.
    """
    token = _get_token()
    safe_name = filename.replace("/", "_").replace("\\", "_")
    url = (
        f"{GRAPH_BASE}/sites/{SITE_ID}/drives/{DRIVE_ID}"
        f"/root:/{BASE_FOLDER}/{folder_name}/{safe_name}:/content"
    )
    r = requests.put(url, data=file_bytes,
                     headers={"Authorization": f"Bearer {token}", "Content-Type": content_type},
                     timeout=60)
    r.raise_for_status()
    data = r.json()
    return data.get("webUrl") or data.get("@microsoft.graph.downloadUrl", "")


def delete_file(folder_name: str, filename: str):
    """Delete a file from SharePoint (best-effort, ignores 404)."""
    token = _get_token()
    safe_name = filename.replace("/", "_").replace("\\", "_")
    url = (
        f"{GRAPH_BASE}/sites/{SITE_ID}/drives/{DRIVE_ID}"
        f"/root:/{BASE_FOLDER}/{folder_name}/{safe_name}:/content"
    )
    try:
        r = requests.delete(url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
        if r.status_code not in (204, 404):
            r.raise_for_status()
    except Exception:
        pass


def is_configured() -> bool:
    """Return True when all required SharePoint env vars are set."""
    return all([TENANT_ID, CLIENT_ID, CLIENT_SECRET, SITE_ID, DRIVE_ID])
