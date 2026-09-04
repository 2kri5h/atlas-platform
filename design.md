# ATLAS IIT Bombay — Complete Product Redesign & Design System Specification
**Version:** 3.0.0 • **Author:** Lead UI/UX Architect & Frontend Systems Engineer  
**Aesthetic Benchmark:** Linear.app + Notion + Apple HIG + Vercel Geist  
**Target Viewports:** Desktop (1440px+), Laptop (1024px-1440px), Tablet (768px-1024px), Mobile App (320px-768px)

---

## 1. Executive Summary & Design Vision

### 1.1 The Challenge
ATLAS is the central student operating system for IIT Bombay, housing critical features across:
- **Academics & Scheduling:** Weekly Course Slot Planner, Timetable, Deadlines Manager, Exam alerts.
- **Email & Communications:** Email Intelligence Hub (Webmail + Gmail AI Briefing, Event Extraction).
- **Study & Materials:** Academic Resources Hub, Google Drive direct sync, My Library, Task Extraction.
- **Career & Mentorship:** Senior Placement Journeys, Role Roadmaps (SDE, AI/ML, Finance, Core).
- **Student Wellbeing & Community:** Anonymous Student Portal, Mental Health Helplines, AI Study Mentor & Burnout Telemetry.

However, the previous interface accumulated disjointed control bars, stacked banners, uneven button styles, scattered settings modals, and desktop-centric tables that felt cramped and clunky on tablets and smartphones.

### 1.2 The Solution
We are executing a ground-up redesign of **every single page, component, toggle, button, and navigation surface** into a **compact, high-end, daily-driver student operating system**:
1. **Linear + Notion Minimalist Aesthetic:**
   - Monochromatic, distraction-free obsidian canvas with crisp 1px borders (`rgba(255,255,255,0.08)` dark, `rgba(0,0,0,0.06)` light).
   - Single electric indigo accent (`#6366f1` / `#4f46e5`) with semantic cues for urgency (amber, emerald, rose).
   - High information density without visual clutter — zero cartoonish gradients or generic AI purple cards.
2. **Mobile/Tablet Native App Paradigm:**
   - **Desktop (>=1024px):** Ultra-sleek collapsible sidebar, command palette shortcuts (`⌘K`), compact bento dashboards, dual-hub pill switches.
   - **Tablet & Mobile (<=1024px & <=768px):** Transformed into a native mobile app shell:
     - Fixed bottom navigation bar with haptic icon feedback.
     - Swipeable horizontal tab strips with fluid indicators.
     - Bottom sheets / drawer panels for event inspection, deadline creation, and account settings.
     - Minimum 44px tap targets adhering to Apple Human Interface Guidelines and Android Material rules.
3. **Restrained Three.js Micro-Visual:**
   - A GPU-safe, subtle interactive particle constellation canvas on the Dashboard and Hero background that responds gently to cursor / device orientation, completely respecting `prefers-reduced-motion` and pausing when offscreen.
4. **Haptic Micro-Interactions (`better-ui`):**
   - Universal tactile scale on press: `scale(0.96)` for buttons, concentric border radii (`outer = inner + padding`), tabular numbers (`font-variant-numeric: tabular-nums`) for dates, times, and countdowns.

---

## 2. Design Tokens & Visual Architecture

### 2.1 Color Palette & Surface Tokens
ATLAS strictly locks to a single harmonious theme family with zero clashing tones.

```css
/* ── Monochromatic Dark Canvas (Default / Primary) ── */
--bg-canvas: #090d16;          /* Deepest obsidian blue */
--bg-surface: #0f172a;         /* Level 1 card surface */
--bg-surface-elevated: #162036;/* Level 2 modal & dropdown surface */
--bg-surface-subtle: #0b1120;  /* Inset inputs, code blocks, table headers */

--border-subtle: rgba(255, 255, 255, 0.07);
--border-default: rgba(255, 255, 255, 0.12);
--border-active: rgba(99, 102, 241, 0.5);

--accent-primary: #6366f1;     /* Electric Indigo */
--accent-hover: #4f46e5;
--accent-subtle: rgba(99, 102, 241, 0.12);

/* Semantic Indicators */
--state-success: #10b981;      /* Emerald */
--state-warning: #f59e0b;      /* Amber */
--state-danger: #ef4444;       /* Rose */
--state-info: #3b82f6;          /* Sky */

/* Typography */
--text-primary: #f8fafc;       /* Highest contrast text */
--text-secondary: #94a3b8;     /* Muted labels & subtitles */
--text-tertiary: #64748b;      /* Micro-metadata & placeholders */

/* ── Crisp Light Canvas (Toggle Option) ── */
[data-theme="light"] {
  --bg-canvas: #f8fafc;
  --bg-surface: #ffffff;
  --bg-surface-elevated: #ffffff;
  --bg-surface-subtle: #f1f5f9;
  --border-subtle: #e2e8f0;
  --border-default: #cbd5e1;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-tertiary: #94a3b8;
}
```

