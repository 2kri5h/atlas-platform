from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
import json
import os
import joblib
import pandas as pd
from functools import lru_cache
from datetime import datetime, timedelta

from ..core.database import get_db
from ..models import (
    Student,
    TaskLog,
    BurnoutScore,
    AIChat,
    AIMessage,
    SmartSuggestion,
    PlannerEvent,
    DeadlineSubtask,
)
from .auth import get_current_user
from sqlalchemy import func, case

try:
    from ..services.planner_ai import (
        GeminiServiceError,
        generate_test_response,
        generate_plan,
        chat_with_gemini,
    )
    from ..services.resource_context import get_resource_library_context
    from ..services.smart_suggestions import generate_suggestions
    has_ai_services = True
except Exception as e:
    print("AI IMPORT ERROR:", e)
    import traceback
    traceback.print_exc()
    has_ai_services = False

router = APIRouter()


class RoadmapRequest(BaseModel):
    chat_id: Optional[int] = None
    branch: str
    year: int
    goals: str
    weak_subjects: str
    study_hours_per_week: float


class ChatRequest(BaseModel):
    message: str


class RenameChatRequest(BaseModel):
    title: str


class NewChatResponse(BaseModel):
    chat_id: int


class ChatSummary(BaseModel):
    id: int
    title: str


class ChatListResponse(BaseModel):
    chats: List[ChatSummary]


class BurnoutRequest(BaseModel):
    # Heuristic inputs
    study_hours: Optional[float] = None
    workload_factor: Optional[float] = None
    stress_level: Optional[int] = None
    consistency_factor: Optional[float] = None
    # ML model inputs
    cgpa: Optional[float] = None
    daily_sleep_hours: Optional[float] = None
    daily_study_hours: Optional[float] = None
    physical_activity_hours: Optional[float] = None
    social_support_score: Optional[float] = None
    screen_time_hours: Optional[float] = None
    # Optional manual overrides for telemetry signals
    override_working_hours: Optional[float] = None
    override_deadline_pressure: Optional[float] = None


class AIResponse(BaseModel):
    message: str
    data: Optional[dict] = None


class SmartSuggestionUpdate(BaseModel):
    status: Optional[str] = None
    is_pinned: Optional[bool] = None


DOMAIN_ROADMAPS = {
    "sde": [
        {"phase": 1, "focus": "DSA Fundamentals", "resources": ["LeetCode Easy", "CSES Problems"], "hours": 10},
        {"phase": 2, "focus": "DSA Advanced + System Design Basics", "resources": ["LeetCode Medium", "Grokking System Design"], "hours": 12},
        {"phase": 3, "focus": "Development Skills", "resources": ["Full Stack Projects", "Docker, Git"], "hours": 8},
        {"phase": 4, "focus": "Interview Prep + Mock Interviews", "resources": ["InterviewBit", "Pramp"], "hours": 10},
    ],
    "ai_ml": [
        {"phase": 1, "focus": "Math Foundations", "resources": ["Khan Academy Linear Algebra", "3Blue1Brown"], "hours": 8},
        {"phase": 2, "focus": "ML Fundamentals", "resources": ["Andrew Ng ML Course", "Fast.ai"], "hours": 10},
        {"phase": 3, "focus": "Deep Learning + Projects", "resources": ["CS231n", "Kaggle Competitions"], "hours": 12},
        {"phase": 4, "focus": "Research + Paper Reading", "resources": ["Arxiv", "Papers with Code"], "hours": 8},
    ],
    "research": [
        {"phase": 1, "focus": "Literature Survey", "resources": ["Google Scholar", "Connected Papers"], "hours": 6},
        {"phase": 2, "focus": "Paper Writing Skills", "resources": ["LaTeX, Overleaf", "Writing Papers"], "hours": 6},
        {"phase": 3, "focus": "Research Projects", "resources": ["arXiv", "Open Source Contributions"], "hours": 12},
        {"phase": 4, "focus": "Submission + Presentation", "resources": ["Conference Submissions"], "hours": 6},
    ],
}

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "website_gradient_model.pkl")


@lru_cache(maxsize=1)
def get_burnout_model():
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(MODEL_PATH)
    return joblib.load(MODEL_PATH)


def _parse_time_to_minutes(t: str) -> int:
    """Convert 'HH:MM' to minutes since midnight."""
    try:
        h, m = t.split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return 0


