# ITSP Platform - Agent Notes

## Quick Start Commands

```bash
# Backend (from repo root)
pip install -r requirements.txt
python init_db.py
uvicorn backend.api.main:app --reload --port 8000

# Frontend (from repo root)
cd frontend
npm install
npm run dev
```

## Critical Details

- Backend entry point is `backend.api.main:app`, NOT `backend.api.main`
- `init_db.py` must be run before starting the backend (seeds sample data and creates tables)
- `SECRET_KEY` environment variable must be set OR app raises `RuntimeError` at startup (a default exists in `backend/core/.env`)
- Database is auto-created at `data/itsp.db` on first run

## Architecture

- **Backend:** FastAPI + SQLAlchemy, API prefix `/api`
- **Frontend:** React + Vite + TypeScript, dev server port 3000
- **Database:** SQLite (dev) / MySQL (prod)
- Frontend in dev proxies `/api` -> `http://localhost:8000` (vite.config.ts)
- Frontend in Docker uses nginx with `proxy_pass http://backend:8000` (not localhost)

## Dev vs Prod Differences

| | Dev | Docker |
|---|---|---|
| Frontend | `npm run dev` (port 3000) | nginx on port 80 |
| API URL | `http://localhost:8000` | `http://backend:8000` |
| Hot reload | Vite HMR | None |

## No Test/Lint Infrastructure

This project has no configured test framework, linting, type-checking scripts, pre-commit hooks, or CI workflows. `npm run build` does run `tsc && vite build`.

## Test Accounts

| Roll Number | Password | Profile |
|---|---|---|
| 21001001 | password123 | 4th year, CS |
| 21001002 | password123 | 3rd year, Electrical |

## Key Files

- `backend/api/main.py` - FastAPI app entry, router registration, CORS config
- `backend/core/config.py` - Settings (DB URL, JWT config, SECRET_KEY)
- `init_db.py` - Database seeding script
- `frontend/vite.config.ts` - Dev proxy config
- `frontend/nginx.conf` - Production reverse proxy config
- `frontend/src/utils/api.ts` - Axios instance, all TypeScript interfaces

## API Structure

All routes prefixed with `/api`:
- `auth.py` - registration, login, current user
- `resources.py` - resource library CRUD
- `events.py` - events management
- `journeys.py` - senior journeys
- `planner.py` - task management
- `anonymous.py` - anonymous posts & replies
- `ai.py` - roadmap generation, burnout scoring