### 2.2 Typography Scale & Optical Hierarchy
- **Font Stack:** `'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif`.
- **Code & Numbers:** `'JetBrains Mono', 'SF Mono', monospace` with `font-variant-numeric: tabular-nums`.
- **Display H1 (Page Title):** `24px` desktop / `20px` mobile, `font-weight: 700`, `letter-spacing: -0.03em`.
- **Section H2:** `18px` desktop / `16px` mobile, `font-weight: 600`, `letter-spacing: -0.02em`.
- **Card H3:** `15px`, `font-weight: 600`.
- **Body Text:** `13.5px`, `line-height: 1.55`, `font-weight: 400`.
- **Micro-Labels & Metadata:** `11px`, `font-weight: 600`, `letter-spacing: 0.02em`.

### 2.3 Concentric Geometry & Depth (The Better-UI Formula)
- **Outer Card Radius:** `14px` (`--radius-card`)
- **Inner Button / Input Radius:** `8px` (`--radius-elem = 14px - 6px padding`)
- **Pill Tags:** `9999px`
- **Tactile Response:** `transform: scale(0.96)` with `cubic-bezier(0.16, 1, 0.3, 1)` on `:active`.
- **Elevation:** Replaced heavy black drop-shadows with subtle 1px inner highlight:
  `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 4px 16px -2px rgba(0, 0, 0, 0.4);`

---

## 3. Global App Shell & Mobile/Tablet Architecture

### 3.1 Adaptive Dual-Layout Navigation
The layout automatically shifts between a high-efficiency desktop workstation and an intuitive mobile/tablet app:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ DESKTOP (> 1024px)                                                         │
│ ┌───────────────┬─────────────────────────────────────────────────────────┐ │
│ │ SIDEBAR       │ TOP HEADER: Page Breadcrumbs | Sync Dot | Quick Action │ │
│ │ ATLAS [IITB]  ├─────────────────────────────────────────────────────────┤ │
│ │               │                                                         │ │
│ │ • Dashboard   │ MAIN CONTENT CANVAS (Max-width 1240px, auto centered)   │ │
│ │ • Planner     │                                                         │ │
│ │ • Deadlines   │                                                         │ │
│ │ • Email Hub   │                                                         │ │
│ │ • Resources   │                                                         │ │
│ │ • Events      │                                                         │ │
│ │ • Journeys    │                                                         │ │
│ │ • Anonymous   │                                                         │ │
│ │ • AI Mentor   │                                                         │ │
│ │ ───────────── │                                                         │ │
│ │ [Profile]     │                                                         │ │
│ │ [Timer]       │                                                         │ │
│ └───────────────┴─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ MOBILE / TABLET (< 1024px)                                                  │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ COMPACT APP BAR:  [ATLAS] / Page Name            [Timer] [Vault] [Menu] │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ SCROLLABLE CONTENT VIEW (Full width with 16px gutter)                   │ │
│ │                                                                         │ │
│ │ • Sticky segmented pills / hub switches (horizontal scroll)            │ │
│ │ • Compact card feed & single-line touch targets                         │ │
│ │ • Bottom padding: 80px (clears bottom navigation bar)                  │ │
│ ├─────────────────────────────────────────────────────────────────────────┤ │
│ │ FIXED BOTTOM APP DOCK (4 Primary Tabs + 1 Quick "More" Sheet Trigger):  │ │
│ │   [Dashboard]    [Planner]    [Deadlines]    [Email Hub]    [More...]   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Mobile-First Component Guidelines
1. **Bottom Sheet Drawers (`BottomSheet`):**
   - Replaces desktop modals on mobile viewports (`< 768px`).
   - Draggable pull-bar handle (`40px × 4px`, rounded), slide-up animation (`translateY(100%)` to `translateY(0)`), swipe-down to dismiss.
2. **Horizontal Pill Segmenters:**
   - Tabs like `All | Webmail | Personal` or `My Library | Explore` render as a fluid, horizontal scrolling track on mobile with zero line wrapping.