def compute_weekly_working_hours(db: Session, student_id: int) -> float:
    """Sum actual working hours from PlannerEvent (isWorkingHour=True) for the last 7 days."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    total_minutes = 0.0

    # Non-recurring events in the last 7 days
    events = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student_id,
        PlannerEvent.isWorkingHour == True,
        PlannerEvent.deletedAt == None,
        PlannerEvent.isRecurring == False,
        PlannerEvent.date >= week_ago,
        PlannerEvent.date <= now,
    ).all()
    for e in events:
        duration = _parse_time_to_minutes(e.endTime) - _parse_time_to_minutes(e.startTime)
        total_minutes += max(duration, 0)

    # Recurring events — find those whose recurrenceDay matches any day in the last 7 days
    recurring = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student_id,
        PlannerEvent.isWorkingHour == True,
        PlannerEvent.deletedAt == None,
        PlannerEvent.isRecurring == True,
    ).all()
    for e in recurring:
        if e.recurrenceDay is None:
            continue
        # Parse exdates
        exdates = set()
        if e.exdates:
            try:
                exdates = set(json.loads(e.exdates))
            except Exception:
                pass
        # Check each of the last 7 days
        for day_offset in range(7):
            day = (now - timedelta(days=day_offset)).date()
            if day.weekday() == e.recurrenceDay % 7:
                date_str = day.isoformat()
                if date_str not in exdates:
                    duration = _parse_time_to_minutes(e.endTime) - _parse_time_to_minutes(e.startTime)
                    total_minutes += max(duration, 0)

    return round(total_minutes / 60.0, 2)


def compute_deadline_pressure(db: Session, student_id: int) -> float:
    """Compute deadline pressure score (0–1) from upcoming/overdue planner deadlines."""
    now = datetime.utcnow()
    upcoming_7 = now + timedelta(days=7)

    deadlines = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student_id,
        PlannerEvent.deadline_date != None,
        PlannerEvent.isCompleted == False,
        PlannerEvent.deletedAt == None,
    ).all()

    if not deadlines:
        return 0.0

    overdue_total = 0.0
    other_total = 0.0
    total_subtasks = 0
    completed_subtasks = 0

    for d in deadlines:
        dd = d.deadline_date
        # Tally subtasks for mitigation
        for sub in (d.subtasks or []):
            total_subtasks += 1
            if sub.is_completed:
                completed_subtasks += 1

        if dd < now:
            overdue_total = min(overdue_total + 0.35, 0.70)
        elif dd <= now + timedelta(days=3):
            other_total += 0.20
        elif dd <= upcoming_7:
            other_total += 0.10

    raw = min(overdue_total + other_total, 1.0)

    # Subtask mitigation: progress reduces pressure by up to 40%
    if total_subtasks > 0:
        progress = completed_subtasks / total_subtasks
        raw = raw * (1.0 - 0.40 * progress)

    return round(raw, 4)


def compute_sleep_deficit(db: Session, student: Student) -> float:
    """Compute sleep deficit (hours short this week) vs. the student's baseline."""
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    baseline_weekly = (student.sleep_hours or 7.0) * 7  # target hours per week

    sleep_events = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student.id,
        PlannerEvent.category == 'SLEEP',
        PlannerEvent.deletedAt == None,
        PlannerEvent.date >= week_ago,
        PlannerEvent.date <= now,
    ).all()

    # Add recurring SLEEP events
    recurring_sleep = db.query(PlannerEvent).filter(
        PlannerEvent.userId == student.id,
        PlannerEvent.category == 'SLEEP',
        PlannerEvent.deletedAt == None,
        PlannerEvent.isRecurring == True,
    ).all()

    actual_minutes = 0.0
    for e in sleep_events:
        if not e.isRecurring:
            duration = _parse_time_to_minutes(e.endTime) - _parse_time_to_minutes(e.startTime)
            actual_minutes += max(duration, 0)
    for e in recurring_sleep:
        if e.recurrenceDay is None:
            continue
        exdates = set()
        if e.exdates:
            try:
                exdates = set(json.loads(e.exdates))
            except Exception:
                pass
        for day_offset in range(7):
            day = (now - timedelta(days=day_offset)).date()
            if day.weekday() == e.recurrenceDay % 7:
                if day.isoformat() not in exdates:
                    duration = _parse_time_to_minutes(e.endTime) - _parse_time_to_minutes(e.startTime)
                    actual_minutes += max(duration, 0)

    actual_hours = actual_minutes / 60.0
    deficit = max(baseline_weekly - actual_hours, 0.0)
    return round(deficit, 2)


