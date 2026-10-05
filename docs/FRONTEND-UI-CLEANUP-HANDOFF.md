# Atlas Frontend UI Cleanup Handoff

**Status:** Implemented and locally verified  
**Last updated:** 2026-10-04  
**Scope:** Responsive UI, frontend simplification, accessibility, loading reliability, and performance cleanup

## Purpose

This document records what changed during the responsive UI cleanup, why the changes were made, what was verified, and what work remains. The working tree containing these changes is the source of truth until the changes are committed.

## Completed Work

### Responsive navigation

- Established explicit layout ranges:
  - Phone: `320–767px`
  - Tablet: `768–1199px`
  - Desktop: `1200px` and above
- Fixed the breakpoint collision that caused 768px tablets to receive phone styles.
- Reduced phone navigation to exactly **Today, Planner, Tasks, More**.
- Added a compact tablet navigation rail while preserving the full desktop sidebar.
- Rebuilt More as a full-height, safe-area-aware sheet grouped into:
  - Study: AI Mentor, Resources, Email
  - Campus: Events, Journeys, Forum
  - Account: Profile and settings, Focus timer, theme, sign out
- The shared modal provides focus containment, Escape handling, focus restoration, an inert application background, and `aria-modal` semantics.
- Removed the floating Focus Timer launcher. The timer remains available through phone More and the tablet/desktop navigation.
- Added `env(safe-area-inset-*)` handling and minimum 44px coarse-pointer targets.

Primary files:

- [`frontend/src/components/Layout.tsx`](../frontend/src/components/Layout.tsx)
- [`frontend/src/components/Layout.css`](../frontend/src/components/Layout.css)
- [`frontend/src/components/ui/index.tsx`](../frontend/src/components/ui/index.tsx)
- [`frontend/src/components/ui/ui.css`](../frontend/src/components/ui/ui.css)

### Dashboard simplification

- Replaced the promotional, statistics-heavy Dashboard with an operational Today view.
- The first phone viewport now shows only:
  - Greeting
  - Next scheduled item
  - Nearest deadline
  - Wellbeing status
  - One View details action
- Secondary schedule and task information is progressively disclosed.
- Removed duplicate quick actions, marketing copy, trend graphs, secondary statistics, and the FAQ section.
- Added shared loading, error, and retry states.

Primary files:

- [`frontend/src/pages/Dashboard.tsx`](../frontend/src/pages/Dashboard.tsx)
- [`frontend/src/pages/Dashboard.css`](../frontend/src/pages/Dashboard.css)

### Planner and task usability

- Phones default to Planner Day view.
- Tablets default to Planner Week view.
- The phone timeline now scrolls within a bounded viewport rather than producing an excessively long page.
- The duplicate mobile day strip no longer appears on tablets.
- Planner data failures now show a retryable error instead of an indefinite loading state.
- Phone task behavior was verified to default to List view with its filter sheet.

Primary files:

- [`frontend/src/pages/Planner.tsx`](../frontend/src/pages/Planner.tsx)
- [`frontend/src/pages/Planner.css`](../frontend/src/pages/Planner.css)
- [`frontend/src/hooks/usePlannerData.ts`](../frontend/src/hooks/usePlannerData.ts)

### Loading and request reliability

- Replaced several plain or indefinite loading messages with the shared LoadingState component.
- Added retryable route-load errors to Events, Journeys, Dashboard, and Planner data.
- Prevented Resources from loading Library, Explore, and recommendation data simultaneously on initial render. Only the active view now loads.
- Fixed the Email page using a `404` response as normal connection-state control flow:
  - Added `GET /api/emails/status`.
  - An unconnected inbox now returns a valid empty state.
  - Email mutation endpoints remain strict.
- Responsive browser tests now fail on unexpected console errors and HTTP `4xx`/`5xx` responses.

Primary files:

- [`backend/api/emails.py`](../backend/api/emails.py)
- [`frontend/src/pages/EmailService.tsx`](../frontend/src/pages/EmailService.tsx)
- [`frontend/src/pages/Resources.tsx`](../frontend/src/pages/Resources.tsx)
- [`frontend/src/pages/Events.tsx`](../frontend/src/pages/Events.tsx)
- [`frontend/src/pages/Journeys.tsx`](../frontend/src/pages/Journeys.tsx)

### Accessibility and interaction cleanup

- Migrated the Journeys detail overlay to the shared accessible Modal.
- Removed the inaccessible whole-card click target from Journey cards and retained a semantic View journey button.
- Replaced clickable Profile `<span>` elements with semantic, pressed-state buttons.
- Added reduced-motion handling for shared modal animations.
- Prevented theme changes from animating every transitioning element during the theme swap.
- Fixed Dashboard link contrast detected by axe.

### Performance and code cleanup

- Removed unused Google font requests and standardized the interface on a native system font stack.
- Deleted obsolete or unused files:
  - `DeadlineSummary.tsx`
  - `FAQSection.tsx`
  - `FAQSection.css`
  - Redundant `utils/axios.ts`
  - Empty JavaScript `__init__` files
