import { useState, useEffect } from 'react'
import { Plus, ThumbsUp, CheckCircle, X, Calendar, Tag, ArrowRight } from 'lucide-react'
import api from '../utils/api'
import { Journey } from '../utils/api'
import { DOMAINS, getDomainBadgeClass } from '../utils/helpers'
import './Journeys.css'

function Journeys() {
  const [journeys, setJourneys] = useState<Journey[]>([])
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null)
  const [form, setForm] = useState({ title: '', domain: 'sde', content: '', year_completed: 2024, tags: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJourneys()
  }, [filter])

  const fetchJourneys = async () => {
    try {
      const params = filter ? `?domain=${filter}` : ''
      const res = await api.get(`/journeys/${params}`)
      setJourneys(res.data)
    } catch (err) {
      console.error('Failed to fetch journeys', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/journeys/', form)
      setShowForm(false)
      setForm({ title: '', domain: 'sde', content: '', year_completed: 2024, tags: '' })
      fetchJourneys()
    } catch (err) {
      console.error('Failed to create journey', err)
    }
  }

  const upvote = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    try {
      const res = await api.post(`/journeys/${id}/upvote`)
      setJourneys(journeys.map(j => j.id === id ? { ...j, upvotes: res.data.upvotes } : j))
      if (selectedJourney && selectedJourney.id === id) {
        setSelectedJourney({ ...selectedJourney, upvotes: res.data.upvotes })
      }
    } catch (err) {
      console.error('Failed to upvote', err)
    }
  }

  return (
    <div className="journeys-page">
      <div className="page-header">
        <div>
          <h1>Senior Journeys</h1>
          <p>Learn from experiences shared by seniors who walked the path before you</p>
        </div>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> Share Your Journey
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          <h3>Share Your Journey</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., How I got into Google" required />
              </div>
              <div className="form-group">
                <label>Domain *</label>
                <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                  {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Year Completed</label>
                <input type="number" value={form.year_completed} onChange={(e) => setForm({ ...form, year_completed: Number(e.target.value) })} min={2010} max={2030} />
              </div>
              <div className="form-group">
                <label>Tags (comma-separated)</label>
                <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="e.g., placement, google, interview" />
              </div>
            </div>
            <div className="form-group">
              <label>Your Story *</label>
              <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} placeholder="Share your experience, what you did, how you prepared, advice for juniors..." required />
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary">Publish</button>
            </div>
          </form>
        </div>
      )}

      <div className="filters">
        <button className={`filter-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
        {DOMAINS.map(d => (
          <button key={d.value} className={`filter-btn ${filter === d.value ? 'active' : ''}`} onClick={() => setFilter(d.value)}>
            {d.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : journeys.length === 0 ? (
        <div className="empty-state">No journeys found. Be the first to share!</div>
      ) : (
        <div className="journeys-grid">
          {journeys.map(journey => {
            const shortExcerpt = journey.content.length > 130 
              ? journey.content.substring(0, 130).trim() + '...' 
              : journey.content
            const tagList = journey.tags ? journey.tags.split(',').map(t => t.trim()).filter(Boolean) : []

            return (
              <div key={journey.id} className="journey-card card" onClick={() => setSelectedJourney(journey)}>
                <div>
                  <div className="journey-header">
                    <span className={getDomainBadgeClass(journey.domain)}>{journey.domain.toUpperCase()}</span>
                    {journey.is_verified && (
                      <span className="verified-badge"><CheckCircle size={12} /> Verified</span>
                    )}
                  </div>
                  <h3>{journey.title}</h3>
                  <p className="journey-content-preview">{shortExcerpt}</p>
                  
                  {tagList.length > 0 && (
                    <div className="journey-tags-preview">
                      {tagList.slice(0, 3).map((tag, idx) => (
                        <span key={idx} className="tag-pill">#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="journey-footer">
                  <div className="journey-meta">
                    <span className="journey-year"><Calendar size={13} /> {journey.year_completed}</span>
                  </div>
                  <div className="journey-actions">
                    <button className="upvote-btn" onClick={(e) => upvote(journey.id, e)} title="Upvote">
                      <ThumbsUp size={14} /> {journey.upvotes}
                    </button>
                    <button className="read-more-btn" onClick={(e) => { e.stopPropagation(); setSelectedJourney(journey); }}>
                      View Full Story <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Full Journey Overview Modal */}
      {selectedJourney && (
        <div className="journey-modal-backdrop" onClick={() => setSelectedJourney(null)}>
          <div className="journey-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="journey-modal-header">
              <div className="modal-header-badges">
                <span className={getDomainBadgeClass(selectedJourney.domain)}>{selectedJourney.domain.toUpperCase()}</span>
                {selectedJourney.is_verified && (
                  <span className="verified-badge"><CheckCircle size={13} /> Verified Senior</span>
                )}
                {selectedJourney.year_completed && (
                  <span className="year-badge"><Calendar size={13} /> Class of {selectedJourney.year_completed}</span>
                )}
              </div>
              <button className="close-modal-btn" onClick={() => setSelectedJourney(null)} aria-label="Close modal">
                <X size={20} />
              </button>
            </div>

            <div className="journey-modal-body">
              <h2>{selectedJourney.title}</h2>
              
              {selectedJourney.tags && (
                <div className="modal-tags">
                  {selectedJourney.tags.split(',').map((tag, i) => (
                    <span key={i} className="modal-tag-pill"><Tag size={12} /> {tag.trim()}</span>
                  ))}
                </div>
              )}

              <div className="full-story-content">
                {selectedJourney.content.split('\n\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div className="journey-modal-footer">
              <button className="upvote-btn modal-upvote" onClick={() => upvote(selectedJourney.id)}>
                <ThumbsUp size={16} /> Helpful ({selectedJourney.upvotes})
              </button>
              <button className="secondary" onClick={() => setSelectedJourney(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Journeys