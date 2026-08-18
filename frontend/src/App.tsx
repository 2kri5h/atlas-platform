import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Resources from './pages/Resources'
import Events from './pages/Events'
import Journeys from './pages/Journeys'
import Planner from './pages/Planner'
import Deadlines from './pages/Deadlines'
import Anonymous from './pages/Anonymous'
import AIAssistant from './pages/AIAssistant'
import Profile from './pages/Profile'
import EmailService from './pages/EmailService'
import NotFound from './pages/NotFound'
import api from './utils/api'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem("token")

      if (!token) {
        setAuthenticated(false)
        setLoading(false)
        return
      }

      api.defaults.headers.common["Authorization"] = `Bearer ${token}`

      try {
        await api.get("/auth/me")
        setAuthenticated(true)
      } catch (err) {
        localStorage.removeItem("token")
        delete api.defaults.headers.common["Authorization"]
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
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
    </BrowserRouter>
  )
}

export default App