def compute_task_backlog_pressure(db: Session, student_id: int) -> float:
    """Weighted overdue task backlog pressure (0–1). Priority-1 tasks count ×3, priority-2 ×2, priority-3 ×1."""
    now = datetime.utcnow()
    overdue_tasks = db.query(TaskLog).filter(
        TaskLog.student_id == student_id,
        TaskLog.completed == False,
        TaskLog.due_date != None,
        TaskLog.due_date < now,
    ).all()

    weight_map = {1: 3, 2: 2, 3: 1}
    weighted = sum(weight_map.get(t.priority, 1) for t in overdue_tasks)
    return round(min(weighted / 10.0, 1.0), 4)


def compute_trend_penalty(db: Session, student_id: int) -> float:
    """Detects escalating burnout. Returns a 0–1 penalty for upward score trends."""
    recent_scores = (
        db.query(BurnoutScore.score)
        .filter(BurnoutScore.student_id == student_id)
        .order_by(BurnoutScore.created_at.desc())
        .limit(14)
        .all()
    )
    scores = [row[0] for row in recent_scores]
    if len(scores) < 4:
        return 0.0

    mid = len(scores) // 2
    recent_avg = sum(scores[:mid]) / mid
    older_avg = sum(scores[mid:]) / (len(scores) - mid)
    delta = (recent_avg - older_avg) / 100.0
    return round(max(delta, 0.0), 4)


def _compute_telemetry_score(
    norm_working_hours: float,
    deadline_pressure: float,
    sleep_deficit_norm: float,
    task_backlog: float,
) -> float:
    """Combined planner telemetry sub-score (0–100)."""
    score = (
        0.35 * norm_working_hours
        + 0.30 * deadline_pressure
        + 0.20 * sleep_deficit_norm
        + 0.15 * task_backlog
    ) * 100
    return round(score, 2)


def calculate_burnout_score(
    working_hours: float,
    workload_factor: float,
    stress_level: int,
    consistency_factor: float,
    deadline_pressure: float = 0.0,
    sleep_deficit_norm: float = 0.0,
    task_backlog: float = 0.0,
) -> float:
    normalized_hours = min(working_hours / 55, 1)
    score = (
        0.25 * normalized_hours
        + 0.20 * workload_factor
        + 0.15 * (stress_level / 5)
        + 0.10 * (1 - consistency_factor)
        + 0.15 * deadline_pressure
        + 0.10 * sleep_deficit_norm
        + 0.05 * task_backlog
    ) * 100
    return round(score, 2)


def _generate_burnout_recommendations(
    risk_level: str,
    weekly_working_hours: float,
    deadline_count: int,
    sleep_deficit_hours: float,
    overdue_task_count: int,
    has_ai: bool,
) -> list[str]:
    """Generate specific, contextual recommendations. Uses Gemini if available."""
    if has_ai:
        try:
            from ..services.planner_ai import _generate
            prompt = (
                f"You are a student wellbeing coach. A student has a {risk_level} burnout risk.\n"
                f"Their signals this week: {weekly_working_hours:.1f}h working hours logged, "
                f"{deadline_count} upcoming/overdue deadlines, "
                f"{sleep_deficit_hours:.1f}h sleep below weekly target, "
                f"{overdue_task_count} overdue tasks.\n"
                "Give 3 short, specific, actionable recommendations (1 sentence each). "
                "Refer to the actual numbers. Return as a JSON array of strings only."
            )
            response_text = _generate(prompt, {"response_mime_type": "application/json"})
            import re
            cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", response_text.strip(), flags=re.IGNORECASE)
            recs = json.loads(cleaned)
            if isinstance(recs, list) and recs:
                return [str(r).strip() for r in recs[:4]]
        except Exception:
            pass

    # Fallback: signal-aware static recommendations
    recs = []
    if weekly_working_hours > 45:
        recs.append(f"You've logged {weekly_working_hours:.0f}h this week — schedule a rest day or cut non-critical blocks.")
    if deadline_count > 0:
        recs.append(f"You have {deadline_count} active deadline(s) — break the nearest one into subtasks today.")
    if sleep_deficit_hours > 3:
        recs.append(f"You're {sleep_deficit_hours:.1f}h short on sleep this week — protect tomorrow morning's schedule.")
    if overdue_task_count > 0:
        recs.append(f"You have {overdue_task_count} overdue task(s) — tackle the highest-priority one in your next free hour.")
    if not recs:
        if risk_level == 'Low':
            recs.append("Great balance! Keep maintaining your current rhythm.")
        else:
            recs.append("Take 45-minute breaks between deep work sessions.")
            recs.append("Maintain a consistent sleep schedule.")
            recs.append("Balance academic work with short physical activity.")
    return recs


