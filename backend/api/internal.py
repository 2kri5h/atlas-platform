"""Internal endpoints for external schedulers (Render Cron / GitHub Actions).

Protected by the X-Cron-Secret header matching the CRON_SECRET env var.
These routes are NOT part of the public API surface.
"""

import logging
import secrets

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db
from ..services.reminders import run_reminder_sweep

logger = logging.getLogger(__name__)

router = APIRouter()


def verify_cron_secret(x_cron_secret: str = Header(default="")) -> None:
    """Constant-time comparison so timing cannot leak the secret."""
    if not settings.CRON_SECRET:
        raise HTTPException(status_code=503, detail="Cron endpoints disabled: CRON_SECRET not configured")
    if not secrets.compare_digest(x_cron_secret, settings.CRON_SECRET):
        raise HTTPException(status_code=401, detail="Invalid cron secret")


@router.post("/cron/reminders")
def cron_reminders(db: Session = Depends(get_db), _auth: None = Depends(verify_cron_secret)):
    """Daily deadline-reminder email sweep. Trigger once per day."""
    result = run_reminder_sweep(db)
    logger.info("[Cron] Reminder sweep result: %s", result)
    return {"status": "ok", "result": result}
