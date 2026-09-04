"""Google Drive Academic Auto-Cataloging & Live Explorer Engine."""

import json
import logging
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime
import requests

logger = logging.getLogger(__name__)

DRIVE_API_BASE = "https://www.googleapis.com/drive/v3"
DRIVE_UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3"


_SANDBOX_FOLDERS: List[Dict[str, Any]] = [
    {"id": "sb_2026", "name": "2026", "parent_id": "sandbox_root", "mimeType": "application/vnd.google-apps.folder", "is_folder": True},
    {"id": "sandbox_Courses", "name": "Courses", "parent_id": "sb_2026", "mimeType": "application/vnd.google-apps.folder", "is_folder": True},
    {"id": "sandbox_Extracurricular", "name": "Extracurricular", "parent_id": "sb_2026", "mimeType": "application/vnd.google-apps.folder", "is_folder": True},
]


def _get_or_create_folder(access_token: str, folder_name: str, parent_id: Optional[str] = None) -> str:
    """Find existing folder by name or create a new one."""
    if access_token.startswith("sandbox_access_token_"):
        effective_parent = parent_id or "sandbox_root"
        for f in _SANDBOX_FOLDERS:
            if f.get("name") == folder_name and f.get("parent_id") == effective_parent:
                return f["id"]
        folder_id = f"sandbox_folder_{folder_name.replace(' ', '_')}_{uuid.uuid4().hex[:6]}"
        new_folder = {
            "id": folder_id,
            "name": folder_name,
            "parent_id": effective_parent,
            "mimeType": "application/vnd.google-apps.folder",
            "is_folder": True,
        }
        _SANDBOX_FOLDERS.append(new_folder)
        return folder_id

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }

    # Query for existing folder
    safe_name = folder_name.replace("'", "\\'")
    q = f"name = '{safe_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
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


def get_or_create_nested_folder_path(
    access_token: str,
    folder_path: str,
    parent_id: Optional[str] = None,
) -> str:
    """
    Ensure a nested folder hierarchy exists under parent_id in Google Drive.
    folder_path can be 'FolderA/FolderB' or 'FolderA'.
    Returns the leaf folder ID.
    """
    if not folder_path:
        return parent_id or _get_or_create_folder(access_token, "ATLAS-Academics")

    clean_path = folder_path.replace("\\", "/").strip("/")
    parts = [p.strip() for p in clean_path.split("/") if p.strip()]
    if not parts:
        return parent_id or _get_or_create_folder(access_token, "ATLAS-Academics")

    curr_parent = parent_id or _get_or_create_folder(access_token, "ATLAS-Academics")
    for folder_name in parts:
        curr_parent = _get_or_create_folder(access_token, folder_name, parent_id=curr_parent)

    return curr_parent


def get_or_create_academic_structure(
    access_token: str,
    year: int = 2026,
    semester: str = "Sem-3",
    category: str = "Courses",
    course_code: Optional[str] = None,
) -> Dict[str, str]:
    """
    Ensure the semester-wise academic hierarchy exists:
    ATLAS-Academics / {year} / {semester} / {category} / [{course_code}]
    """
    if access_token.startswith("sandbox_access_token_"):
        return {
            "root_id": "sandbox_root",
            "target_id": f"sandbox_{course_code or category}",
            "path": f"ATLAS-Academics/{year}/{semester}/{category}" + (f"/{course_code}" if course_code else ""),
        }

    root_id = _get_or_create_folder(access_token, "ATLAS-Academics")
    year_id = _get_or_create_folder(access_token, str(year), parent_id=root_id)
    sem_id = _get_or_create_folder(access_token, semester, parent_id=year_id)
    cat_id = _get_or_create_folder(access_token, category, parent_id=sem_id)

    target_id = cat_id
    path = f"ATLAS-Academics/{year}/{semester}/{category}"

    if course_code:
        course_clean = course_code.upper().strip()
        course_id = _get_or_create_folder(access_token, course_clean, parent_id=cat_id)
        target_id = course_id
        path += f"/{course_clean}"

    return {
        "root_id": root_id,
        "target_id": target_id,
        "path": path,
    }


def get_or_create_course_folder(
    access_token: str,
    course_code: str,
    year: int = 2026,
    semester: str = "Sem-3",
) -> str:
    """Ensure course folder exists under ATLAS-Academics/{year}/{semester}/Courses/{course_code}."""
    res = get_or_create_academic_structure(
        access_token,
        year=year,
        semester=semester,
        category="Courses",
        course_code=course_code,
    )
    return res["target_id"]



_SANDBOX_FILES: List[Dict[str, Any]] = []


