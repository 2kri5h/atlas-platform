# ITSP Platform - IIT Bombay Student Productivity

AI-powered student productivity platform for personalized academic roadmaps and adaptive scheduling.

## Features

- **Personalized Academic Roadmaps** - AI-generated learning paths based on domain, goals, and weak subjects
- **Smart Weekly Planner** - Task management with time tracking and workload balancing
- **Resource Library** - Senior-curated content across domains (SDE, AI/ML, Finance, Core, Research, Consulting)
- **Burnout Risk Scoring** - ML-based assessment of study patterns and workload
- **Progress Dashboard** - Productivity analytics and consistency tracking
- **Anonymous Portal** - Safe space for sensitive questions with mental health detection
- **Senior Journeys** - Structured experiences from past students
- **Events System** - Workshop and talk discovery with archives

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy
- **Frontend:** React + Vite + TypeScript
- **Database:** SQLite (dev) / MySQL (prod)
- **AI:** Scikit-learn for burnout scoring, rule-based roadmap generation

## Project Structure

```
itsp_project/
├── backend/
│   ├── api/              # FastAPI routers
│   │   ├── auth.py       # Authentication, registration
│   │   ├── resources.py  # Resource library CRUD
│   │   ├── events.py     # Events management
│   │   ├── journeys.py    # Senior journeys
│   │   ├── planner.py    # Task management
│   │   ├── anonymous.py   # Anonymous posts & replies
│   │   └── ai.py         # Roadmap generation, burnout scoring
│   ├── core/             # Config, database
│   └── models/           # SQLAlchemy models
├── frontend/
│   └── src/
│       ├── components/    # Layout
│       └── pages/        # All page components
├── data/                 # SQLite database
├── docker-compose.yml     # Docker deployment
└── init_db.py           # Database seeding
```

# ITSP Platform - IIT Bombay Student Productivity

AI-powered student productivity platform for personalized academic roadmaps and adaptive scheduling.

## Features

- **Personalized Academic Roadmaps** - AI-generated learning paths based on domain, goals, and weak subjects
- **Smart Weekly Planner** - Task management with time tracking and workload balancing
- **Resource Library** - Senior-curated content across domains (SDE, AI/ML, Finance, Core, Research, Consulting)
- **Burnout Risk Scoring** - ML-based assessment of study patterns and workload
- **Progress Dashboard** - Productivity analytics and consistency tracking
- **Anonymous Portal** - Safe space for sensitive questions with mental health detection
- **Senior Journeys** - Structured experiences from past students
- **Events System** - Workshop and talk discovery with archives

## Tech Stack

- **Backend:** FastAPI + SQLAlchemy
- **Frontend:** React + Vite + TypeScript
- **Database:** SQLite (dev) / MySQL (prod)
- **AI:** Scikit-learn for burnout scoring, rule-based roadmap generation

## Project Structure

```
itsp_project/
├── backend/
│   ├── api/              # FastAPI routers
│   │   ├── auth.py       # Authentication, registration
│   │   ├── resources.py  # Resource library CRUD
│   │   ├── events.py     # Events management
│   │   ├── journeys.py    # Senior journeys
│   │   ├── planner.py    # Task management
│   │   ├── anonymous.py   # Anonymous posts & replies
│   │   └── ai.py         # Roadmap generation, burnout scoring
│   ├── core/             # Config, database
│   └── models/           # SQLAlchemy models
├── frontend/
│   └── src/
│       ├── components/    # Layout
│       └── pages/        # All page components
├── data/                 # SQLite database
├── docker-compose.yml     # Docker deployment
└── init_db.py           # Database seeding
```

## Prerequisites

- Python 3.11.x (required by the pinned backend dependencies; Python 3.14 is not supported)
- Node.js 20+ and npm
- A Gemini API key in `.env` as `GEMINI_API_KEY` for the AI mentor features

The repository includes `.python-version` and the backend Docker image uses Python 3.11 to make the expected runtime explicit.

## Quick Start

### Option 1: Local Development

```bash
# Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python init_db.py        # Initialize DB with sample data
uvicorn backend.api.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Option 2: Docker

```bash
docker-compose up --build
```

## Test Accounts

After running `init_db.py`:

| Roll Number | Password | Profile |
|-------------|----------|---------|
| 21001001 | password123 | 4th year, CS, SDE/AI-ML |
| 21001002 | password123 | 3rd year, Electrical, Research/Core |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Register new student |
| POST | /api/auth/token | Login |
| GET | /api/auth/me | Get current user |
| GET | /api/resources/ | List resources |
| POST | /api/resources/ | Add resource |
| GET | /api/events/ | List events |
| GET | /api/journeys/ | List senior journeys |
| GET | /api/planner/ | List tasks |
| POST | /api/planner/ | Create task |
| GET | /api/anonymous/ | List posts |
| POST | /api/ai/roadmap | Generate roadmap |
| POST | /api/ai/burnout-score | Calculate burnout |

## Team Tasks

| Member | Responsibilities |
|--------|-----------------|
| **1** | Backend: Auth, Student profiles, Database schema, API integration |
| **2** | Frontend: Resources, Events, Journeys pages, upvote system |
| **3** | AI Features: Roadmap generator, Burnout scoring, Weekly insights |
| **4** | Frontend: Planner, Dashboard, Anonymous portal, Moderation |

## Phases

- **Phase 1 (Weeks 1-2):** Foundation - Auth, onboarding, domain pages
- **Phase 2 (Weeks 3-6):** Domain Hub - Journeys, resources, events
- **Phase 3 (Weeks 7-10):** AI Features - RAG assistant, roadmap, burnout
- **Phase 4 (Weeks 11-14):** Anonymous Portal, polish, user testing

## Development Notes

- Frontend runs on port 3000, proxies API to backend on 8000
- CORS is enabled for all origins (configure for production)
- JWT tokens expire in 30 minutes
- Anonymous posts auto-detect mental health keywords
- SQLite database is created automatically on first run

## Future Improvements

- [ ] RAG-based AI assistant using actual platform data
- [ ] Real-time notifications for events and reminders
- [ ] Mobile app (React Native)
- [ ] MySQL migration for production
- [ ] Email reminders for upcoming tasks
- [ ] Advanced analytics dashboard
- [ ] Senior verification system for replies

