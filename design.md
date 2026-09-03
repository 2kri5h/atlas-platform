# ATLAS IIT Bombay — Frontend Redesign Design Specification

**Version:** 1.0  
**Source of Truth:** `apple-design.md` + `apple.html` (Apple Product-Tile Whiteout Design System)  
**Target Platform:** ATLAS IIT Bombay Student Productivity Platform (`Team-atlas-ITSP`)  
**Stack:** React 18 + Vite + TypeScript  

---

## 1. DESIGN SYSTEM & TOKENS

### 1.1 Color Palette

| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `--background` | `#F5F5F7` | `#1D1D1F` | Page resting surface (72% of rendered pixels) |
| `--surface` | `#FFFFFF` | `#29292E` | Card/panel backgrounds, alternating panels |
| `--surface-dark` | `#000000` | `#000000` | Full-bleed contrast-break panels |
| `--surface-elevated` | `#FFFFFF` | `#29292E` | Modals, dropdowns, toasts |
| `--text-primary` | `#1D1D1F` | `#F5F5F7` | Headlines, body copy on light panels |
| `--text-secondary` | `#2997FF` | `#2997FF` | Lighter link tone for dark panels & hover |
| `--text-tertiary` | `#6E6E73` | `#86868B` | Captions, metadata, timestamps |
| `--accent` | `#0071E3` | `#0071E3` | **Single accent** — pill fills, pill outlines, links |
| `--accent-hover` | `#0076DF` | `#0076DF` | Button hover states |
| `--link` | `#0066CC` | `#2997FF` | Inline text links |
| `--border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.12)` | Dividers, input borders |
| `--border-light` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` | Subtle dividers |
| `--surface-hover` | `#F5F5F7` | `#2D2D30` | Hover states on surfaces |
| `--surface-subtle` | `#EDEDED` | `#3A3A3E` | Active nav backgrounds |
| `--danger` | `#EF4444` | `#EF4444` | Errors, high risk, overdue |
| `--warning` | `#F59E0B` | `#F59E0B` | Warnings, medium risk |
| `--success` | `#10B981` | `#10B981` | Success, low risk, optimal |
| `--ice-blue` | `#D8F0F0` | — | Single gradient wash (one promo tile only) |

**Guardrails:**
- `#0071E3`/`#0066CC` is rationed strictly to buttons and inline links — never tint headlines, backgrounds, or icons with it.
- No colorful UI gradients. Two measured gradients only:
  1. `radial-gradient(100% 33% at 0% 100%, rgba(0, 0, 0, 0.5) 0%, rgba(255, 255, 255, 0))` — corner scrim.
  2. `linear-gradient(rgba(29, 29, 31, 0.4) 0%, rgba(29, 29, 31, 0) 70px, rgba(29, 29, 31, 0) calc(100% - 70px), rgba(29, 29, 31, 0.4) 100%)` — top/bottom vignette on media tiles.
- `#F5F5F7` is the true resting surface (~72% of pixels), not pure white or gradients.

### 1.2 Typography Scale

**Font Stack:** `"SF Pro Display", "SF Pro Text", Inter, -apple-system, BlinkMacSystemFont, sans-serif`

| Role | Font Family | Size | Weight | Line Height | Letter Spacing | Usage |
|------|-------------|------|--------|-------------|----------------|-------|
| `headline-md` | SF Pro Display | 56px | 600 | 1.07 | -0.3px | Primary hero titles, big statements |
| `label-md` | SF Pro Display | 40px | 600 | 1.10 | -0.3px | Section heads |
| `display-lg` | SF Pro Text | 34px | 600 | 1.47 | -0.4px | Secondary display |
| `body-md` | SF Pro Display | 28px | 400 | 1.14 | 0 | Subheadlines under big titles |
| `body` | SF Pro Text | 17px | 400 | 1.47 | 0 | Standard body copy, legal text |
| `label` | SF Pro Text | 17px | 600 | 1.00 | -0.2px | Form labels, nav items |
| `caption` | SF Pro Text | 13px | 400 | 1.50 | 0 | Timestamps, metadata, footnotes |
| `accent-condensed` | Arial Narrow | 48px | 700 italic | 1.00 | 2px | Distressed stencil wordmark (one dark media tile only) |

**Typography Rules:**
- Structure comes from **type weight**, not borders or container cards.
- Tight leading and negative letter-spacing on display headlines.
- Italic accent-word treatment is strictly limited to **one word per headline** as a rare punctuation mark.

### 1.3 Spacing & Layout