- Removed obsolete Layout, Focus Timer, and Planner style blocks.
- Reused the global toast system for Focus Timer notifications.
- Net change for this pass: **1,259 fewer lines** (`672` additions, `1,931` deletions).
- No new runtime dependency was added.

## Verification Results

| Check | Result |
|---|---|
| `npm run build` | Passed |
| Backend `pytest` suite | 56 passed |
| Playwright responsive suite | 25 passed, 10 intentional viewport skips |
| Axe WCAG A/AA Dashboard scan | Passed |
| Unexpected browser console errors | None |
| Unexpected browser HTTP 4xx/5xx | None |
| Horizontal page overflow | None at tested viewports |
| Throttled phone LCP/INP/CLS thresholds | Passed |
| Phone route bundle limit | Every route below 200KB gzip |
| `npm audit --audit-level=high` | Zero high or critical findings |
| `git diff --check` | Passed |

Tested viewports:

- `320×568`
- `360×800`
- `390×844`
- `768×1024`
- `1024×768`
- `1280×800`
- `1600×1000`

Measured bundle changes:

- Main application JavaScript: approximately `41.3KB` to `37.7KB` gzip.
- Shared CSS: approximately `18.6KB` to `17.1KB` gzip.
- Largest route chunk is Anonymous at approximately `96.9KB` gzip, still below the current budget.

Browser coverage is defined in:

- [`frontend/playwright.config.ts`](../frontend/playwright.config.ts)
- [`frontend/e2e/responsive.spec.ts`](../frontend/e2e/responsive.spec.ts)

## Remaining Work

### Priority 1: remove remaining duplicated UI infrastructure

- Delete the unused legacy `.timeline-container` and `.event-block` Planner CSS after a focused screenshot comparison. No live TSX consumer was found, but the deletion should be isolated because the stylesheet contains several generations of overrides.
- Convert the two custom Email `createPortal` modal shells to the shared Modal or FilterSheet primitives.
- Convert remaining custom overlays in Planner, Resources, and Anonymous to the shared accessible modal behavior.
- Replace page-local toast state and timers in Email and Resources with the global Toast host.

### Priority 2: finish CSS consolidation

- Replace remaining broad `transition: all` declarations with specific properties.
- Remove unused selectors from the large Planner, Email, Resources, and Anonymous stylesheets.
- Consolidate repeated button, filter, card, and overlay rules into shared primitives without changing page-specific layout.
- Continue reducing raw color literals in favor of the existing design tokens.
- Add screenshot baselines before large stylesheet deletions to avoid visual regressions.

### Priority 3: complete error-state consistency

- Add explicit retryable load errors to Profile and AI Mentor instead of relying on console logging or empty content.
- Replace remaining user-visible raw exception messages with stable, friendly messages.
- Standardize mutation loading, success, and retry behavior across Email, Resources, Planner, and Anonymous.
- Preserve applicable page filters and selected subviews in URL search parameters.

### Priority 4: performance follow-up

- Split heavy Anonymous functionality if its route grows beyond the current `96.9KB` gzip size.
- Profile KaTeX and Markdown loading on AI and community routes and lazy-load them where practical.
- Run Lighthouse or WebPageTest against a production build on a representative mid-range Android device.
- Add request-count assertions for Dashboard, Resources, and Email to prevent duplicate-fetch regressions.

### Priority 5: dependency and security follow-up

- Three moderate `npm audit` findings remain in the development-only Capacitor CLI chain: `@capacitor/cli → xcode → uuid`.
- Do not run `npm audit fix --force` without reviewing the proposed Capacitor CLI downgrade and validating Android builds.
- A complete Strix source and local web/API scan was not run in this UI pass. It still requires the disposable local environment, Docker, and a process-scoped Strix-compatible LLM key described in the security plan.
- Continue treating source-review security findings as observed until their PoCs are reproduced and retested locally.

## Recommended Next Sequence

1. Commit this verified responsive pass as a stable baseline.
2. Add screenshot coverage for Email account/event modals and the Journey modal.
3. Migrate custom modals and toasts to shared primitives.
4. Delete the proven-unused Planner CSS in small, buildable groups.
5. Add Profile and AI Mentor retryable error states.
6. Review the Capacitor dependency advisory without using a forced automated downgrade.
7. Run the authorized disposable Strix assessment and remediate only validated findings.

## Verification Commands

```powershell
# Backend
python -m pytest -q

# Frontend build and dependency gate
Set-Location frontend
npm run build
npm audit --audit-level=high

# Isolated responsive browser suite
$env:PLAYWRIGHT_FRONTEND_PORT='13020'
$env:PLAYWRIGHT_BACKEND_PORT='18020'
npm run test:e2e
```

The isolated ports prevent the Playwright services from interfering with developer servers already running on ports `3000` and `8000`.