def _serialize_suggestion(suggestion: SmartSuggestion) -> dict:
    resource = suggestion.resource
    return {
        "id": suggestion.id,
        "title": suggestion.title,
        "reason": suggestion.reason,
        "action_steps": json.loads(suggestion.action_steps or "[]"),
        "priority": suggestion.priority,
        "status": suggestion.status,
        "is_pinned": suggestion.is_pinned,
        "resource": {
            "id": resource.id,
            "title": resource.title,
            "url": resource.url,
        } if resource else None,
    }


def _replace_unpinned_suggestions(db: Session, student: Student) -> list:
    if not has_ai_services:
        return []
    db.query(SmartSuggestion).filter(
        SmartSuggestion.student_id == student.id,
        SmartSuggestion.status == "active",
        SmartSuggestion.is_pinned == False,
    ).delete(synchronize_session=False)
    for item in generate_suggestions(db, student):
        # `item` contains action_steps as a list for the API. Persist its JSON
        # representation once; passing both values raises a TypeError.
        suggestion_data = {
            **item,
            "action_steps": json.dumps(item["action_steps"]),
        }
        db.add(SmartSuggestion(student_id=student.id, **suggestion_data))
    db.commit()
    return db.query(SmartSuggestion).filter(
        SmartSuggestion.student_id == student.id,
        SmartSuggestion.status == "active",
    ).order_by(SmartSuggestion.is_pinned.desc(), SmartSuggestion.priority.asc()).all()


@router.get("/smart-suggestions")
def list_smart_suggestions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    suggestions = db.query(SmartSuggestion).filter(
        SmartSuggestion.student_id == current_user.id,
        SmartSuggestion.status == "active",
    ).order_by(SmartSuggestion.is_pinned.desc(), SmartSuggestion.priority.asc()).all()
    if not suggestions:
        suggestions = _replace_unpinned_suggestions(db, current_user)
    return {"suggestions": [_serialize_suggestion(s) for s in suggestions]}


