from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date, timedelta
from ..core.database import get_db
from ..models import TaskLog, PlannerEvent, DeadlineSubtask
from .auth import get_current_user

try:
    from ..schemas.deadline import (
        DeadlineSubtaskSchema,
        DeadlineWithSubtasksSchema,
        CreateSubtaskRequest,
        UpdateSubtaskRequest,
    )
    has_deadline_schemas = True
except ImportError:
    has_deadline_schemas = False

router = APIRouter()


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    domain: Optional[str] = ""
    priority: int = 2
    estimated_hours: float = 1
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[int] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    completed: Optional[bool] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: str
    domain: str
    priority: int
    estimated_hours: float
    actual_hours: float
    completed: bool
    due_date: Optional[datetime]

    class Config:
        from_attributes = True


class WorkloadResponse(BaseModel):
    capacity: float
    scheduled_hours: float
    utilization_percent: float
    status: str
    overload_hours: float


class RebalanceSuggestion(BaseModel):
    task_id: int
    task_title: str
    current_due_date: Optional[datetime]
    suggested_due_date: Optional[datetime]
    reason: str


class RebalanceResponse(BaseModel):
    suggestions: List[RebalanceSuggestion]
    overload_weeks: int


class ApplyRebalanceRequest(BaseModel):
    changes: List[dict]


