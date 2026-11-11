# ITSP Platform — AI-Powered Student Productivity

**An institution-focused B2B EdTech platform developed at IIT Bombay for personalized academic planning, career guidance, and student productivity.**

**Recognition:** Among the top teams in an IIT Bombay summer project · **Funding:** ₹30,000 · **Current programme:** IIT Bombay Groww Programme

## Overview

ITSP is a full-stack platform that brings academic planning, curated career resources, productivity tracking, and student support into one place. Originally developed as an IIT Bombay summer project, it is being refined through the **IIT Bombay Groww Programme** with a focus on a **B2B model for educational institutions**.

## Recognition & Institutional Support

- **Summer project recognition:** Selected among the top teams in an IIT Bombay summer project.
- **₹30,000 funding:** Received development funding through the IIT Bombay Groww Programme.
- **Institutional collaboration:** Currently working with IIT Bombay through the programme to develop and refine ITSP.
- **B2B direction:** Building for adoption by colleges and universities, rather than only individual students.

## Features

| Feature | What it does |
| --- | --- |
| Personalized Academic Roadmaps | Generates learning paths based on goals, domains, and weak subjects. |
| Smart Weekly Planner | Organizes tasks, tracks time, and balances workloads. |
| Resource Library | Provides senior-curated resources for SDE, AI/ML, Finance, Core, Research, and Consulting. |
| Burnout Risk Scoring | Uses ML-based assessment of study patterns and workloads. |
| Progress Dashboard | Visualizes productivity, progress, and consistency. |
| Anonymous Portal | Supports anonymous questions and keyword-based detection of sensitive mental-health concerns. |
| Senior Journeys | Shares structured academic and career experiences from seniors. |
| Events System | Helps students discover workshops, talks, and archived events. |

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI, SQLAlchemy |
| Database | SQLite (development); MySQL (planned production) |
| AI / ML | Scikit-learn, rule-based roadmap generation, Gemini API integration |
| Authentication | JWT |
| Deployment | Docker, Docker Compose |

## Architecture

```text
React + TypeScript (Frontend)
            |
         REST API
            |
       FastAPI Backend
       /      |       \
   Auth   AI / ML   Platform Services
          |         (Planner, Resources,
     Roadmaps &      Events, Journeys,
     Risk Scoring    Anonymous Portal)
       \      |       /
          SQLAlchemy
              |
        SQLite / MySQL
```

## Repository Structure

```text
atlas-platform/
├── backend/
│   ├── api/             # Authentication and feature endpoints
│   ├── core/            # Configuration and database
│   └── models/          # SQLAlchemy models
├── frontend/
│   └── src/
│       ├── components/  # Shared UI components
│       └── pages/       # Feature pages
├── data/                # Local development database
├── init_db.py           # Database initialization and seed data
├── requirements.txt     # Python dependencies
└── docker-compose.yml   # Container setup
```

## Getting Started

### Prerequisites

- Python **3.11**
- Node.js **20+** and npm
- A Gemini API key for Gemini-powered features

### Run locally

1. Clone the repository:

   ```bash
   git clone https://github.com/2kri5h/atlas-platform.git
   cd atlas-platform
   ```

2. Create a virtual environment and install backend dependencies:

   ```bash
   python -m venv .venv
   ```

   Activate it on Windows (PowerShell):

   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

   Or on macOS/Linux:

   ```bash
   source .venv/bin/activate
   ```

   Then run:

   ```bash
   python -m pip install -r requirements.txt
   python init_db.py
   uvicorn backend.api.main:app --reload --port 8000
   ```

3. In a separate terminal, start the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. For Gemini-powered features, set the following in your local `.env` file (never commit a real API key):

   ```dotenv
   GEMINI_API_KEY=your_api_key_here
   ```

### Docker alternative

```bash
docker compose up --build
```

## Selected API Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Register a student |
| POST | `/api/auth/token` | Log in |
| GET | `/api/resources/` | Browse resources |
| GET | `/api/events/` | Browse events |
| GET | `/api/journeys/` | Browse senior journeys |
| GET / POST | `/api/planner/` | View or create tasks |
| GET | `/api/anonymous/` | Browse anonymous posts |
| POST | `/api/ai/roadmap` | Generate a roadmap |
| POST | `/api/ai/burnout-score` | Estimate burnout risk |

## Roadmap

**Current platform scope:** Student accounts, academic roadmaps, planning, resources, events, senior journeys, anonymous discussions, and productivity analytics.

**Planned enhancements:**

- [ ] RAG assistant grounded in platform resources
- [ ] Real-time notifications and reminders
- [ ] Advanced institutional analytics
- [ ] Production MySQL migration
- [ ] Multi-institution deployment and administration
- [ ] Mobile application

## Vision

ITSP aims to help institutions offer personalized academic and career support through one scalable platform, combining student-facing planning tools with a foundation for institution-wide deployment.

**Status:** Active development through the IIT Bombay Groww Programme.

---

*Built at IIT Bombay · AI for Education · B2B EdTech*