@router.post("/smart-suggestions/refresh")
def refresh_smart_suggestions(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    suggestions = _replace_unpinned_suggestions(db, current_user)
    return {"suggestions": [_serialize_suggestion(s) for s in suggestions]}


@router.patch("/smart-suggestions/{suggestion_id}")
def update_smart_suggestion(
    suggestion_id: int,
    updates: SmartSuggestionUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    suggestion = db.query(SmartSuggestion).filter(
        SmartSuggestion.id == suggestion_id,
        SmartSuggestion.student_id == current_user.id,
    ).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    if updates.status is not None:
        if updates.status not in {"active", "completed", "dismissed"}:
            raise HTTPException(status_code=400, detail="Invalid suggestion status")
        suggestion.status = updates.status
    if updates.is_pinned is not None:
        suggestion.is_pinned = updates.is_pinned
    db.commit()
    db.refresh(suggestion)
    return _serialize_suggestion(suggestion)


@router.post("/roadmap")
def generate_roadmap(request: RoadmapRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if has_ai_services and request.chat_id:
        try:
            resource_context = get_resource_library_context(db, current_user)
            plan = generate_plan(
                branch=request.branch,
                year=request.year,
                goals=request.goals,
                weak_subjects=request.weak_subjects,
                cpi=current_user.cpi,
                sleep_hours=current_user.sleep_hours,
                screen_time_hours=current_user.screen_time_hours,
                resource_context=resource_context,
            )
        except GeminiServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        chat = db.query(AIChat).filter(
            AIChat.id == request.chat_id,
            AIChat.student_id == current_user.id,
        ).first()

        if chat:
            chat.title = "AI Roadmap"
            message = AIMessage(chat_id=chat.id, role="assistant", content=plan)
            db.add(message)
            db.commit()

        return AIResponse(message=plan)

    # Rule-based fallback
    goals_lower = request.goals.lower()
    if "placement" in goals_lower or "sde" in goals_lower or "software" in goals_lower:
        domain = "sde"
    elif "research" in goals_lower or "phd" in goals_lower or "paper" in goals_lower:
        domain = "research"
    elif "ai" in goals_lower or "ml" in goals_lower or "data" in goals_lower:
        domain = "ai_ml"
    else:
        domain = "sde"

    roadmap = DOMAIN_ROADMAPS.get(domain, DOMAIN_ROADMAPS["sde"])
    weeks = max(int(request.study_hours_per_week * 4), 1)

    return AIResponse(
        message=f"Personalized {domain.upper()} roadmap based on your goals and available time.",
        data={
            "domain": domain,
            "roadmap": roadmap,
            "estimated_weeks": weeks,
            "weak_subjects": request.weak_subjects.split(",") if request.weak_subjects else [],
        }
    )


@router.post("/new-chat")
def new_chat(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    chat = AIChat(student_id=current_user.id, title="New Chat")
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return NewChatResponse(chat_id=chat.id)


@router.get("/chat/{chat_id}")
def get_chat(chat_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.query(AIChat).filter(
        AIChat.id == chat_id,
        AIChat.student_id == current_user.id,
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found.")

    return {
        "chat_id": chat.id,
        "title": chat.title,
        "messages": [{"role": m.role, "content": m.content} for m in chat.messages],
    }


@router.post("/chat/{chat_id}")
def chat(chat_id: int, request: ChatRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.query(AIChat).filter(
        AIChat.id == chat_id,
        AIChat.student_id == current_user.id,
    ).first()

    if not chat:
        raise HTTPException(status_code=404, detail="No chat found. Generate a roadmap first.")

    user_message = AIMessage(chat_id=chat.id, role="user", content=request.message)
    db.add(user_message)
    db.commit()

    if has_ai_services:
        try:
            history = db.query(AIMessage).filter(AIMessage.chat_id == chat.id).order_by(AIMessage.created_at.desc()).limit(12).all()
            history.reverse()
            reply = chat_with_gemini(current_user, history, get_resource_library_context(db, current_user, request.message))
        except GeminiServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    else:
        reply = f"AI response for: {request.message}"

    assistant_message = AIMessage(chat_id=chat.id, role="assistant", content=reply)
    db.add(assistant_message)
    db.commit()

    return AIResponse(message=reply)


@router.get("/chats")
def get_chats(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    chats = db.query(AIChat).filter(AIChat.student_id == current_user.id).order_by(AIChat.created_at.desc()).all()
    return ChatListResponse(chats=[ChatSummary(id=c.id, title=c.title) for c in chats])


@router.post("/burnout-score")
def calculate_burnout(request: BurnoutRequest, current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    # ── Step 1: Compute live planner telemetry ─────────────────────────────────
    weekly_hours = (
        request.override_working_hours
        if request.override_working_hours is not None
        else compute_weekly_working_hours(db, current_user.id)
    )
    # Fall back to profile value if planner has no data
    if weekly_hours == 0:
        weekly_hours = current_user.study_hours_per_week or 20

    deadline_pres = (
        request.override_deadline_pressure
        if request.override_deadline_pressure is not None
        else compute_deadline_pressure(db, current_user.id)
    )
    sleep_deficit_hrs = compute_sleep_deficit(db, current_user)
    # If no sleep events tracked, assume perfect sleep (no deficit)
    sleep_deficit_norm = min(sleep_deficit_hrs / 14.0, 1.0)  # 14h total deficit = 1.0

    task_backlog = compute_task_backlog_pressure(db, current_user.id)
    trend_penalty = compute_trend_penalty(db, current_user.id)

    norm_working_hours = min(weekly_hours / 55.0, 1.0)
    t_score = _compute_telemetry_score(norm_working_hours, deadline_pres, sleep_deficit_norm, task_backlog)

    # ── Step 2: ML model score ─────────────────────────────────────────────────
    ml_score_val: Optional[float] = None
    uses_ml_model = os.path.exists(MODEL_PATH)
    if uses_ml_model:
        try:
            model_input = pd.DataFrame([{
                "cgpa": request.cgpa if request.cgpa is not None else (current_user.cpi or 0),
                "daily_sleep_hours": request.daily_sleep_hours if request.daily_sleep_hours is not None else (current_user.sleep_hours or 7),
                "daily_study_hours": request.daily_study_hours if request.daily_study_hours is not None else (weekly_hours / 7),
                "physical_activity_hours": request.physical_activity_hours if request.physical_activity_hours is not None else 0,
                "social_support_score": request.social_support_score if request.social_support_score is not None else 5,
                "screen_time_hours": request.screen_time_hours if request.screen_time_hours is not None else (current_user.screen_time_hours or 3),
            }])
            ml_label = str(get_burnout_model().predict(model_input)[0])
            ml_score_val = float({"Low": 25, "Medium": 60, "High": 85}.get(ml_label, 50))
        except Exception:
            uses_ml_model = False

    # ── Step 3: Hybrid score ───────────────────────────────────────────────────
    if ml_score_val is not None:
        base_score = 0.50 * ml_score_val + 0.35 * t_score + 0.15 * trend_penalty * 100
    else:
        # Pure heuristic fallback
        workload = request.workload_factor if request.workload_factor is not None else min(norm_working_hours, 1.0)
        stress = request.stress_level if request.stress_level is not None else 3
        consistency = request.consistency_factor if request.consistency_factor is not None else 0.7
        base_score = calculate_burnout_score(
            weekly_hours, workload, stress, consistency,
            deadline_pres, sleep_deficit_norm, task_backlog
        )

    score = round(min(max(base_score, 0), 100), 2)
    risk_level = "High" if score > 65 else "Medium" if score > 40 else "Low"

    # Trend direction string
    if trend_penalty > 0.05:
        trend_str = "worsening"
    elif trend_penalty < -0.02:
        trend_str = "improving"
    else:
        trend_str = "stable"

    # Count active deadlines for recommendations
    now = datetime.utcnow()
    active_deadline_count = db.query(PlannerEvent).filter(
        PlannerEvent.userId == current_user.id,
        PlannerEvent.deadline_date != None,
        PlannerEvent.isCompleted == False,
        PlannerEvent.deletedAt == None,
    ).count()
    overdue_task_count = db.query(TaskLog).filter(
        TaskLog.student_id == current_user.id,
        TaskLog.completed == False,
        TaskLog.due_date != None,
        TaskLog.due_date < now,
    ).count()

    # ── Step 4: Recommendations ────────────────────────────────────────────────
    recommendations = _generate_burnout_recommendations(
        risk_level=risk_level,
        weekly_working_hours=weekly_hours,
        deadline_count=active_deadline_count,
        sleep_deficit_hours=sleep_deficit_hrs,
        overdue_task_count=overdue_task_count,
        has_ai=has_ai_services,
    )

    # ── Step 5: Persist ────────────────────────────────────────────────────────
    db_score = BurnoutScore(
        student_id=current_user.id,
        score=score,
        study_hours=request.study_hours,
        workload_factor=request.workload_factor,
        stress_level=request.stress_level,
        consistency_factor=request.consistency_factor,
        risk_level=risk_level,
        cgpa=request.cgpa,
        daily_sleep_hours=request.daily_sleep_hours,
        daily_study_hours=request.daily_study_hours,
        physical_activity_hours=request.physical_activity_hours,
        social_support_score=request.social_support_score,
        ml_screen_time_hours=request.screen_time_hours,
        weekly_working_hours=weekly_hours,
        deadline_pressure=deadline_pres,
        sleep_deficit_hours=sleep_deficit_hrs,
        task_backlog_score=task_backlog,
        telemetry_score=t_score,
        ml_score=ml_score_val,
    )
    db.add(db_score)
    db.commit()
    db.refresh(db_score)

    # ── Step 6: Auto-inject Smart Suggestions for Medium/High risk ─────────────
    suggestions_injected = False
    if risk_level in ("Medium", "High"):
        try:
            _replace_unpinned_suggestions(db, current_user)
            suggestions_injected = True
        except Exception:
            pass

    return AIResponse(
        message=f"Your burnout risk is {risk_level}.",
        data={
            "score": score,
            "ml_score": ml_score_val,
            "telemetry_score": t_score,
            "risk_level": risk_level,
            "signals": {
                "weekly_working_hours": weekly_hours,
                "deadline_pressure": deadline_pres,
                "sleep_deficit_hours": sleep_deficit_hrs,
                "task_backlog_score": task_backlog,
                "trend": trend_str,
            },
            "recommendations": recommendations,
            "suggestions_injected": suggestions_injected,
        },
    )


@router.get("/burnout-score/latest")
def get_latest_burnout_score(current_user=Depends(get_current_user), db: Session=Depends(get_db)):
    """Return the most recent burnout score without computing a new one."""
    latest = (
        db.query(BurnoutScore)
        .filter(BurnoutScore.student_id == current_user.id)
        .order_by(BurnoutScore.created_at.desc())
        .first()
    )
    if not latest:
        return {"exists": False}
    return {
        "exists": True,
        "score": latest.score,
        "ml_score": latest.ml_score,
        "telemetry_score": latest.telemetry_score,
        "risk_level": latest.risk_level,
        "signals": {
            "weekly_working_hours": latest.weekly_working_hours,
            "deadline_pressure": latest.deadline_pressure,
            "sleep_deficit_hours": latest.sleep_deficit_hours,
            "task_backlog_score": latest.task_backlog_score,
        },
        "created_at": latest.created_at.isoformat() if latest.created_at else None,
    }


@router.get("/burnout-history")
def get_burnout_history(
    days: int = 30,
    current_user=Depends(get_current_user),
    db: Session=Depends(get_db),
):
    """Return burnout score history for the sparkline chart."""
    cutoff = datetime.utcnow() - timedelta(days=min(days, 90))
    rows = (
        db.query(BurnoutScore)
        .filter(
            BurnoutScore.student_id == current_user.id,
            BurnoutScore.created_at >= cutoff,
        )
        .order_by(BurnoutScore.created_at.asc())
        .all()
    )
    return {
        "history": [
            {
                "date": r.created_at.isoformat() if r.created_at else None,
                "score": r.score,
                "ml_score": r.ml_score,
                "telemetry_score": r.telemetry_score,
                "risk_level": r.risk_level,
            }
            for r in rows
        ]
    }


@router.get("/working-hours")
def get_working_hours(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Return weekly working hours computed live from planner events. No DB writes."""
    hours = compute_weekly_working_hours(db, current_user.id)
    # If planner has no tagged events, fall back to profile value
    source = "planner"
    if hours == 0:
        hours = float(current_user.study_hours_per_week or 0)
        source = "profile_fallback"
    return {
        "weekly_working_hours": hours,
        "source": source,
    }


@router.get("/weekly-insights")
def get_weekly_insights(current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    one_week_ago = datetime.utcnow() - timedelta(days=7)

    result = db.query(
        func.count(TaskLog.id).label("total_tasks"),
        func.sum(case((TaskLog.completed == True, 1), else_=0)).label("completed_tasks"),
        func.sum(TaskLog.actual_hours).label("total_hours")
    ).filter(
        TaskLog.student_id == current_user.id,
        TaskLog.created_at >= one_week_ago
    ).first()

    total_tasks = result.total_tasks or 0
    completed_tasks = result.completed_tasks or 0
    total_hours = result.total_hours or 0

    return AIResponse(
        message="Weekly productivity insights",
        data={
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "completion_rate": round(completed_tasks / total_tasks * 100, 1) if total_tasks else 0,
            "total_hours_logged": total_hours,
        }
    )


@router.get("/test-gemini")
def test_gemini():
    if has_ai_services:
        return AIResponse(message=generate_test_response())
    return AIResponse(message="Gemini services disabled")


@router.get("/latest-chat")
def get_latest_chat(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.query(AIChat).filter(AIChat.student_id == current_user.id).order_by(AIChat.created_at.desc()).first()
    if not chat:
        return {"exists": False}
    return {
        "exists": True,
        "chat_id": chat.id,
        "title": chat.title,
        "messages": [{"role": m.role, "content": m.content} for m in chat.messages]
    }


@router.patch("/chat/{chat_id}")
def rename_chat(chat_id: int, request: RenameChatRequest, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    chat = db.query(AIChat).filter(AIChat.id == chat_id, AIChat.student_id == current_user.id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    chat.title = request.title
    db.commit()
    return {"message": "Renamed"}