3. **Floating Pomodoro Timer:**
   - On desktop: Compact floating pill in bottom-right corner.
   - On mobile: Collapses into an icon badge in the top app bar with pulse state, expanding to a minimal bottom sheet on tap.

---

## 4. Feature Architecture & Page-by-Page Redesign

### 4.1 Dashboard (`/`) — Executive Command Center
- **Three.js Ambient Particle Grid:** Subtle background canvas rendered behind hero stats with low opacity (`0.15`), interacting with mouse/touch movements.
- **Bento Stat Grid:** 4 compact cards:
  1. *Active Tasks & Classes Today* (with live progress indicator).
  2. *Burnout Telemetry* (with integrated 14-day SVG sparkline and telemetry signals).
  3. *Logged Weekly Study Hours* (with progress bar towards weekly target).
  4. *Next Imminent Deadline* (countdown chip with color-coded urgency).
- **Today's Dynamic Timeline:**
  - Visual time-track of today's lecture slots and study blocks.
  - Next 48-Hour Deadline Radar with 1-click completion checkboxes.
- **Mobile/Tablet Optimization:** Collapses into a clean vertical single-column bento with horizontal swipe on quick links.

### 4.2 Planner & Timetable (`/planner`) — Weekly Student Operating System
- **View Toggle:** Fluid segmented pill: `Weekly Matrix` | `Day Focus` | `Agenda List`.
- **Compact Time Grid:**
  - Clean hourly rows (8:00 AM to 8:00 PM) with high-contrast slot chips.
  - Color-coding derived deterministically from course codes (e.g. `CS213`, `EE201`).
- **Event Inspector Drawer / Bottom Sheet:**
  - Tap any block to open a slide-in panel (desktop side drawer, mobile bottom sheet).
  - Notes editor + Checkpoint checklist with instant completion percentage.
  - Quick action: 1-click sync to Google Calendar / delete block.
- **Mobile/Tablet Layout:**
  - Day picker carousel at the top (`Mon | Tue | Wed | Thu | Fri | Sat | Sun`).
  - Day agenda view with vertical slot cards showing timing, classroom/venue, and instructor.

### 4.3 Deadlines & Tasks (`/deadlines`) — Kanban & Linear-Style List
- **Dual View Modes:**
  - `Linear List` (compact high-density rows with due chips and checkboxes).
  - `Kanban Board` (columns: *Overdue*, *Due Soon (≤3d)*, *Upcoming*, *Completed*).
- **Subtask Execution:**
  - Inline subtask progress bar directly on the deadline card (`3 of 5 completed`).
  - Quick subtask adder without opening heavy dialogs.
- **Unified Create Deadline Modal / Sheet:**
  - Clean form with quick date presets (`Today`, `Tomorrow`, `Next Week`, `Custom`).

### 4.4 Email Intelligence Hub (`/emails`) — Executive Digest & Sync
- **Apple-Inspired Dual-Hub Switcher:**
  - `Page 1: Summary Dashboard` (AI-synthesized daily briefing).
  - `Page 2: Detailed Mailbox` (Full thread view, search, bodies).
- **Page 1: Executive Bullet Briefing:**
  - Clean bullet items with glowing category dots (Amber for quiz, Rose for deadline, Blue for campus event, Emerald for applications, Indigo for general).
  - Natural single-line syntax with integrated dates and times:
    - `Quiz for CS213 is scheduled on 15 Sept at 10:00 AM in LA 101.`
    - `You have Assignment 3 due by 23:59 IST on 20 Sept.`
  - Far-right anchored **Detailed View →** button (`scale(0.96)` on press).
  - Scope Switcher: `All Mails Summary` | `Webmail Summary` | `Personal Mail Summary`.
- **Consolidated Accounts Modal:** Single dialog replacing scattered boxes with 3 clean tabs: IITB Webmail, Personal Gmail, AI Vault.

### 4.5 Academic Resources Hub (`/resources`) — My Library & Community Vault
- **Dual-Hub Switcher:**
  - `My Library` (Private notes, personal Google Drive folders, study links).
  - `Explore Repository` (Community-shared lecture notes, past papers, lab guides).
- **Google Drive Direct Integration:**
  - Direct folder browsing and multi-file upload directly into student's Drive.
  - Breadcrumb folder navigation and file-type icons.
- **Filter Bar:** Clean dropdowns for Department (`CS`, `EE`, `ME`, `All`) and Semester.

### 4.6 Campus Events & Workshops (`/events`)
- **Timeline & Agenda View:**
  - Upcoming events categorized by `Workshops`, `Talks`, `Competitions`, `Cultural`.
  - Date, time, and venue highlighted prominently.
  - 1-click **Add to Planner** and RSVP tracking.