- **Base Unit:** `8px` (`--space-base`)
- **Internal Gap:** `12px` (`--gap`)
- **Section Padding:** `44px` (`--section-padding`)
- **Container Widths:**
  - Standard Page: `max-width: 1024px` with `22px` fluid padding
  - Narrow Form: `max-width: 720px`
  - Full Timeline / Calendar: fluid with `24px` gutters

### 1.4 Border Radii & Elevation

- `--r-control`: `980px` (full pill for buttons)
- `--r-card`: `0px` (**all promo panels and content bands have 0px radius**)
- `--r-pill`: `9999px`
- `--radius-sm`: `6px` (form inputs)
- `--radius-lg`: `14px` (floating modals)
- `--shadow-overlay`: `rgba(0, 0, 0, 0.22) 3px 5px 30px 0px` (reserved exclusively for floating modals/drawers)
- Content panels and bento cells are **flat and shadowless**.

### 1.5 Motion

- Color transitions: `0.32s cubic-bezier(0.4, 0, 0.6, 1)`
- Opacity/transform transitions: `0.22s` to `0.24s ease`
- No bouncy or spring overshoot animations.
- Honors `prefers-reduced-motion: reduce`.

---

## 2. COMPONENT SPECIFICATIONS

### 2.1 Glass Navbar (`.glass-strip`)
- Sticky, `44px` height.
- Background: `rgba(245, 245, 247, 0.8)` with `backdrop-filter: saturate(1.8) blur(20px)`.
- Border bottom: `1px solid rgba(0, 0, 0, 0.06)`.
- Layout: Logo glyph left, centered nav items (`12px/400`, letter-spacing `-0.1px`), utility icons right.
- Sub-strip: `32px` white utility announcement bar underneath.

### 2.2 Button Hierarchy

| Variant | Height | Padding | Background | Text | Border | Hover |
|---------|--------|---------|------------|------|--------|-------|
| **Hero Primary** | 44px | 11px 21px | `#0071E3` | `#FFFFFF` | None | `#0076DF` |
| **Hero Outline** | 44px | 11px 21px | Transparent | `#0071E3` | 1px `#0071E3` | `rgba(0, 113, 227, 0.06)` |
| **Mid Primary** | 36px | 8px 15px | `#0071E3` | `#FFFFFF` | None | `#0076DF` |
| **Mid Outline** | 36px | 8px 15px | Transparent | `#0071E3` | 1px `#0071E3` | `rgba(0, 113, 227, 0.06)` |
| **Light Secondary Pill** | 44px / 36px | 11px 21px / 8px 15px | `#F5F5F7` | `#000000` | None | `#FFFFFF` |

**Rule:** Light secondary pills are used **only on dark panels** (`#000000`), alternating with blue pills.

### 2.3 Bento Promo Panels
- 2-column grid (`49% / 49%`), `12px` gutter.
- Background: `#F5F5F7` or `#000000` alternating.
- Padding: `53px 24px 60px`.
- Radius: `0px`.

### 2.4 Form Inputs
- Height: `40px` (`min-height: 44px` on mobile).
- Border: `1px solid rgba(0, 0, 0, 0.08)`, radius `6px`.
- Focus: `box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15)`, border `#0071E3`.

---

## 3. RESPONSIVE SPECIFICATION

| Breakpoint | Width | Layout Behavior |
|------------|-------|-----------------|
| **Desktop** | $\ge 1200\text{px}$ | Full 1024px container, sticky glass navbar, 2-column bento grids |
| **Tablet** | $768\text{px} - 1199\text{px}$ | Single/double hybrid bento, slide-over drawer navigation |
| **Mobile** | $< 768\text{px}$ | Single column 100% width, fixed top glass bar + floating bottom tab bar, 44px touch targets |

---

## 4. PAGE-BY-PAGE REDESIGN MAPPING

1. **Dashboard (`/`):**
   - Centered Apple-style Hero statement with single italic accent ("Plan *smarter.*").
   - 4-tile Bento Stats (Active Tasks, Burnout Risk, Weekly Hours, Next Deadline).
   - Full-width Today Schedule and 48-Hour Deadlines panels.
   - Minimal circular burnout gauge with 14-day trend sparkline.
2. **Planner (`/planner`):**
   - Clean timetable grid with high-contrast time blocks and floating Pomodoro glass widget.
3. **Deadlines & Tasks (`/deadlines`):**
   - Flat promotional list rows with priority indicator dots and inline pill actions.
4. **AI Assistant (`/ai`):**
   - Split conversational panel and structured roadmap cards (gray/ice-blue/dark panels).
5. **Resources & Events (`/resources`, `/events`):**
   - Bento-grid curated cards with single-pill upvotes and tag filters.
6. **Authentication (`/login`, `/register`):**
   - Symmetrical centered card on `#F5F5F7` ground, hero primary pill button.
