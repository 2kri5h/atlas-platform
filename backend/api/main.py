import bcrypt
if not hasattr(bcrypt, "__about__"):
    bcrypt.__about__ = type("about", (), {"__version__": getattr(bcrypt, "__version__", "4.0.0")})

from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
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
        print(f"[Startup Warning] Failed to seed initial database: {e}")
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.vercel\.app|http://localhost:\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"},
    )

from . import auth, resources, events, journeys, planner, anonymous, ai
try:
    from . import campus_events
    has_campus_events = True
except ImportError:
    has_campus_events = False

try:
    from . import emails
    has_emails = True
except ImportError:
    has_emails = False

app.include_router(auth.router, prefix=f"{settings.API_PREFIX}/auth", tags=["auth"])
app.include_router(resources.router, prefix=f"{settings.API_PREFIX}/resources", tags=["resources"])
app.include_router(events.router, prefix=f"{settings.API_PREFIX}/events", tags=["events"])

if has_emails:
    app.include_router(emails.router, prefix="/api/emails", tags=["emails"])
if has_campus_events:
    app.include_router(campus_events.router, prefix=f"{settings.API_PREFIX}/campus-events", tags=["campus-events"])

app.include_router(journeys.router, prefix=f"{settings.API_PREFIX}/journeys", tags=["journeys"])
app.include_router(planner.router, prefix=f"{settings.API_PREFIX}/planner", tags=["planner"])
app.include_router(anonymous.router, prefix=f"{settings.API_PREFIX}/anonymous", tags=["anonymous"])
app.include_router(ai.router, prefix=f"{settings.API_PREFIX}/ai", tags=["ai"])


@app.get(f"{settings.API_PREFIX}/load", response_model=List[events.CapacityDay], tags=["events"])
def get_global_load(month: str, current_user=Depends(auth.get_current_user), db: Session = Depends(get_db)):
    return events.get_load(month, current_user, db)


@app.get("/")
def root():
    return {"message": "ITSP Platform API", "version": settings.VERSION}


@app.get("/health")
def health():
    return {"status": "healthy"}
