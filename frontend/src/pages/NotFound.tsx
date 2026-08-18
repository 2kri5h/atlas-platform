import { Link, useNavigate } from 'react-router-dom'
import { Home, Calendar, Clock, Bot, ArrowLeft, Search } from 'lucide-react'
import './NotFound.css'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="notfound-page">
      <div className="notfound-card">
        <div className="notfound-badge">404 Error</div>
        
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-subtitle">
          The page you are looking for doesn't exist, was moved, or requires different permissions.
        </p>

        <div className="notfound-actions">
          <button onClick={() => navigate(-1)} className="secondary notfound-btn">
            <ArrowLeft size={16} /> Go Back
          </button>
          <Link to="/" className="primary-btn notfound-btn">
            <Home size={16} /> Return to Dashboard
          </Link>
        </div>

        <div className="notfound-quicklinks-section">
          <span className="notfound-quicklinks-title">Quick Destinations</span>
          <div className="notfound-quicklinks-grid">
            <Link to="/planner" className="notfound-quicklink">
              <Calendar size={18} />
              <div>
                <strong>Timetable & Planner</strong>
                <small>View your weekly classes</small>
              </div>
            </Link>
            <Link to="/deadlines" className="notfound-quicklink">
              <Clock size={18} />
              <div>
                <strong>Deadlines & Tasks</strong>
                <small>Track assignments and exams</small>
              </div>
            </Link>
            <Link to="/ai" className="notfound-quicklink">
              <Bot size={18} />
              <div>
                <strong>AI Assistant</strong>
                <small>Ask questions and study guidance</small>
              </div>
            </Link>
            <Link to="/resources" className="notfound-quicklink">
              <Search size={18} />
              <div>
                <strong>Resource Library</strong>
                <small>Browse notes and archives</small>
              </div>
            </Link>
          </div>
        </div>

        <div className="notfound-footer-note">
          Need help? Reach out on the <Link to="/anonymous">Anonymous Forum</Link> or consult your <Link to="/ai">AI Mentor</Link>.
        </div>
      </div>
    </div>
  )
}
