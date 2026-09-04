"""Tests for My Library API and Google Drive operations."""

import pytest
from datetime import datetime
from sqlalchemy.orm import sessionmaker
from backend.core.database import Base, create_sqlite_engine
from backend.models import Student, Resource, ResourceBookmark, TaskLog, PlannerEvent
from backend.services.google.drive import (
    browse_drive_folder,
    create_drive_folder,
    rename_drive_item,
    move_drive_item,
    delete_drive_item,
    get_or_create_course_folder,
    upload_drive_file,
)
from backend.api.resources import (
    get_user_library,
    create_task_from_resource,
    TaskFromResourceRequest,
)


@pytest.fixture()
def db():
    engine = create_sqlite_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture()
def student(db):
    s = Student(
        name="Library Tester",
        email="lib@iitb.ac.in",
        roll_number="21001099",
        password_hash="x",
    )
    db.add(s)
    db.commit()
    return s


def test_google_drive_sandbox_operations():
    sandbox_token = "sandbox_access_token_test"

    # Browse
    browse_res = browse_drive_folder(sandbox_token)
    assert browse_res["current_folder_name"] == "ATLAS-Academics"
    assert len(browse_res["files"]) > 0

    # Create folder
    new_folder = create_drive_folder(sandbox_token, "CS316")
    assert new_folder["name"] == "CS316"

    # Rename
    renamed = rename_drive_item(sandbox_token, "sb_f1", "CS316_Lecture_Updated.pdf")
    assert renamed["name"] == "CS316_Lecture_Updated.pdf"

    # Move
    moved = move_drive_item(sandbox_token, "sb_f1", "sb_target_folder")
    assert moved["destination"] == "sb_target_folder"

    # Delete
    deleted = delete_drive_item(sandbox_token, "sb_f1")
    assert deleted["status"] == "trashed"

    # Course folder helper
    course_folder_id = get_or_create_course_folder(sandbox_token, "CS316")
    assert "CS316" in course_folder_id

    # Direct File Upload (Sandbox)
    upload_res = upload_drive_file(
        access_token=sandbox_token,
        file_bytes=b"%PDF-1.4 test lecture notes content",
        filename="IE203_Lecture_Notes.pdf",
        content_type="application/pdf",
        parent_folder_id="sandbox_IE203",
    )
    assert upload_res["status"] == "success"
    assert upload_res["name"] == "IE203_Lecture_Notes.pdf"
    assert upload_res["mimeType"] == "application/pdf"
    assert "id" in upload_res

    # Verify uploaded file shows up in browse
    browse_after_upload = browse_drive_folder(sandbox_token, folder_id="sandbox_IE203")
    uploaded_names = [f["name"] for f in browse_after_upload["files"]]
    assert "IE203_Lecture_Notes.pdf" in uploaded_names


def test_library_combined_bookmarks_and_uploads(db, student):
    # Other student's resource
    r1 = Resource(
        title="Public Curated ML Course",
        url="https://coursera.org/learn/ml",
        domain="ai-ml",
        course="CS725",
        resource_type="course",
        is_curated=True,
    )
    # Student's own private note
    r2 = Resource(
        title="My Private CS316 Notes",
        url="https://drive.google.com/open?id=123",
        domain="sde",
        course="CS316",
        resource_type="notes",
        uploader_id=student.id,
        is_private=True,
    )
    db.add_all([r1, r2])
    db.commit()

    # Bookmark r1
    bm = ResourceBookmark(student_id=student.id, resource_id=r1.id)
    db.add(bm)
    db.commit()

    # Fetch library
    lib = get_user_library(current_user=student, db=db)
    assert len(lib) == 2
    titles = [item.title for item in lib]
    assert "Public Curated ML Course" in titles
    assert "My Private CS316 Notes" in titles

    # Filter by course
    cs316_lib = get_user_library(course="CS316", current_user=student, db=db)
    assert len(cs316_lib) == 1
    assert cs316_lib[0].title == "My Private CS316 Notes"
    assert cs316_lib[0].is_owner is True
    assert cs316_lib[0].origin == "note"


def test_create_task_and_deadline_from_resource(db, student):
    payload = TaskFromResourceRequest(
        title="Study CS316 Lecture 1",
        url="https://youtube.com/watch?v=123",
        course_code="CS316",
        due_date=datetime(2026, 9, 15, 23, 59),
        end_time="23:59",
        priority=1,
        tag="CRITICAL",
        custom_tag="Weightage: 20%",
        notes="Review normalization and indexing",
        create_planner_deadline=True,
    )

    res = create_task_from_resource(payload=payload, current_user=student, db=db)
    assert res["status"] == "success"
    assert res["task_id"] is not None
    assert res["planner_event_id"] is not None

    task = db.query(TaskLog).filter(TaskLog.id == res["task_id"]).first()
    assert task.title == "Study CS316 Lecture 1"
    assert task.priority == 1
    assert "Weightage: 20%" in task.description

    event = db.query(PlannerEvent).filter(PlannerEvent.id == res["planner_event_id"]).first()
    assert event.title == "Study CS316 Lecture 1"
    assert event.tag == "CRITICAL"
    assert event.deadline_label == "Weightage: 20%"
    assert event.endTime == "23:59"
