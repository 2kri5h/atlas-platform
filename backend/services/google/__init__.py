"""Google Workspace Integration Services (OAuth, Gmail, Drive, Calendar)"""

from .auth import (
    get_google_auth_url,
    exchange_code_for_tokens,
    get_google_user_info,
    save_or_update_google_account,
    get_valid_access_token,
    get_google_account,
    disconnect_google_account,
    is_google_oauth_configured,
)
from .gmail import fetch_recent_gmail_messages
from .drive import (
    export_resource_to_google_drive,
    get_or_create_course_folder,
    get_or_create_academic_structure,
    get_or_create_nested_folder_path,
    browse_drive_folder,
    create_drive_folder,
    rename_drive_item,
    move_drive_item,
    delete_drive_item,
    upload_drive_file,
)
from .calendar import sync_timetable_to_google_calendar, sync_deadlines_to_google_calendar

__all__ = [
    "get_google_auth_url",
    "exchange_code_for_tokens",
    "get_google_user_info",
    "save_or_update_google_account",
    "get_valid_access_token",
    "get_google_account",
    "disconnect_google_account",
    "is_google_oauth_configured",
    "fetch_recent_gmail_messages",
    "export_resource_to_google_drive",
    "get_or_create_course_folder",
    "get_or_create_academic_structure",
    "get_or_create_nested_folder_path",
    "browse_drive_folder",
    "create_drive_folder",
    "rename_drive_item",
    "move_drive_item",
    "delete_drive_item",
    "upload_drive_file",
    "sync_timetable_to_google_calendar",
    "sync_deadlines_to_google_calendar",
]

