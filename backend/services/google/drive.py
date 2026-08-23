"""Google Drive Academic Auto-Cataloging Engine."""

import json
import logging
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"


def _get_or_create_folder(access_token: str, folder_name: str, parent_id: Optional[str] = None) -> str:
    """Find existing folder by name or create a new one."""
    if access_token.startswith("sandbox_access_token_"):
        return f"sandbox_folder_{folder_name.replace(' ', '_')}"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # Query for existing folder
    q = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    if parent_id:
        q += f" and '{parent_id}' in parents"
    else:
        q += " and 'root' in parents"

    resp = requests.get(f"{DRIVE_API_BASE}/files", headers=headers, params={"q": q, "fields": "files(id, name)"}, timeout=10)
    if resp.status_code == 200:
        files = resp.json().get("files", [])
        if files:
            return files[0]["id"]

    # Create folder
    body: Dict[str, Any] = {
        "name": folder_name,
        "mimeType": "application/vnd.google-apps.folder",
    }
    if parent_id:
        body["parents"] = [parent_id]

    create_resp = requests.post(f"{DRIVE_API_BASE}/files", headers=headers, json=body, timeout=10)
    if create_resp.status_code in (200, 201):
        return create_resp.json()["id"]

    raise RuntimeError(f"Failed to create Google Drive folder '{folder_name}': {create_resp.text}")


def get_or_create_course_folder(access_token: str, year: int, course_code: str) -> Dict[str, str]:
    """
    Ensure the course folder hierarchy exists:
    ATLAS-Academics/Year-{year}/{course_code}/
    """
    if access_token.startswith("sandbox_access_token_"):
        return {
            "root_id": "sandbox_root_id",
            "year_id": f"sandbox_year_{year}_id",
            "course_id": f"sandbox_{course_code}_id",
            "path": f"ATLAS-Academics/Year-{year}/{course_code}",
        }

    root_id = _get_or_create_folder(access_token, "ATLAS-Academics")
    year_id = _get_or_create_folder(access_token, f"Year-{year}", parent_id=root_id)
    course_id = _get_or_create_folder(access_token, course_code.upper().strip(), parent_id=year_id)

    return {
        "root_id": root_id,
        "year_id": year_id,
        "course_id": course_id,
        "path": f"ATLAS-Academics/Year-{year}/{course_code.upper().strip()}",
    }


def export_resource_to_google_drive(
    access_token: str,
    resource_title: str,
    resource_url: str,
    course_code: str,
    year: int = 2026,
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Save or link an academic resource into the student's designated course folder in Google Drive.
    """
    folder_info = get_or_create_course_folder(access_token, year, course_code)
    course_folder_id = folder_info["course_id"]
    folder_path = folder_info["path"]

    if access_token.startswith("sandbox_access_token_"):
        return {
            "file_id": f"drive_demo_file_{course_code.lower()}_1",
            "name": f"{resource_title}.url",
            "web_view_link": f"https://drive.google.com/file/d/demo_{course_code.lower()}/view",
            "folder_path": folder_path,
            "course_code": course_code,
            "status": "success",
            "message": f"Successfully exported '{resource_title}' to Google Drive under {folder_path}",
        }

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # Create a bookmark / internet shortcut file inside the Drive course folder
    shortcut_content = f"[InternetShortcut]\nURL={resource_url}\nDescription={description or resource_title}\n"
    metadata = {
        "name": f"{resource_title}.url",
        "parents": [course_folder_id],
        "description": description or f"Resource link for {course_code} from ATLAS Platform",
    }

    # Multipart upload
    boundary = "-------314159265358979323846"
    delimiter = f"\r\n--{boundary}\r\n"
    close_delim = f"\r\n--{boundary}--"

    multipart_body = (
        delimiter
        + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
        + json.dumps(metadata)
        + delimiter
        + "Content-Type: text/plain\r\n\r\n"
        + shortcut_content
        + close_delim
    )

    upload_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": f"multipart/related; boundary={boundary}",
    }

    resp = requests.post(
        f"{DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,webViewLink",
        headers=upload_headers,
        data=multipart_body.encode("utf-8"),
        timeout=15,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        return {
            "file_id": data.get("id"),
            "name": data.get("name"),
            "web_view_link": data.get("webViewLink", f"https://drive.google.com/file/d/{data.get('id')}/view"),
            "folder_path": folder_path,
            "course_code": course_code,
            "status": "success",
            "message": f"Successfully saved to {folder_path}",
        }

    logger.error(f"[Google Drive] File upload failed: {resp.text}")
    raise RuntimeError(f"Failed to export resource to Google Drive: {resp.text}")
