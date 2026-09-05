import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.0")})

import logging
import uuid

logger = logging.getLogger("backend.api.main")

from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from typing import List
from sqlalchemy.orm import Session
from ..core.database import engine, Base, get_db, migrate_sqlite_schema
from ..core.config import settings
from .. import models

Base.metadata.create_all(bind=engine)
migrate_sqlite_schema()

if settings.AUTO_SEED_ON_STARTUP:
    try:
        from init_db import init_db
        init_db()
    except Exception as e:
        logger.warning(f"[Startup Warning] Failed to seed initial database: {e}")
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

# In production (non-sqlite DB or ENVIRONMENT=production), do not trust wildcard
# vercel.app previews — require an explicit CORS_ORIGINS allowlist.
_is_production = (
    settings.ENVIRONMENT.lower() == "production"
    or (settings.DATABASE_URL and not settings.DATABASE_URL.startswith("sqlite"))
)

if _is_production and settings.cors_origins_list == ["*"]:
    logger.warning(
        "[Security] CORS_ORIGINS='*' in production with allow_credentials=True is unsafe. "
        "Set CORS_ORIGINS to an explicit comma-separated origin list."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=(
        None if _is_production else r"https://.*\.vercel\.app|http://localhost:\d+"
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1024)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Log the full traceback server-side; return a generic message to clients.

    Returning str(exc) leaked internal details (SQL fragments, file paths).
    A request_id is logged and returned so support can correlate reports.
    """
    request_id = uuid.uuid4().hex[:12]
    logger.exception(
        "[Unhandled Exception] request_id=%s path=%s", request_id, request.url.path
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "request_id": request_id},
    )

from . import auth, resources, events, journeys, planner, anonymous, ai, integrations, dashboard
from . import lectures
from . import internal
try:
    from . import campus_events
    has_campus_events = True
except ImportError:
    has_campus_events = False

app.include_router(auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["auth"])
app.include_router(resources.router, prefix=f"{settings.API_PREFIX}/resources", tags=["resources"])
app.include_router(events.router, prefix=f"{settings.API_PREFIX}/events", tags=["events"])
app.include_router(integrations.router, prefix=f"{settings.API_PREFIX}/integrations", tags=["integrations"])

try:
    from . import emails
    app.include_router(emails.router, prefix=f"{settings.API_PREFIX}/emails", tags=["emails"])
    logger.info("[Router] Registered /api/emails router successfully.")
except Exception as e:
    logger.exception(f"[Router Warning] Could not register emails router: {e}")

if has_campus_events:
    app.include_router(campus_events.router, prefix=f"{settings.API_PREFIX}/campus-events", tags=["campus-events"])

app.include_router(journeys.router, prefix=f"{settings.API_PREFIX}/journeys", tags=["journeys"])
app.include_router(planner.router, prefix=f"{settings.API_PREFIX}/planner", tags=["planner"])
app.include_router(anonymous.router, prefix=f"{settings.API_PREFIX}/anonymous", tags=["anonymous"])
app.include_router(ai.router, prefix=f"{settings.API_PREFIX}/ai", tags=["ai"])
app.include_router(internal.router, prefix=f"{settings.API_PREFIX}/internal", tags=["internal"])
app.include_router(dashboard.router, prefix=f"{settings.API_PREFIX}/dashboard", tags=["dashboard"])
app.include_router(lectures.router, prefix=f"{settings.API_PREFIX}/lectures", tags=["lectures"])


@app.get(f"{settings.API_PREFIX}/load", response_model=List[events.CapacityDay], tags=["events"])
def get_global_load(month: str, current_user=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return events.get_load(month, current_user, db)


@app.get("/")
def root():
    return {"message": "ITSP Platform API", "version": settings.VERSION}


@app.get("/health")
def health():
    return {"status": "healthy"}
