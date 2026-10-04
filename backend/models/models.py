from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum as SQLEnum, UniqueConstraint, LargeBinary
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from ..core.database import Base


class DomainEnum(enum.Enum):
    SDE = "sde"
    AI_ML = "ai_ml"
    FINANCE = "finance"
    CORE = "core"
    RESEARCH = "research"
    CONSULTING = "consulting"


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    roll_number = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    branch = Column(String(50))
    year = Column(Integer, default=1)
    domains = Column(String(200))
    study_hours_per_week = Column(Float, default=0)
    goals = Column(Text)
    weak_subjects = Column(Text)
    wakingHoursPerDay = Column(Integer, default=16)
    cpi = Column(Float)
    sleep_hours = Column(Float)
    screen_time_hours = Column(Float)
    role = Column(String(20), default="student", nullable=False)  # "student" | "admin"
    created_at = Column(DateTime, default=datetime.utcnow)

    resources = relationship("Resource", back_populates="uploader")
    journeys = relationship("SeniorJourney", back_populates="author")
    tasks = relationship("TaskLog", back_populates="student")
    burnout_scores = relationship("BurnoutScore", back_populates="student")
    planner_events = relationship("PlannerEvent", back_populates="user")
    ai_chats = relationship("AIChat", back_populates="student")
    smart_suggestions = relationship("SmartSuggestion", back_populates="student")
    api_keys = relationship("UserAPIKey", back_populates="student", cascade="all, delete-orphan")
    google_account = relationship("GoogleAccount", back_populates="student", uselist=False, cascade="all, delete-orphan")



class AIChat(Base):
    __tablename__ = "ai_chats"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    title = Column(String(200), default="AI Roadmap")
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="ai_chats")
    messages = relationship("AIMessage", back_populates="chat", cascade="all, delete-orphan")


class AIMessage(Base):
    __tablename__ = "ai_messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("ai_chats.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    chat = relationship("AIChat", back_populates="messages")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    url = Column(String(500))
    content = Column(Text)
    domain = Column(String(50), nullable=False)
    course = Column(String(100))
    resource_type = Column(String(50))
    upvotes = Column(Integer, default=0)
    uploader_id = Column(Integer, ForeignKey("students.id"))
    is_private = Column(Boolean, default=False)
    is_curated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    uploader = relationship("Student", back_populates="resources")


class ResourceUpvote(Base):
    __tablename__ = "resource_upvotes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('student_id', 'resource_id', name='unique_user_resource_upvote'),
    )


class ResourceBookmark(Base):
    __tablename__ = "resource_bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('student_id', 'resource_id', name='unique_user_resource_bookmark'),
    )


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    event_date = Column(DateTime)
    location = Column(String(200))
    domain = Column(String(50))
    organizer = Column(String(100))
    created_by_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    slides_link = Column(String(500))
    recording_link = Column(String(500))
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class SeniorJourney(Base):
    __tablename__ = "senior_journeys"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("students.id"))
    title = Column(String(200), nullable=False)
    domain = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    year_completed = Column(Integer)
    tags = Column(String(200))
    upvotes = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    author = relationship("Student", back_populates="journeys")