@router.get("/", response_model=List[TaskResponse])
def list_tasks(
    completed: Optional[bool] = None,
    domain: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(TaskLog).filter(TaskLog.student_id == current_user.id)
    if completed is not None:
        query = query.filter(TaskLog.completed == completed)
    if domain:
        query = query.filter(TaskLog.domain == domain)
    return query.order_by(TaskLog.due_date.asc()).all()


@router.post("/", response_model=TaskResponse)
def create_task(task: TaskCreate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    db_task = TaskLog(**task.model_dump(), student_id=current_user.id)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, updates: TaskUpdate, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    db_task = db.query(TaskLog).filter(TaskLog.id == task_id, TaskLog.student_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    for key, value in updates.model_dump(exclude_none=True).items():
        setattr(db_task, key, value)
    db.commit()
    db.refresh(db_task)
    return db_task


@router.delete("/{task_id}")
def delete_task(task_id: int, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    db_task = db.query(TaskLog).filter(TaskLog.id == task_id, TaskLog.student_id == current_user.id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(db_task)
    db.commit()
    return {"message": "Task deleted"}


@router.get("/workload", response_model=WorkloadResponse)
def get_workload(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    pending = db.query(TaskLog).filter(
        TaskLog.student_id == current_user.id,
        TaskLog.completed == False
    ).all()

    scheduled_hours = 0.0
    for task in pending:
        if task.due_date:
            task_date = task.due_date.date()
            if week_start <= task_date <= week_end:
                scheduled_hours += task.estimated_hours

    capacity = current_user.study_hours_per_week or 20
    utilization = (scheduled_hours / capacity * 100) if capacity > 0 else 0
    overload_hours = max(scheduled_hours - capacity, 0)

    if utilization <= 50:
        status = "underloaded"
    elif utilization <= 100:
        status = "optimal"
    else:
        status = "overloaded"

    return WorkloadResponse(
        capacity=round(capacity, 1),
        scheduled_hours=round(scheduled_hours, 1),
        utilization_percent=round(utilization, 1),
        status=status,
        overload_hours=round(overload_hours, 1)
    )


@router.post("/rebalance", response_model=RebalanceResponse)
def get_rebalance_suggestions(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    pending = db.query(TaskLog).filter(
        TaskLog.student_id == current_user.id,
        TaskLog.completed == False
    ).order_by(TaskLog.priority.desc()).order_by(TaskLog.due_date.asc()).all()

    capacity = current_user.study_hours_per_week or 20
    current_week_hours = 0.0
    for task in pending:
        if task.due_date:
            task_date = task.due_date.date()
            if week_start <= task_date <= week_end:
                current_week_hours += task.estimated_hours

    overload_hours = max(current_week_hours - capacity, 0)
    suggestions = []

    if overload_hours > 0:
        tasks_to_defer = []
        accumulated_savings = 0.0

        for task in pending:
            if task.due_date and week_start <= task.due_date.date() <= week_end:
                tasks_to_defer.append(task)
                accumulated_savings += task.estimated_hours
                if accumulated_savings >= overload_hours:
                    break

        next_week_start = week_end + timedelta(days=1)

        for task in tasks_to_defer:
            if accumulated_savings - task.estimated_hours >= overload_hours:
                accumulated_savings -= task.estimated_hours
                continue

            if task.due_date:
                suggested_date = next_week_start
            else:
                suggested_date = None

            suggestions.append(RebalanceSuggestion(
                task_id=task.id,
                task_title=task.title,
                current_due_date=task.due_date,
                suggested_due_date=suggested_date,
                reason=f"Deferring to reduce workload by {task.estimated_hours}h (priority {task.priority})"
            ))

    return RebalanceResponse(
        suggestions=suggestions,
        overload_weeks=1
    )


@router.post("/apply-rebalance", response_model=List[TaskResponse])
def apply_rebalance(changes: ApplyRebalanceRequest, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    updated_tasks = []

    for change in changes.changes:
        task_id = change.get("task_id")
        new_due_date = change.get("new_due_date")

        task = db.query(TaskLog).filter(TaskLog.id == task_id, TaskLog.student_id == current_user.id).first()
        if not task:
            continue

        if new_due_date:
            task.due_date = datetime.fromisoformat(new_due_date)

        db.commit()
        db.refresh(task)
        updated_tasks.append(task)

    return updated_tasks


# ─── Deadline & Subtask Endpoints ─────────────────────────────────────────────

if has_deadline_schemas:
    @router.get("/deadlines", response_model=List[DeadlineWithSubtasksSchema])
    def get_deadlines(
        current_user = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        deadlines = db.query(PlannerEvent).filter(
            PlannerEvent.userId == current_user.id,
            PlannerEvent.deadline_date.isnot(None),
            PlannerEvent.deletedAt.is_(None)
        ).order_by(PlannerEvent.deadline_date.asc()).all()

        return deadlines

    @router.post("/deadlines/{deadline_id}/subtasks", response_model=DeadlineSubtaskSchema)
    @router.post("/deadlines/subtasks/{deadline_id}", response_model=DeadlineSubtaskSchema)
    def create_subtask(
        deadline_id: int,
        request: CreateSubtaskRequest,
        current_user = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        deadline = db.query(PlannerEvent).filter(
            PlannerEvent.id == deadline_id,
            PlannerEvent.userId == current_user.id,
            PlannerEvent.deletedAt.is_(None)
        ).first()
        if not deadline:
            raise HTTPException(status_code=404, detail="Deadline event not found or access denied")

        subtask = DeadlineSubtask(
            deadline_id=deadline_id,
            title=request.title.strip(),
            is_completed=False,
            order=request.order or 0
        )
        db.add(subtask)
        db.commit()
        db.refresh(subtask)
        return subtask

    @router.patch("/deadlines/subtasks/{subtask_id}", response_model=DeadlineSubtaskSchema)
    def update_subtask(
        subtask_id: int,
        updates: UpdateSubtaskRequest,
        current_user = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        subtask = db.query(DeadlineSubtask).join(PlannerEvent).filter(
            DeadlineSubtask.id == subtask_id,
            PlannerEvent.userId == current_user.id,
            PlannerEvent.deletedAt.is_(None)
        ).first()
        if not subtask:
            raise HTTPException(status_code=404, detail="Subtask not found or access denied")

        update_data = updates.model_dump(exclude_unset=True)
        for field, val in update_data.items():
            if val is not None:
                if field == 'title':
                    val = val.strip()
                setattr(subtask, field, val)

        db.commit()
        db.refresh(subtask)
        return subtask

    @router.delete("/deadlines/subtasks/{subtask_id}")
    def delete_subtask(
        subtask_id: int,
        current_user = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        subtask = db.query(DeadlineSubtask).join(PlannerEvent).filter(
            DeadlineSubtask.id == subtask_id,
            PlannerEvent.userId == current_user.id,
            PlannerEvent.deletedAt.is_(None)
        ).first()
        if not subtask:
            raise HTTPException(status_code=404, detail="Subtask not found or access denied")

        db.delete(subtask)
        db.commit()
        return {"message": "Subtask deleted successfully"}
