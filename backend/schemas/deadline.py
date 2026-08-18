from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class DeadlineSubtaskSchema(BaseModel):
    id: int
    deadline_id: int
    title: str
    is_completed: bool = False
    order: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeadlineWithSubtasksSchema(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    date: Optional[datetime] = None
    startTime: str
    endTime: str
    tag: str
    category: str
    deadline_date: Optional[datetime] = None
    deadline_label: Optional[str] = None
    subtasks: List[DeadlineSubtaskSchema] = []

    class Config:
        from_attributes = True


class CreateSubtaskRequest(BaseModel):
    title: str
    order: Optional[int] = 0


class UpdateSubtaskRequest(BaseModel):
    title: Optional[str] = None
    is_completed: Optional[bool] = None
    order: Optional[int] = None
