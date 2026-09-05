# ATLAS Android Application — Security Audit & Hardening Report

## 1. Audit Scope & Executive Summary

This security audit inspects the security posture of the ATLAS Android client and its interaction with the FastAPI backend. It covers token management, WebView isolation, CORS configurations, deep linking attack surface, and data at rest.

### Audit Summary: PASSED (ZERO HIGH/CRITICAL FINDINGS)

| Security Domain | Status | Notes |
|---|---|---|
| **Token Storage** | **SECURED** | Migrated from browser `localStorage` to Android native `SharedPreferences` via `@capacitor/preferences`. |
| **API Transport** | **SECURED** | Strict HTTPS communication (`https://atlas-platform-51gn.onrender.com`). |
| **CORS Policy** | **SECURED** | Explicit allowlist in `backend/api/main.py` including `https://localhost` and `capacitor://localhost`. |
| **Bundle Secrets** | **VERIFIED** | Build artifacts in `dist/` inspected; 0 API keys or private credentials leaked. |
| **Android Permissions**| **MINIMAL** | Only `android.permission.INTERNET` requested. No invasive permissions (Camera, Location, Contacts, Audio). |
| **WebView Scheme** | **SECURED** | Configured `androidScheme: 'https'` in `capacitor.config.ts` enforcing modern secure context. |

---

## 2. In-Depth Analysis

### 2.1 Token Storage & Data Isolation
- **Prior State**: The web application kept JWT session tokens in browser `localStorage`, making them potentially vulnerable to XSS or script injection in insecure WebView configurations.
- **Remediation**: Implemented `src/utils/storage.ts` with `@capacitor/preferences`. On Android devices, tokens are stored within the application's private app sandbox (`/data/data/com.iitb.atlas/shared_prefs/`), inaccessible to other applications or browser tabs.
- **In-Memory Cache**: `api.ts` keeps a transient synchronous cache `_tokenCache` populated on login and hydrated at startup via `hydrateAuthToken()`.

### 2.2 CORS & Origin Whitelisting
- When running in an Android WebView container, modern Capacitor applications initiate requests with the origin `https://localhost` or `capacitor://localhost`.
- Both `backend/core/config.py` and `backend/api/main.py` have been patched to explicitly permit these origins without relaxing wildcard protections for untrusted domains.

### 2.3 Deep Link & Intent Redirection Security
- `AndroidManifest.xml` configures an intent filter with `android:scheme="com.iitb.atlas"`.
- All incoming intents are routed exclusively to `MainActivity`. No exported internal components or broadcast receivers are exposed to the operating system.

### 2.4 Build Output Scrutiny
- A ripgrep scan of minified chunks in `frontend/dist` confirmed:
  - No database connection strings (`sqlite`, `postgresql`).
  - No server secrets (`SECRET_KEY`, `TOKEN_ENCRYPTION_KEY`).
  - No administrator passwords or mock test credentials.
