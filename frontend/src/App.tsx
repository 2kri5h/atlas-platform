import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState, useEffect, Suspense, lazy } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import api, { hydrateAuthToken, setAuthToken } from './utils/api'
import { secureStorage } from './utils/storage'
import { initNativeIntegration } from './utils/native'

// ── Route-based code splitting ──────────────────────────────────────────────
// Dashboard stays in the main bundle (first screen after login).
// All other pages are lazy-loaded to slash the initial JS payload from
// 1.18 MB down to ~400 KB.
const Resources = lazy(() => import('./pages/Resources'))
const Events = lazy(() => import('./pages/Events'))
const Journeys = lazy(() => import('./pages/Journeys'))
const Planner = lazy(() => import('./pages/Planner'))
const Deadlines = lazy(() => import('./pages/Deadlines'))
const Anonymous = lazy(() => import('./pages/Anonymous'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Profile = lazy(() => import('./pages/Profile'))
const EmailService = lazy(() => import('./pages/EmailService'))
const GoogleCallback = lazy(() => import('./pages/GoogleCallback'))

// ── Suspense fallback ───────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="loading" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '40vh', opacity: 0.6, fontSize: '0.875rem',
    }}>
      Loading…
    </div>
  )
}

// ── Auth guard ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      // Hydrate the in-memory token cache from native / localStorage
      await hydrateAuthToken()
      const token = await secureStorage.get('token')

      if (!token) {
        setAuthenticated(false)
        setLoading(false)
        return
      }

      try {
        await api.get("/auth/me")
        setAuthenticated(true)
      } catch {
        await setAuthToken(null)
        setAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  if (loading) return <div className="loading">Loading...</div>
  if (!authenticated) return <Navigate to="/login" />

  return <>{children}</>
}

// ── Native integration hook (inside BrowserRouter) ──────────────────────────
function NativeBootstrap() {
  const navigate = useNavigate()

  useEffect(() => {
    // Determine theme: check for [data-theme="dark"] or prefers-color-scheme
    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
    initNativeIntegration((delta) => navigate(delta), isDark)
  }, [navigate])

  return null
}

// ── App ─────────────────────────────────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <NativeBootstrap />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/integrations/google/callback" element={<ProtectedRoute><GoogleCallback /></ProtectedRoute>} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="resources" element={<Resources />} />
            <Route path="events" element={<Events />} />
            <Route path="emails" element={<EmailService />} />
            <Route path="journeys" element={<Journeys />} />
            <Route path="planner" element={<Planner />} />
            <Route path="deadlines" element={<Deadlines />} />
            <Route path="anonymous" element={<Anonymous />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App