def _get_sandbox_files(folder_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """Return initial sample files plus any sandbox uploaded files."""
    base_files = [
        {
            "id": "sb_f1",
            "name": "CS316_Lecture_1_Introduction.pdf",
            "mimeType": "application/pdf",
            "size": "2450000",
            "modifiedTime": datetime.utcnow().isoformat(),
            "webViewLink": "https://drive.google.com",
            "is_folder": False,
        }
    ]
    # In sandbox mode, show base files plus any uploaded files for this folder/root
    uploaded = [
        f for f in _SANDBOX_FILES
        if not folder_id or f.get("parent_id") == folder_id or folder_id in ("sandbox_root", "sandbox_Courses")
    ]
    return base_files + uploaded


def browse_drive_folder(
    access_token: str,
    folder_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Browse Google Drive academic folder live (2-way sync view).
    Lists subfolders and files with rich metadata.
    """
    if access_token.startswith("sandbox_access_token_"):
        eff_id = folder_id or "sandbox_root"
        curr_name = "ATLAS-Academics"
        if eff_id != "sandbox_root":
            for f in _SANDBOX_FOLDERS:
                if f["id"] == eff_id:
                    curr_name = f["name"]
                    break
        subfolders = [f for f in _SANDBOX_FOLDERS if f.get("parent_id") == eff_id]
        breadcrumbs = [{"id": "sandbox_root", "name": "ATLAS-Academics"}]
        if eff_id != "sandbox_root":
            curr = eff_id
            trail = []
            visited = set()
            while curr and curr != "sandbox_root" and curr not in visited:
                visited.add(curr)
                found = next((f for f in _SANDBOX_FOLDERS if f["id"] == curr), None)
                if found:
                    trail.insert(0, {"id": found["id"], "name": found["name"]})
                    curr = found.get("parent_id")
                else:
                    break
            breadcrumbs.extend(trail)

        return {
            "current_folder_id": eff_id,
            "current_folder_name": curr_name,
            "breadcrumbs": breadcrumbs,
            "folders": subfolders,
            "files": _get_sandbox_files(eff_id),
        }

    headers = {"Authorization": f"Bearer {access_token}"}

    # If folder_id not provided, default to ATLAS-Academics root
    target_id = folder_id
    target_name = "ATLAS-Academics"

    if not target_id:
        target_id = _get_or_create_folder(access_token, "ATLAS-Academics")
        # Ensure initial Year/Semester/Courses folders exist so the user isn't greeting an empty page
        get_or_create_academic_structure(access_token, year=2026, semester="Sem-3", category="Courses")
        get_or_create_academic_structure(access_token, year=2026, semester="Sem-3", category="Extracurricular")
    else:
        # Get target folder metadata
        meta_resp = requests.get(
            f"{DRIVE_API_BASE}/files/{target_id}",
            headers=headers,
            params={"fields": "id, name, parents"},
            timeout=10,
        )
        if meta_resp.status_code == 200:
            target_name = meta_resp.json().get("name", "Folder")

    # Build breadcrumb trail
    breadcrumbs = [{"id": target_id, "name": target_name}]
    curr_parent_id = target_id
    depth = 0
    while depth < 5:
        depth += 1
        p_resp = requests.get(
            f"{DRIVE_API_BASE}/files/{curr_parent_id}",
            headers=headers,
            params={"fields": "id, name, parents"},
            timeout=8,
        )
        if p_resp.status_code != 200:
            break
        p_data = p_resp.json()
        parents = p_data.get("parents", [])
        if not parents or parents[0] == "root":
            break
        curr_parent_id = parents[0]
        # Fetch parent name
        p_info_resp = requests.get(
            f"{DRIVE_API_BASE}/files/{curr_parent_id}",
            headers=headers,
            params={"fields": "id, name"},
            timeout=8,
        )
        if p_info_resp.status_code == 200:
            p_name = p_info_resp.json().get("name", "Parent")
            breadcrumbs.insert(0, {"id": curr_parent_id, "name": p_name})
            if p_name == "ATLAS-Academics":
                break

    # Query all children (folders & files)
    q = f"'{target_id}' in parents and trashed = false"
    fields = "files(id, name, mimeType, size, modifiedTime, webViewLink, iconLink, thumbnailLink, parents)"
    list_resp = requests.get(
        f"{DRIVE_API_BASE}/files",
        headers=headers,
        params={"q": q, "fields": fields, "pageSize": 100, "orderBy": "folder, modifiedTime desc"},
        timeout=12,
    )

    items = list_resp.json().get("files", []) if list_resp.status_code == 200 else []

    folders = []
    files = []
    for it in items:
        mime = it.get("mimeType", "")
        is_folder = mime == "application/vnd.google-apps.folder"
        entry = {
            "id": it.get("id"),
            "name": it.get("name"),
            "mimeType": mime,
            "size": it.get("size", "0"),
            "modifiedTime": it.get("modifiedTime"),
            "webViewLink": it.get("webViewLink", f"https://drive.google.com/file/d/{it.get('id')}/view"),
            "iconLink": it.get("iconLink"),
            "thumbnailLink": it.get("thumbnailLink"),
            "is_folder": is_folder,
        }
        if is_folder:
            folders.append(entry)
        else:
            files.append(entry)

    return {
        "current_folder_id": target_id,
        "current_folder_name": target_name,
        "breadcrumbs": breadcrumbs,
        "folders": folders,
        "files": files,
    }


def create_drive_folder(
    access_token: str,
    folder_name: str,
    parent_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new folder directly in Google Drive."""
    if access_token.startswith("sandbox_access_token_"):
        pid = parent_id or "sandbox_root"
        folder_id = f"sb_folder_{uuid.uuid4().hex[:8]}"
        new_folder = {
            "id": folder_id,
            "name": folder_name,
            "parent_id": pid,
            "mimeType": "application/vnd.google-apps.folder",
            "is_folder": True,
        }
        _SANDBOX_FOLDERS.append(new_folder)
        return new_folder

    if not parent_id:
        parent_id = _get_or_create_folder(access_token, "ATLAS-Academics")

    new_id = _get_or_create_folder(access_token, folder_name, parent_id=parent_id)
    return {"id": new_id, "name": folder_name, "parent_id": parent_id, "is_folder": True}


def rename_drive_item(
    access_token: str,
    file_id: str,
    new_name: str,
) -> Dict[str, Any]:
    """Rename a file or folder in Google Drive."""
    if access_token.startswith("sandbox_access_token_"):
        for f in _SANDBOX_FOLDERS:
            if f["id"] == file_id:
                f["name"] = new_name
                return {"id": file_id, "name": new_name, "status": "renamed"}
        for fl in _SANDBOX_FILES:
            if fl["id"] == file_id:
                fl["name"] = new_name
                return {"id": file_id, "name": new_name, "status": "renamed"}
        return {"id": file_id, "name": new_name, "status": "renamed"}

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    resp = requests.patch(
        f"{DRIVE_API_BASE}/files/{file_id}",
        headers=headers,
        json={"name": new_name},
        timeout=10,
    )
    if resp.status_code == 200:
        return {"id": file_id, "name": new_name, "status": "success"}
    raise RuntimeError(f"Failed to rename Drive item: {resp.text}")


def move_drive_item(
    access_token: str,
    file_id: str,
    destination_folder_id: str,
) -> Dict[str, Any]:
    """Move a file or folder to another parent folder in Google Drive."""
    if access_token.startswith("sandbox_access_token_"):
        for f in _SANDBOX_FOLDERS:
            if f["id"] == file_id:
                f["parent_id"] = destination_folder_id
                return {"id": file_id, "destination": destination_folder_id, "status": "moved"}
        for fl in _SANDBOX_FILES:
            if fl["id"] == file_id:
                fl["parent_id"] = destination_folder_id
                return {"id": file_id, "destination": destination_folder_id, "status": "moved"}
        return {"id": file_id, "destination": destination_folder_id, "status": "moved"}

    headers = {"Authorization": f"Bearer {access_token}"}
    # Retrieve current parents
    f_resp = requests.get(f"{DRIVE_API_BASE}/files/{file_id}", headers=headers, params={"fields": "parents"}, timeout=8)
    old_parents = ",".join(f_resp.json().get("parents", [])) if f_resp.status_code == 200 else ""

    params = {"addParents": destination_folder_id}
    if old_parents:
        params["removeParents"] = old_parents

    resp = requests.patch(f"{DRIVE_API_BASE}/files/{file_id}", headers=headers, params=params, timeout=10)
    if resp.status_code == 200:
        return {"id": file_id, "destination": destination_folder_id, "status": "success"}
    raise RuntimeError(f"Failed to move Drive item: {resp.text}")


def delete_drive_item(
    access_token: str,
    file_id: str,
) -> Dict[str, Any]:
    """Soft-delete (trash) a file or folder in Google Drive."""
    if access_token.startswith("sandbox_access_token_"):
        # Remove from folders or files
        global _SANDBOX_FOLDERS, _SANDBOX_FILES
        _SANDBOX_FOLDERS = [f for f in _SANDBOX_FOLDERS if f["id"] != file_id]
        _SANDBOX_FILES = [fl for fl in _SANDBOX_FILES if fl["id"] != file_id]
        return {"id": file_id, "status": "trashed"}

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    resp = requests.patch(
        f"{DRIVE_API_BASE}/files/{file_id}",
        headers=headers,
        json={"trashed": True},
        timeout=10,
    )
    if resp.status_code == 200:
        return {"id": file_id, "status": "trashed"}
    raise RuntimeError(f"Failed to trash Drive item: {resp.text}")


def export_resource_to_google_drive(
    access_token: str,
    resource_title: str,
    resource_url: str,
    course_code: str,
    year: int = 2026,
    semester: str = "Sem-3",
    category: str = "Courses",
    description: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Save or link an academic resource into the student's designated semester course folder in Google Drive.
    """
    structure = get_or_create_academic_structure(
        access_token,
        year=year,
        semester=semester,
        category=category,
        course_code=course_code,
    )
    target_folder_id = structure["target_id"]
    folder_path = structure["path"]

    if access_token.startswith("sandbox_access_token_"):
        return {
            "file_id": f"drive_demo_{course_code.lower()}_1",
            "name": f"{resource_title}.url",
            "web_view_link": f"https://drive.google.com/file/d/demo_{course_code.lower()}/view",
            "folder_path": folder_path,
            "course_code": course_code,
            "status": "success",
            "message": f"Successfully exported '{resource_title}' to Google Drive under {folder_path}",
        }

    # Create shortcut file in Drive
    shortcut_content = f"[InternetShortcut]\nURL={resource_url}\nDescription={description or resource_title}\n"
    metadata = {
        "name": f"{resource_title}.url",
        "parents": [target_folder_id],
        "description": description or f"Resource link for {course_code} from ATLAS Platform",
    }

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


def upload_drive_file(
    access_token: str,
    file_bytes: bytes,
    filename: str,
    content_type: str = "application/octet-stream",
    parent_folder_id: Optional[str] = None,
    relative_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Directly upload an arbitrary file (PDF, slide, doc, image, etc.) into a Google Drive folder.
    Supports relative_path (e.g. 'Project/docs/readme.txt') to automatically create/resolve
    the folder hierarchy under parent_folder_id.
    """
    target_parent_id = parent_folder_id

    # If relative_path is provided, resolve directory portion
    if relative_path:
        norm_path = relative_path.replace("\\", "/").strip("/")
        parts = [p for p in norm_path.split("/") if p]
        # If the last segment is the filename or relative_path has multiple parts, resolve folder
        if len(parts) > 1:
            dir_path = "/".join(parts[:-1])
            actual_filename = parts[-1]
            if actual_filename:
                filename = actual_filename
            target_parent_id = get_or_create_nested_folder_path(
                access_token, dir_path, parent_id=parent_folder_id
            )

    if access_token.startswith("sandbox_access_token_"):
        file_id = f"sandbox_file_{uuid.uuid4().hex[:8]}"
        item = {
            "id": file_id,
            "name": filename,
            "mimeType": content_type or "application/octet-stream",
            "size": str(len(file_bytes)),
            "modifiedTime": datetime.utcnow().isoformat(),
            "webViewLink": f"https://drive.google.com/file/d/{file_id}/view",
            "is_folder": False,
            "parent_id": target_parent_id or "sandbox_root",
            "status": "success",
            "message": f"Successfully uploaded '{filename}' to Google Drive",
        }
        _SANDBOX_FILES.append(item)
        return item

    if not target_parent_id:
        target_parent_id = _get_or_create_folder(access_token, "ATLAS-Academics")

    metadata = {
        "name": filename,
        "parents": [target_parent_id],
    }

    boundary = f"boundary_{uuid.uuid4().hex}"
    meta_json = json.dumps(metadata)

    multipart_body = (
        f"--{boundary}\r\n"
        f"Content-Type: application/json; charset=UTF-8\r\n\r\n"
        f"{meta_json}\r\n"
        f"--{boundary}\r\n"
        f"Content-Type: {content_type or 'application/octet-stream'}\r\n\r\n"
    ).encode("utf-8") + file_bytes + f"\r\n--{boundary}--\r\n".encode("utf-8")

    upload_headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": f"multipart/related; boundary={boundary}",
        "Content-Length": str(len(multipart_body)),
    }

    resp = requests.post(
        f"{DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,size,modifiedTime,webViewLink,iconLink",
        headers=upload_headers,
        data=multipart_body,
        timeout=120,
    )

    if resp.status_code in (200, 201):
        data = resp.json()
        return {
            "id": data.get("id"),
            "name": data.get("name"),
            "mimeType": data.get("mimeType", content_type or "application/octet-stream"),
            "size": data.get("size", str(len(file_bytes))),
            "modifiedTime": data.get("modifiedTime"),
            "webViewLink": data.get("webViewLink", f"https://drive.google.com/file/d/{data.get('id')}/view"),
            "is_folder": False,
            "status": "success",
            "message": f"Successfully uploaded '{filename}' to Google Drive",
        }

    logger.error(f"[Google Drive] Direct file upload failed: {resp.text}")
    raise RuntimeError(f"Failed to upload file to Google Drive: {resp.text}")


