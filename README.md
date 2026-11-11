#ITSP Platform — AI-Powered Student Productivity#

An AI-powered B2B EdTech platform developed at IIT Bombay to help educational institutions deliver personalized academic planning, career guidance, and student productivity support.

IIT Bombay Summer Project — Among Top Teams | ₹30,000 Funding | IIT Bombay Groww Programme

Overview

ITSP Platform is a full-stack student productivity and academic guidance platform designed to bridge the gap between students' academic goals and available institutional resources.

The platform combines personalized learning roadmaps, intelligent scheduling, curated resources, productivity analytics, and student well-being support into a unified ecosystem.

Initially developed as part of an IIT Bombay summer project, ITSP is now being developed further through IIT Bombay's Groww Programme, with a long-term vision of becoming a scalable B2B solution for educational institutions.

Recognition & Institutional Support

- Top Summer Project Team: Recognized among the top-performing teams in an IIT Bombay summer project initiative.
- ₹30,000 Funding: Received development funding through IIT Bombay's Groww Programme.
- Institutional Collaboration: Currently working with IIT Bombay through the Groww Programme to further develop and refine the platform.
- B2B Product Vision: Designed for institutional adoption, enabling universities to provide personalized academic guidance and student support at scale.

Key Features

Feature| Description
Personalized Academic Roadmaps| AI-assisted learning paths based on student goals, interests, and weak subjects
Smart Weekly Planner| Task scheduling, workload balancing, and time tracking
Resource Library| Senior-curated resources for SDE, AI/ML, Finance, Research, Core, and Consulting
Burnout Risk Assessment| ML-based analysis of study patterns and workload
Progress Dashboard| Productivity insights, progress visualization, and consistency tracking
Anonymous Student Portal| Anonymous discussions with keyword-based mental health concern detection
Senior Journeys| Structured academic and career experiences shared by seniors
Events & Workshops| Discovery of institutional events, workshops, and archived sessions

Tech Stack

Layer| Technologies
Frontend| React, TypeScript, Vite
Backend| Python, FastAPI, SQLAlchemy
Database| SQLite (Development), MySQL (Planned Production)
AI / ML| Scikit-learn, Rule-Based Recommendation Systems
AI Integration| Google Gemini API
Authentication| JWT
Deployment| Docker, Docker Compose

System Architecture

                  Student / Institution
                           |
                  React + TypeScript
                           |
                      REST APIs
                           |
                        FastAPI
                           |
          +----------------+----------------+
          |                |                |
     Authentication    AI / ML Engine   Core Services
          |                |                |
          |           Roadmap Generator     |
          |           Burnout Scoring       |
          |                |                |
          +----------------+----------------+
                           |
                       SQLAlchemy
                           |
                    SQLite / MySQL

Project Structure

itsp_project/
├── backend/
│   ├── api/              # REST API endpoints
│   ├── core/             # Configuration and database
│   └── models/           # Database models
├── frontend/
│   └── src/
│       ├── components/   # Reusable UI components
│       └── pages/        # Application pages
├── data/                 # Development database
├── init_db.py            # Database initialization
├── requirements.txt      # Python dependencies
└── docker-compose.yml    # Container configuration

Getting Started

Prerequisites

- Python 3.11
- Node.js 20+
- npm
- Gemini API key (for Gemini-powered features)

Local Development

1. Clone the repository

git clone <repository-url>
cd itsp_project

2. Start the backend

python -m venv .venv

Activate the virtual environment and install dependencies:

pip install -r requirements.txt
python init_db.py
uvicorn backend.api.main:app --reload --port 8000

3. Start the frontend

Open another terminal:

cd frontend
npm install
npm run dev

4. Configure AI features

Add your Gemini API key to the project's ".env" file:

GEMINI_API_KEY=your_api_key_here

Alternatively, run the application using Docker:

docker-compose up --build

AI & Machine Learning

ITSP incorporates AI-assisted features to improve student planning and productivity.

- Academic Roadmap Generation: Personalized learning recommendations based on academic interests, goals, and identified weaknesses.
- Burnout Risk Scoring: Scikit-learn-based assessment of workload and study patterns to estimate potential burnout risk.
- Adaptive Planning: Workload-aware task organization and productivity tracking.
- Student Support: Anonymous discussion functionality with keyword-based detection of potentially sensitive mental health concerns.

Note: Burnout scoring is intended as a productivity and well-being indicator, not a clinical diagnosis.

Development Roadmap

- [x] Full-stack application architecture
- [x] Student authentication and profiles
- [x] Resource library and events management
- [x] Academic roadmap generation
- [x] Weekly planner and productivity dashboard
- [x] Burnout risk scoring
- [x] Anonymous student discussion portal
- [ ] Retrieval-Augmented Generation (RAG) assistant
- [ ] Real-time notifications and reminders
- [ ] Advanced institutional analytics
- [ ] Production database migration
- [ ] Multi-institution support and deployment
- [ ] Mobile application

Vision & Impact

ITSP is being developed with a B2B institutional model, where colleges and universities can provide students with a centralized platform for academic planning, career exploration, and productivity management.

Our goal is to transform fragmented academic resources and student support systems into a personalized, accessible, and scalable institutional solution.

Project Status

Active Development — IIT Bombay Groww Programme

Originally developed as an IIT Bombay summer project, ITSP is currently undergoing further development and refinement with institutional support and ₹30,000 in development funding.

---

Built at IIT Bombay | AI for Education | B2B EdTech