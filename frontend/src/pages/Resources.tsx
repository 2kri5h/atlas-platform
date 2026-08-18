import { useState, useEffect } from 'react'
import { Plus, ThumbsUp, Edit2, Trash2, X, Search, Bookmark, Star, BookOpen, FileText, Play, Wrench, FileQuestion, ArrowRight } from 'lucide-react'
import api from '../utils/api'
import { Resource, RecommendedResource } from '../utils/api'
import { DOMAINS, getDomainBadgeClass } from '../utils/helpers'
import './Resources.css'

function Resources() {
  const [resources, setResources] = useState<Resource[]>([])
  const [recommended, setRecommended] = useState<RecommendedResource[]>([])
  const [filter, setFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'bookmarks'>('all')
  const [form, setForm] = useState({ title: '', description: '', url: '', domain: 'sde', course: '', resource_type: '', is_private: false })
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [currentUserRoll, setCurrentUserRoll] = useState<string>('')
  const [userDomains, setUserDomains] = useState<string[]>([])
  const [editingResource, setEditingResource] = useState<Resource | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', url: '', domain: '', course: '', resource_type: '', is_private: false })

  const getResourceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'video': return <Play size={22} className="neon-icon" />;
      case 'course': return <BookOpen size={22} className="neon-icon" />;
      case 'article':
      case 'notes': return <FileText size={22} className="neon-icon" />;
      case 'tool': return <Wrench size={22} className="neon-icon" />;
      default: return <FileQuestion size={22} className="neon-icon" />;
    }
  }

  useEffect(() => {
    fetchCurrentUser()
    fetchRecommended()
  }, [])

  useEffect(() => {
    if (activeTab === 'bookmarks') {
      fetchBookmarks()
    } else if (searchQuery.trim()) {
      handleSearch()
    } else {
      fetchResources()
    }
  }, [filter, activeTab])

  const fetchCurrentUser = async () => {
    try {
      const res = await api.get('/auth/me')
      setCurrentUserId(res.data.id)
      setCurrentUserRoll(res.data.roll_number || '')
      if (res.data.domains) {
        setUserDomains(res.data.domains.split(',').map((d: string) => d.trim().toLowerCase()))
      }
    } catch (err) {
      console.error('Failed to fetch user', err)
    }
  }

  const fetchResources = async () => {
    try {
      setLoading(true)
      const params = filter ? `?domain=${filter}` : ''
      const res = await api.get(`/resources/${params}`)
      setResources(res.data)
    } catch (err) {
      console.error('Failed to fetch resources', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecommended = async () => {
    try {
      const res = await api.get('/resources/recommended')
      setRecommended(res.data)
    } catch (err) {
      console.error('Failed to fetch recommendations', err)
    }
  }

  const fetchBookmarks = async () => {
    try {
      setLoading(true)
      const res = await api.get('/resources/bookmarks/my')
      setResources(res.data)
    } catch (err) {
      console.error('Failed to fetch bookmarks', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    try {
      setLoading(true)
      const res = await api.get(`/resources/search?q=${encodeURIComponent(searchQuery)}`)
      setResources(res.data)
    } catch (err) {
      console.error('Failed to search resources', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/resources/', form)
      setShowForm(false)
      setForm({ title: '', description: '', url: '', domain: 'sde', course: '', resource_type: '', is_private: false })
      fetchResources()
      fetchRecommended()
    } catch (err) {
      console.error('Failed to create resource', err)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingResource) return
    try {
      await api.put(`/resources/${editingResource.id}`, editForm)
      setEditingResource(null)
      fetchResources()
      fetchRecommended()
    } catch (err) {
      console.error('Failed to edit resource', err)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this resource?')) return
    try {
      await api.delete(`/resources/${id}`)
      setResources(resources.filter(r => r.id !== id))
      setRecommended(recommended.filter(r => r.id !== id))
    } catch (err) {
      console.error('Failed to delete resource', err)
    }
  }

  const toggleUpvote = async (id: number) => {
    try {
      const res = await api.post(`/resources/${id}/upvote`)
      setResources(resources.map(r => r.id === id ? { ...r, upvotes: res.data.upvotes, user_upvoted: res.data.upvoted } : r))
    } catch (err) {
      console.error('Failed to toggle upvote', err)
    }
  }

  const toggleBookmark = async (id: number) => {
    try {
      const res = await api.post(`/resources/${id}/bookmark`)
      setResources(resources.map(r => r.id === id ? { ...r, user_bookmarked: res.data.bookmarked } : r))
      if (activeTab === 'bookmarks' && !res.data.bookmarked) {
        setResources(resources.filter(r => r.id !== id))
      }
    } catch (err) {
      console.error('Failed to toggle bookmark', err)
    }
  }

  const openEditModal = (resource: Resource) => {
    setEditingResource(resource)
    setEditForm({
      title: resource.title,
      description: resource.description || '',
      url: resource.url || '',
      domain: resource.domain,
      course: resource.course || '',
      resource_type: resource.resource_type || '',
      is_private: resource.is_private || false
    })
  }

  const canEdit = (resource: Resource) => {
    const isAdmin = currentUserRoll?.startsWith('admin') || false;
    return isAdmin || resource.uploader_id === currentUserId;
  }

  return (
    <div className="resources-page">
      <div className="page-header">
        <div>
          <h1>Resource Library</h1>
          <p>Curated learning materials from seniors across all domains</p>
        </div>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> Add Resource
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          <h3>Share a Resource</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Domain *</label>
                <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                  {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>URL</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Course</label>
                <input value={form.course} onChange={(e) => setForm({ ...form, course: e.target.value })} placeholder="e.g., CS 101" />
              </div>
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })}>
                <option value="">Select type</option>
                <option value="video">Video</option>
                <option value="article">Article</option>
                <option value="course">Course</option>
                <option value="book">Book</option>
                <option value="notes">Notes</option>
                <option value="tool">Tool</option>
              </select>
            </div>
            <div className="form-group visibility-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_private}
                  onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                />
                {' '}Save for myself only (private)
              </label>
              <span className="visibility-hint">
                {form.is_private ? '🔒 Only you will see this resource' : '🌐 Visible to all students'}
              </span>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary">Submit</button>
            </div>
          </form>
        </div>
      )}

      {/* Search Bar */}
      <div className="search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Search resources by title, description, or course..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => { setSearchQuery(''); setActiveTab('all'); fetchResources() }}>
            <X size={16} />
          </button>
        )}
      </div>

      {/* Tabs: All / Bookmarks */}
      <div className="resource-tabs">
        <button className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
          All Resources
        </button>
        <button className={`tab-btn ${activeTab === 'bookmarks' ? 'active' : ''}`} onClick={() => setActiveTab('bookmarks')}>
          <Bookmark size={14} /> My Bookmarks
        </button>
      </div>

      {/* Domain Filters */}
      <div className="filters">
        <button className={`filter-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All</button>
        {DOMAINS.map(d => (
          <button key={d.value} className={`filter-btn ${filter === d.value ? 'active' : ''}`} onClick={() => setFilter(d.value)}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Recommended Section */}
      {recommended.filter(r => !filter || r.domain === filter).length > 0 && activeTab === 'all' && !searchQuery && (!filter || userDomains.includes(filter)) && (
        <div className="recommended-section">
          <h2><Star size={20} /> Recommended for You</h2>
          <div className="recommended-grid">
            {recommended.filter(r => !filter || r.domain === filter).slice(0, 4).map(rec => (
              <div key={rec.id} className="resource-card card recommended-card">
                <div className="card-top-row">
                  <div className="icon-container amber-icon">
                    <Star size={20} color="#d97706" />
                  </div>
                  <div className="card-actions-right">
                    <span className="match-badge">{rec.match_score}% match</span>
                  </div>
                </div>

                <h3 className="rec-card-title">{rec.title}</h3>
                <p className="rec-card-desc">{rec.description}</p>

                <div className="match-reasons">
                  {rec.match_reasons.map((reason, i) => (
                    <span key={i} className="reason-tag">✓ {reason}</span>
                  ))}
                </div>

                <div className="card-footer">
                  <span className="card-meta">
                    {rec.resource_type ? (rec.resource_type.charAt(0).toUpperCase() + rec.resource_type.slice(1)) : 'Resource'} • {rec.domain.toUpperCase()}
                  </span>
                  {rec.url && (
                    <a href={rec.url} target="_blank" rel="noopener noreferrer" className="card-link explore-link">
                      Explore resource <ArrowRight size={15} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resources Grid */}
      {loading ? (
        <div className="loading">Loading...</div>
      ) : resources.length === 0 ? (
        <div className="empty-state">
          {activeTab === 'bookmarks' ? 'No bookmarked resources yet. Bookmark resources to save them here!' : 'No resources found. Be the first to add one!'}
        </div>
      ) : (
        <div className="resources-grid">
          {resources.map(resource => (
            <div key={resource.id} className="resource-card card card-hover">
              <div className="card-top-row">
                <div className="icon-container">
                  {getResourceIcon(resource.resource_type)}
                </div>
                <div className="card-actions-right">
                  <span className={getDomainBadgeClass(resource.domain)}>{resource.domain.toUpperCase()}</span>
                  {resource.is_curated && <span className="curated-badge">⭐ Curated</span>}
                  {resource.is_private && <span className="private-badge">🔒 Private</span>}
                  {canEdit(resource) && (
                    <>
                      <button className="icon-btn edit-btn" onClick={() => openEditModal(resource)} title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button className="icon-btn delete-btn" onClick={() => handleDelete(resource.id)} title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                  <button
                    className={`icon-btn bookmark-btn ${resource.user_bookmarked ? 'bookmarked' : ''}`}
                    onClick={() => toggleBookmark(resource.id)}
                    title={resource.user_bookmarked ? 'Remove bookmark' : 'Bookmark'}
                  >
                    <Bookmark size={14} fill={resource.user_bookmarked ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className={`upvote-pill ${resource.user_upvoted ? 'upvoted' : ''}`}
                    onClick={() => toggleUpvote(resource.id)}
                  >
                    <ThumbsUp size={14} fill={resource.user_upvoted ? 'currentColor' : 'none'} className="upvote-icon" />
                    <span>{resource.upvotes}</span>
                  </button>
                </div>
              </div>

              <h3 className="card-title">{resource.title}</h3>
              <p className="card-desc">{resource.description}</p>

              <div className="card-footer">
                <span className="card-meta">
                  {resource.resource_type ? (resource.resource_type.charAt(0).toUpperCase() + resource.resource_type.slice(1)) : 'Resource'} • {resource.domain.toUpperCase()}
                </span>
                {resource.url && (
                  <a href={resource.url} target="_blank" rel="noopener noreferrer" className="card-link">
                    Visit <ArrowRight size={15} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingResource && (
        <div className="modal-overlay" onClick={() => setEditingResource(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Resource</h3>
              <button className="modal-close" onClick={() => setEditingResource(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="form-group">
                <label>Title *</label>
                <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>URL</label>
                  <input type="url" value={editForm.url} onChange={(e) => setEditForm({ ...editForm, url: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Domain</label>
                  <select value={editForm.domain} onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}>
                    {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Course</label>
                  <input value={editForm.course} onChange={(e) => setEditForm({ ...editForm, course: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={editForm.resource_type} onChange={(e) => setEditForm({ ...editForm, resource_type: e.target.value })}>
                    <option value="">Select type</option>
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="course">Course</option>
                    <option value="book">Book</option>
                    <option value="notes">Notes</option>
                    <option value="tool">Tool</option>
                  </select>
                </div>
              </div>
              <div className="form-group visibility-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={editForm.is_private}
                    onChange={(e) => setEditForm({ ...editForm, is_private: e.target.checked })}
                  />
                  {' '}Save for myself only (private)
                </label>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary" onClick={() => setEditingResource(null)}>Cancel</button>
                <button type="submit" className="primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Resources
