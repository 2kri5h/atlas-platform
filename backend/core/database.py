import os
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

import sys

db_url = settings.DATABASE_URL or settings.AI_DATABASE_URL


def configure_sqlite_connection(dbapi_connection, _connection_record):
    """Allow short, concurrent web requests to share SQLite safely."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA busy_timeout = 30000")
    cursor.execute("PRAGMA journal_mode = WAL")
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


def create_sqlite_engine(url: str):
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False, "timeout": 30},
    )
    event.listen(engine, "connect", configure_sqlite_connection)
    return engine


def create_resilient_engine(url: str):
    if "sqlite" in url:
        if ":memory:" not in url:
            raw_path = url.replace("sqlite:////", "/").replace("sqlite:///", "").replace("sqlite://", "").split("?")[0]
            abs_path = os.path.abspath(raw_path)
            dir_path = os.path.dirname(abs_path)
            try:
                if dir_path:
                    os.makedirs(dir_path, exist_ok=True)
                print(f"[Database] Initializing SQLite database at: {abs_path}")
                eng = create_sqlite_engine(url)
                with eng.connect() as conn:
                    pass
                return eng, url
            except Exception as e:
                print(f"[Database Warning] Failed to initialize database at '{url}' ({e}). Falling back to './data/itsp.db'...", file=sys.stderr)
                fallback_url = "sqlite:///./data/itsp.db"
                fallback_path = os.path.abspath("data/itsp.db")
                os.makedirs(os.path.dirname(fallback_path), exist_ok=True)
                eng = create_sqlite_engine(fallback_url)
                return eng, fallback_url
        else:
            eng = create_sqlite_engine(url)
            return eng, url
    else:
        # Production engine (PostgreSQL, MySQL, etc.) with robust pooling & pre-ping
        eng = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
            pool_recycle=300,
            pool_timeout=30,
        )
        return eng, url


engine, db_url = create_resilient_engine(db_url)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_sqlite_schema():
    """Add merge-era columns to an existing local SQLite database.

    SQLAlchemy's create_all creates missing tables but does not alter tables that
    already exist.
    """
    if "sqlite" not in db_url:
        return

    required_columns = {
        "students": {"study_hours_per_week": "FLOAT DEFAULT 0"},
        "resources": {
            "is_private": "BOOLEAN DEFAULT 0",
            "is_curated": "BOOLEAN DEFAULT 0",
        },
        "burnout_scores": {
            "risk_level": "VARCHAR(50)",
            "cgpa": "FLOAT",
            "daily_sleep_hours": "FLOAT",
            "daily_study_hours": "FLOAT",
            "physical_activity_hours": "FLOAT",
            "social_support_score": "FLOAT",
            "ml_screen_time_hours": "FLOAT",
            "weekly_working_hours": "FLOAT",
            "deadline_pressure": "FLOAT",
        },
        "user_api_keys": {
            "base_url": "VARCHAR(255)",
        },
    }

    inspector = inspect(engine)
    with engine.begin() as connection:
        for table_name, columns in required_columns.items():
            if not inspector.has_table(table_name):
                continue
            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, definition in columns.items():
                if column_name not in existing:
                    connection.execute(text(
                        f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"
                    ))
