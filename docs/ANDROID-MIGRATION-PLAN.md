# ATLAS Platform — Android Migration & Architecture Plan

## 1. Executive Summary

This document specifies the complete engineering architecture and implementation details for transforming the existing **ATLAS Platform** (React 18 + Vite + TypeScript frontend, FastAPI + SQLAlchemy backend) into a production-quality Android application using **Capacitor 8**, while maintaining full backward-compatibility with the existing web app and cloud infrastructure.

---

## 2. Technology Selection & Architecture

### Evaluation Matrix

| Criterion | Capacitor (Chosen) | React Native | Flutter | PWA / TWA |
|---|---|---|---|---|
| **Code Reuse** | **~95%** (All components, styles, API layer) | ~30% (Logic only, full UI rewrite) | ~10% (Complete rewrite in Dart) | ~90% (Browser chrome issues, poor offline) |
| **Three.js Astrolabe** | **Native WebGL canvas preserved** | Incompatible without heavy bridge | Incompatible without foreign canvas | Works but lower perf |
| **Auth & Interceptors** | **Zero backend changes** (JWT Bearer) | Token flow rewrite | Token flow rewrite | Cookie / browser state issues |
| **Native Device APIs** | **Official Capacitor plugins** (Back button, Status bar, Splash, Storage, Haptics) | React Native modules | Flutter plugins | Very limited Web APIs |
| **Implementation Risk** | **Low** (No regression to web app) | High (2-3 months rewrite) | Very High (New tech stack) | Low but subpar UX |

### Architectural Overview

```
┌────────────────────────────────────────────────────────┐
│                   ATLAS Android App                    │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Android Native Container               │  │
│  │  - MainActivity (BridgeActivity)                 │  │
│  │  - AndroidManifest.xml (Deep linking / schemes)  │  │
│  │  - Android Native Theme & Adaptive Icons         │  │
│  └──────────────────────────────────────────────────┘  │
│                           ▲                            │
│                           │ Capacitor Native Bridge    │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │      React 18 + Vite Mobile Web Application      │  │
│  │  - Code-split routes via React.lazy              │  │
│  │  - Hardware back-button stack integration        │  │
│  │  - Secure Storage abstraction (Capacitor/Web)    │  │
│  │  - Safe-area CSS insets (--safe-area-top/bottom) │  │
│  │  - Soft keyboard height tracking & dock hiding   │  │
│  │  - Three.js astrolabe low-power & mobile guards  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
                            ▲
                            │ HTTPS REST (Bearer JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│           FastAPI Backend (Render Cloud)               │
│  - Endpoint: https://atlas-platform-51gn.onrender.com │
│  - CORS configured for https://localhost & native     │
│  - SQLite / PostgreSQL DB with secure rate limiting    │
└────────────────────────────────────────────────────────┘
```

---

## 3. Implemented Components & Enhancements

### 3.1 Security & Storage
- **`src/utils/storage.ts`**: High-performance platform-aware storage abstraction. On Android, JWT authentication tokens and sensitive credentials reside in native `SharedPreferences` via `@capacitor/preferences`. On web, transparently falls back to `localStorage`.
- **`src/utils/api.ts`**: Centralized token hydration (`hydrateAuthToken`) and synchronous memory caching (`_tokenCache`) ensuring no Axios request is blocked by asynchronous preference reads.
- **Backend CORS**: Added `https://localhost` and `capacitor://localhost` to both `backend/core/config.py` and `backend/api/main.py` allowlists.

### 3.2 Mobile Navigation & Hardware Back Button
- **`src/utils/native.ts`**: Registered `CapApp.addListener('backButton')`. Navigates back through the React Router history when available; cleanly exits the application when on root without hanging or crashing.
- **Dynamic Status Bar**: Synchronized with light/dark theme switches (`StatusBar.setStyle` and `StatusBar.setBackgroundColor`).
- **Splash Screen**: Auto-fade dismissal after DOM hydration.
- **Offline Banner**: System-level network status monitoring via `@capacitor/network`.

### 3.3 Mobile-First UX & Viewport Polish
- **Safe Area Insets**: Full support for notches, camera cutouts, and bottom gesture navigation pills via `viewport-fit=cover` and CSS custom properties (`--safe-area-top`, `--safe-area-bottom`).
- **Soft Keyboard Handling**: Tracked via `Keyboard.addListener` and `resize: 'body'`. Bottom navigation dock automatically hides when the virtual keyboard is open to prevent obstructing text inputs and submit buttons.
- **Touch Targets**: Form inputs, select dropdowns, and buttons enlarged to standard 44px min-height with 16px font-size to prevent unwanted auto-zooming.

### 3.4 Performance & Code Splitting
- **Vite Chunk Splitting**: Vendor libraries separated into distinct bundles (`vendor-react`, `vendor-three`).
- **Three.js Optimization (`AmbientCanvas.tsx`)**:
  - Dynamically imported with `React.lazy` and `Suspense` in `Layout.tsx` so initial page render is not blocked by Three.js.
  - Automatically detects low-end devices (`navigator.hardwareConcurrency <= 2` or `deviceMemory <= 2`) and disables 3D rendering.
  - On mobile devices, reduces torus geometry segments, disables MSAA antialiasing, clamps pixel ratio to 1.0, and reduces chronon nodes for 60fps rendering without battery drain.