### 4.7 Senior Placement Journeys (`/journeys`)
- **Domain Filter Pills:** `SDE` | `AI/ML` | `Finance` | `Core Engineering` | `Research` | `Consulting`.
- **Journey Roadmap Cards:**
  - Clean company badges, role titles, and graduation years.
  - Step-by-step preparation roadmaps with interview questions and resource links.
  - Upvote button with spring counter animation.

### 4.8 Anonymous Student Portal (`/anonymous`)
- **Safe & Supportive Environment:**
  - Prominent 24/7 Campus Counselor & Helpline banner at the top.
  - Domain filter tags and confidential post composer.
  - Threaded replies with privacy shields and timestamp indicators.

### 4.9 AI Assistant & Study Mentor (`/ai`)
- **Notion-Style Full Canvas Interface:**
  - Sidebar for chat history with `+ New Chat` trigger.
  - Smart suggestion chips (e.g. *"Plan my CS213 prep"*, *"Calculate burnout risk"*, *"Weekly workload audit"*).
  - Markdown message cards with syntax-highlighted code blocks and roadmap diagrams.
  - Integrated BYOK Gemini Vault toggle.

### 4.10 User Profile & Settings (`/profile`)
- **Single Consolidated Settings Surface:**
  - Section 1: Academic Identity (Roll number, department, year of study).
  - Section 2: Study Preferences & Weekly Target Hours.
  - Section 3: Integrations & API Vault (Google OAuth status, Gemini API key manager).
  - Section 4: Theme Preferences (Dark, Light, System).

### 4.11 Authentication (`/login`, `/register`)
- **Minimalist Centered Glass Card:**
  - Obsidian card surface with subtle inner border and logo header.
  - Clear roll number format validation (`e.g. 21001001`).
  - Tactile submit button with loading spinner state.

---

## 5. Three.js Ambient Motion Specification

### 5.1 Architecture
- Component: `src/components/ui/AmbientCanvas.tsx`
- Implementation:
  - Lightweight Three.js scene utilizing `THREE.BufferGeometry` with 120-180 particles connected by subtle distance-based lines.
  - Particles drift slowly with procedural sine-wave oscillation.
  - Responds gently to mouse coordinates or device orientation (mobile gyroscope) with smooth damping (`lerp(current, target, 0.05)`).
- Performance & Safety:
  - Canvas is `position: absolute; inset: 0; pointer-events: none; z-index: 0; opacity: 0.18;`.
  - Automatically pauses rendering (`cancelAnimationFrame`) when tab is blurred or element is out of viewport (`IntersectionObserver`).
  - Checks `window.matchMedia('(prefers-reduced-motion: reduce)')` and renders a static ambient gradient if enabled.

---

## 6. Implementation Roadmap & Execution Order

1. **Phase 1: Design Tokens, Global CSS & Typography**
   - Update `frontend/src/index.css` with clean Linear/Notion tokens, typography scale, concentric radii, and micro-scrollbar styling.
2. **Phase 2: App Shell, Responsive Layout & Bottom Dock**
   - Overhaul `Layout.tsx` and `Layout.css` with responsive desktop sidebar, mobile top header, and fixed native bottom navigation dock.
   - Install `three` & `@types/three` for the lightweight ambient canvas component.
3. **Phase 3: Dashboard & Planner Overhaul**
   - Redesign `Dashboard.tsx` and `Dashboard.css` with bento metrics, Today's timeline, and ambient visual.
   - Redesign `Planner.tsx` and `Planner.css` with compact timetable view, mobile day carousel, and bottom sheet event inspector.
4. **Phase 4: Deadlines, Email Hub & Resources Overhaul**
   - Polish `Deadlines.tsx` and `Deadlines.css` with Linear-style list and board switchers.
   - Ensure `EmailService.tsx` bullet briefing and detailed mailbox maintain the sleek bigtech standard.
   - Streamline `Resources.tsx` and `Resources.css` with compact Google Drive file tree and community vault.
5. **Phase 5: Journeys, Anonymous, AI Assistant & Profile**
   - Redesign `Journeys.tsx`, `Anonymous.tsx`, `AIAssistant.tsx`, and `Profile.tsx` to match the exact design tokens.
6. **Phase 6: Verification, Responsive Audit & Performance Checks**
   - Execute `npm run build` (`tsc && vite build`).
   - Validate responsive layouts across 320px, 768px, 1024px, and 1440px.