class JourneyUpvote(Base):
    __tablename__ = "journey_upvotes"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    journey_id = Column(Integer, ForeignKey("senior_journeys.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('student_id', 'journey_id', name='unique_user_journey_upvote'),
    )


class AnonymousPost(Base):
    __tablename__ = "anonymous_posts"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    domain = Column(String(50))
    is_mental_health = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    replies = relationship("PostReply", back_populates="post", cascade="all, delete-orphan")
    reports = relationship("AnonymousPostReport", back_populates="post", cascade="all, delete-orphan")


class AnonymousPostReport(Base):
    __tablename__ = "anonymous_post_reports"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("anonymous_posts.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    post = relationship("AnonymousPost", back_populates="reports")

    __table_args__ = (
        UniqueConstraint("post_id", "student_id", name="unique_post_student_report"),
    )


class PostReply(Base):
    __tablename__ = "post_replies"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("anonymous_posts.id"))
    content = Column(Text, nullable=False)
    is_senior_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("AnonymousPost", back_populates="replies")


# ── Decoupled Anonymous V2 Models ──────────────────────────────────────────

class AnonymousAccount(Base):
    __tablename__ = "anonymous_accounts"

    id = Column(String(36), primary_key=True, index=True)
    secret_hash = Column(LargeBinary, unique=True, nullable=False, index=True)  # SHA-256 of recovery key
    valid_until = Column(DateTime, nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, suspended, banned
    created_at = Column(DateTime, default=datetime.utcnow)

    posts = relationship("AnonymousPostV2", back_populates="author_account")
    replies = relationship("AnonymousReplyV2", back_populates="author_account")


class AnonymousIssuance(Base):
    """Tracks whether a student claimed a voucher this semester without linking to account."""
    __tablename__ = "anonymous_issuances"

    student_hmac = Column(LargeBinary, primary_key=True)
    semester = Column(String(20), primary_key=True)
    issued_at = Column(DateTime, default=datetime.utcnow)


class SpentVoucher(Base):
    """Records spent voucher nonces to prevent double-spending."""
    __tablename__ = "anonymous_spent_vouchers"

    token_hash = Column(LargeBinary, primary_key=True)
    semester = Column(String(20), nullable=False)
    spent_at = Column(DateTime, default=datetime.utcnow)


class AnonymousCategory(Base):
    __tablename__ = "anonymous_categories"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    sort_order = Column(Integer, default=0)

    posts = relationship("AnonymousPostV2", back_populates="category")


class AnonymousPostV2(Base):
    __tablename__ = "anonymous_posts_v2"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(32), unique=True, index=True, nullable=False)
    category_id = Column(Integer, ForeignKey("anonymous_categories.id"), nullable=False)

    # Hybrid identity: either anonymous (account_id) or identified (student_id)
    is_anonymous = Column(Boolean, default=True, nullable=False)
    account_id = Column(String(36), ForeignKey("anonymous_accounts.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)

    kind = Column(String(20), default="grievance", nullable=False)  # "grievance" | "conversation"
    title = Column(String(250), nullable=False)
    body = Column(Text, nullable=False)
    is_official = Column(Boolean, default=False, nullable=False)
    is_flagged = Column(Boolean, default=False, nullable=False)
    images = Column(Text, default="[]", nullable=False)  # JSON list of sanitized image filenames

    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    metoo = Column(Integer, default=0, nullable=False)
    reply_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    category = relationship("AnonymousCategory", back_populates="posts")
    author_account = relationship("AnonymousAccount", back_populates="posts")
    author_student = relationship("Student")
    replies = relationship("AnonymousReplyV2", back_populates="post", cascade="all, delete-orphan", foreign_keys="[AnonymousReplyV2.post_id]")


class AnonymousReplyV2(Base):
    __tablename__ = "anonymous_replies_v2"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("anonymous_posts_v2.id", ondelete="CASCADE"), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("anonymous_replies_v2.id", ondelete="CASCADE"), nullable=True, index=True)

    # Hybrid identity
    is_anonymous = Column(Boolean, default=True, nullable=False)
    account_id = Column(String(36), ForeignKey("anonymous_accounts.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)

    body = Column(Text, nullable=False)
    is_official = Column(Boolean, default=False, nullable=False)
    is_senior_verified = Column(Boolean, default=False, nullable=False)
    upvotes = Column(Integer, default=0, nullable=False)
    downvotes = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    post = relationship("AnonymousPostV2", back_populates="replies", foreign_keys=[post_id])
    parent = relationship("AnonymousReplyV2", remote_side=[id], backref="children")
    author_account = relationship("AnonymousAccount", back_populates="replies")
    author_student = relationship("Student")


class AnonymousVote(Base):
    __tablename__ = "anonymous_votes"

    voter_key = Column(String(64), primary_key=True)  # hash(account_id or student_id)
    target_type = Column(String(10), primary_key=True)  # "post" | "reply"
    target_id = Column(Integer, primary_key=True)
    vote = Column(Integer, nullable=False)  # +1 or -1
    created_at = Column(DateTime, default=datetime.utcnow)


class AnonymousMeToo(Base):
    __tablename__ = "anonymous_metoos"

    voter_key = Column(String(64), primary_key=True)
    post_id = Column(Integer, ForeignKey("anonymous_posts_v2.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AnonymousReport(Base):
    __tablename__ = "anonymous_reports"

    id = Column(Integer, primary_key=True, index=True)
    reporter_hash = Column(LargeBinary, nullable=False, index=True)  # HMAC to enforce 1-report per user anonymously
    target_type = Column(String(10), nullable=False)  # "post" | "reply"
    target_id = Column(Integer, nullable=False, index=True)
    reason = Column(String(50), nullable=False)  # "hate", "harassment", "spam", "danger", "identifying", "other"
    note = Column(Text, default="")
    handled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)



class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    title = Column(String(200), nullable=False)
    description = Column(Text)
    domain = Column(String(50))
    priority = Column(Integer, default=2)
    estimated_hours = Column(Float, default=1)
    actual_hours = Column(Float, default=0)
    completed = Column(Boolean, default=False)
    due_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="tasks")


class BurnoutScore(Base):
    __tablename__ = "burnout_scores"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    score = Column(Float, nullable=False)
    study_hours = Column(Float)
    workload_factor = Column(Float)
    stress_level = Column(Integer)
    consistency_factor = Column(Float)
    risk_level = Column(String(50))
    cgpa = Column(Float)
    daily_sleep_hours = Column(Float)
    daily_study_hours = Column(Float)
    physical_activity_hours = Column(Float)
    social_support_score = Column(Float)
    ml_screen_time_hours = Column(Float)
    weekly_working_hours = Column(Float)   # auto-computed from PlannerEvent (isWorkingHour=True, last 7 days)
    deadline_pressure = Column(Float)      # deterministic load signal 0–1
    sleep_deficit_hours = Column(Float)    # hours of sleep below weekly baseline
    task_backlog_score = Column(Float)     # weighted overdue task backlog 0–1
    telemetry_score = Column(Float)        # combined planner telemetry sub-score 0–100
    ml_score = Column(Float)              # raw ML model numeric output (25/60/85)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="burnout_scores")


class PlannerEvent(Base):
    __tablename__ = "planner_events"

    id = Column(Integer, primary_key=True, index=True)
    userId = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    date = Column(DateTime, nullable=True, index=True)
    startTime = Column(String(5), nullable=False)  # HH:MM
    endTime = Column(String(5), nullable=False)  # HH:MM
    description = Column(Text, nullable=True)
    location = Column(String(200), nullable=True)
    tag = Column(String(20), nullable=False)  # CRITICAL, IMPORTANT, OPTIONAL
    category = Column(String(20), nullable=False)  # CLASS, EXAM, PERSONAL, SLEEP, RECREATION, OTHER
    isWorkingHour = Column(Boolean, default=False)
    link = Column(String(500), nullable=True)
    isRecurring = Column(Boolean, default=False)
    recurrenceDay = Column(Integer, nullable=True)  # 0=Sun, 1=Mon, ..., 6=Sat
    isCompleted = Column(Boolean, default=False, nullable=False)
    userComment = Column(Text, nullable=True)
    deletedAt = Column(DateTime, nullable=True, index=True)
    exdates = Column(Text, nullable=True)
    deadline_date = Column(DateTime, nullable=True)
    deadline_label = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("Student", back_populates="planner_events")
    subtasks = relationship("DeadlineSubtask", back_populates="deadline", cascade="all, delete-orphan", order_by="DeadlineSubtask.order.asc(), DeadlineSubtask.created_at.asc()")


class DeadlineSubtask(Base):
    __tablename__ = "deadline_subtasks"

    id = Column(Integer, primary_key=True, index=True)
    deadline_id = Column(Integer, ForeignKey("planner_events.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    is_completed = Column(Boolean, default=False, nullable=False)
    order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    deadline = relationship("PlannerEvent", back_populates="subtasks")


class SmartSuggestion(Base):
    __tablename__ = "smart_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    title = Column(String(200), nullable=False)
    reason = Column(Text, nullable=False)
    action_steps = Column(Text, nullable=False, default="[]")
    priority = Column(Integer, default=2)
    status = Column(String(20), default="active")
    is_pinned = Column(Boolean, default=False)
    resource_id = Column(Integer, ForeignKey("resources.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="smart_suggestions")
    resource = relationship("Resource")


class UserAPIKey(Base):
    __tablename__ = "user_api_keys"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    provider = Column(String(30), nullable=False)  # "gemini", "openai", "anthropic", "xai", "deepseek", "groq", "openrouter", "mistral", "custom"
    encrypted_key = Column(Text, nullable=False)
    model_name = Column(String(100), nullable=True)  # e.g., "gemini-2.5-pro", "claude-3-7-sonnet", "deepseek-r1", "llama-3.3-70b"
    base_url = Column(String(255), nullable=True)  # custom OpenAI-compatible endpoint URL (e.g. for Ollama, vLLM, DeepSeek, Groq, OpenRouter)
    is_active = Column(Boolean, default=True)

    last_validated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="api_keys")

    __table_args__ = (
        UniqueConstraint('student_id', 'provider', name='unique_student_provider_key'),
    )


class GoogleAccount(Base):
    __tablename__ = "google_accounts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), unique=True, nullable=False, index=True)
    email = Column(String(150), nullable=False)
    name = Column(String(150), nullable=True)
    picture = Column(String(500), nullable=True)
    encrypted_access_token = Column(Text, nullable=False)
    encrypted_refresh_token = Column(Text, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    scopes = Column(Text, nullable=True)
    drive_root_folder_id = Column(String(100), nullable=True)
    calendar_id = Column(String(150), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student = relationship("Student", back_populates="google_account")


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(64), unique=True, index=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)



# Soft delete before_compile event listener
from sqlalchemy import event
from sqlalchemy.orm import Query

@event.listens_for(Query, "before_compile", retval=True)
def filter_deleted_planner_events(query):
    for desc in query.column_descriptions:
        entity = desc.get('entity') if isinstance(desc, dict) else None
        if entity and hasattr(entity, 'deletedAt'):
            if not query._execution_options.get('include_deleted', False):
                query = query.enable_assertions(False).filter(entity.deletedAt == None)
    return query
