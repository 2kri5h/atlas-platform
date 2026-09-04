import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Plus,
  ThumbsUp,
  Edit2,
  Trash2,
  X,
  Search,
  Bookmark,
  BookmarkCheck,
  Star,
  BookOpen,
  FileText,
  Play,
  Wrench,
  FileQuestion,
  ArrowRight,
  HardDrive,
  ExternalLink,
  Calendar,
  MoreVertical,
  Layers,
  Compass,
  CheckCircle2,
  FolderSync,
} from 'lucide-react'
import api, {
  googleIntegrationsAPI,
  myLibraryAPI,
  Resource,
  RecommendedResource,
  LibraryResource,
} from '../utils/api'
import { DOMAINS, getDomainBadgeClass } from '../utils/helpers'
import GoogleConnectModal from '../components/GoogleConnectModal'
import ResourceTaskModal from '../components/MyLibrary/ResourceTaskModal'
import SavedLinksList from '../components/MyLibrary/SavedLinksList'
import DriveNavigator from '../components/MyLibrary/DriveNavigator'
import './Resources.css'

export function Resources() {
  // Hub View Switcher: 'library' (My Library) vs 'explore' (Explore Resources)
  const [activeHubView, setActiveHubView] = useState<'library' | 'explore'>('library')

  // Explore Resources State
  const [resources, setResources] = useState<Resource[]>([])
  const [recommended, setRecommended] = useState<RecommendedResource[]>([])
  const [exploreFilter, setExploreFilter] = useState('')
  const [exploreSearch, setExploreSearch] = useState('')
  const [loadingExplore, setLoadingExplore] = useState(false)

  // My Library State
  const [libraryItems, setLibraryItems] = useState<LibraryResource[]>([])
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [libraryCourseFilter, setLibraryCourseFilter] = useState('')
  const [libraryTypeFilter, setLibraryTypeFilter] = useState<'all' | 'drive' | 'notes' | 'links'>('all')
  const [librarySearch, setLibrarySearch] = useState('')

  // Modals & Dialogs State
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [taskModalData, setTaskModalData] = useState<{
    title: string
    url?: string
    course_code?: string
    file_id?: string
    resource_id?: number
    description?: string
  }>({ title: '' })

  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingResource, setEditingResource] = useState<Resource | null>(null)

  // Forms State
  const [form, setForm] = useState({
    title: '',
    description: '',
    url: '',
    domain: 'sde',
    course: '',
    resource_type: '',
    is_private: true, // Default to private note in My Library
  })
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    url: '',
    domain: '',
    course: '',
    resource_type: '',
    is_private: false,
  })

  // User State
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [currentUserRoll, setCurrentUserRoll] = useState<string>('')
  const [userDomains, setUserDomains] = useState<string[]>([])

  // Action Menu Dropdown State
  const [activeMenuResourceId, setActiveMenuResourceId] = useState<number | null>(null)
  const menuDropdownRef = useRef<HTMLDivElement | null>(null)

  // Feedback Toast State
  const [toast, setToast] = useState<{ message: string; link?: string } | null>(null)
  const [savingDriveTitle, setSavingDriveTitle] = useState<string | null>(null)

  const showToast = (message: string, link?: string) => {
    setToast({ message, link })
    setTimeout(() => setToast(null), 5000)
  }

  // Initial Data Fetch
  useEffect(() => {
    fetchCurrentUser()
    fetchRecommended()
    fetchLibrary()
    fetchExploreResources()
  }, [])

  // Refetch when filters or hub tab changes
  useEffect(() => {
    if (activeHubView === 'library') {
      fetchLibrary()
    } else {
      if (exploreSearch.trim()) {
        handleExploreSearch()
      } else {
        fetchExploreResources()
      }
    }
  }, [activeHubView, exploreFilter])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(e.target as Node)) {
        setActiveMenuResourceId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const fetchLibrary = async () => {
    try {
      setLoadingLibrary(true)
      const data = await myLibraryAPI.getLibrary({
        course: libraryCourseFilter || undefined,
        q: librarySearch || undefined,
      })
      setLibraryItems(data)
    } catch (err) {
      console.error('Failed to fetch library', err)
    } finally {
      setLoadingLibrary(false)
    }
  }

  const fetchExploreResources = async () => {
    try {
      setLoadingExplore(true)
      const params = exploreFilter ? `?domain=${exploreFilter}` : ''
      const res = await api.get(`/resources/${params}`)
      setResources(res.data)
    } catch (err) {
      console.error('Failed to fetch explore resources', err)
    } finally {
      setLoadingExplore(false)
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

  const handleExploreSearch = async () => {
    if (!exploreSearch.trim()) {
      fetchExploreResources()
      return
    }
    try {
      setLoadingExplore(true)
      const params = new URLSearchParams()
      params.set('q', exploreSearch.trim())
      if (exploreFilter) params.set('domain', exploreFilter)
      const res = await api.get(`/resources/search?${params.toString()}`)
      setResources(res.data)
    } catch (err) {
      console.error('Failed to search resources', err)
    } finally {
      setLoadingExplore(false)
    }
  }

  // 1-Click Save / Remove from My Library
  const handleToggleSaveToLibrary = async (resourceId: number, resourceTitle: string) => {
    try {
      const res = await api.post(`/resources/${resourceId}/bookmark`)
      const isSaved = res.data.bookmarked

      // Update Explore Resources state
      setResources((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, user_bookmarked: isSaved } : r))
      )
      setRecommended((prev) =>
        prev.map((r) => (r.id === resourceId ? { ...r, user_bookmarked: isSaved } : r))
      )

      // Refresh My Library items in background
      fetchLibrary()

      showToast(
        isSaved
          ? `Added "${resourceTitle}" to My Library! 📚`
          : `Removed "${resourceTitle}" from My Library`
      )
    } catch (err) {
      console.error('Failed to toggle save to library', err)
    }
  }

  // Google Drive Export
  const handleSaveToDrive = async (item: {
    title: string
    url?: string
    course?: string
    domain?: string
    description?: string
  }) => {
    if (!item.url) return
    try {
      const status = await googleIntegrationsAPI.getStatus()
      if (!status.is_connected) {
        setIsGoogleModalOpen(true)
        return
      }
      setSavingDriveTitle(item.title)
      const res = await googleIntegrationsAPI.exportToDrive({
        title: item.title,
        url: item.url,
        course_code: item.course || item.domain || 'GENERAL',
        year: 2026,
        description: item.description,
      })
      showToast(res.message || `Saved to ${res.folder_path}`, res.web_view_link)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to save resource to Google Drive')
    } finally {
      setSavingDriveTitle(null)
    }
  }

  // Form Submissions
  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/resources/', form)
      setShowAddForm(false)
      setForm({
        title: '',
        description: '',
        url: '',
        domain: 'sde',
        course: '',
        resource_type: '',
        is_private: true,
      })
      showToast('Created new note in My Library! ✍️')
      fetchLibrary()
      fetchExploreResources()
    } catch (err) {
      console.error('Failed to create resource', err)
    }
  }

  const handleEditResource = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingResource) return
    try {
      await api.put(`/resources/${editingResource.id}`, editForm)
      setEditingResource(null)
      showToast('Resource updated successfully!')
      fetchLibrary()
      fetchExploreResources()
    } catch (err) {
      console.error('Failed to edit resource', err)
    }
  }

  const handleDeleteResource = async (id: number) => {
    if (!confirm('Are you sure you want to delete this resource?')) return
    try {
      await api.delete(`/resources/${id}`)
      showToast('Resource deleted')
      setResources((prev) => prev.filter((r) => r.id !== id))
      setLibraryItems((prev) => prev.filter((r) => r.id !== id))
    } catch (err) {
      console.error('Failed to delete resource', err)
    }
  }

  const toggleUpvote = async (id: number) => {
    try {
      const res = await api.post(`/resources/${id}/upvote`)
      setResources((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, upvotes: res.data.upvotes, user_upvoted: res.data.user_upvoted } : r
        )
      )
    } catch (err) {
      console.error('Failed to toggle upvote', err)
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
      is_private: resource.is_private || false,
    })
  }

  const canEdit = (resource: Resource) => {
    const isAdmin = currentUserRoll?.startsWith('admin') || false
    return isAdmin || resource.uploader_id === currentUserId
  }

  const getResourceIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'video':
        return <Play size={20} className="neon-icon text-red-400" />
      case 'course':
        return <BookOpen size={20} className="neon-icon text-blue-400" />
      case 'article':
      case 'notes':
        return <FileText size={20} className="neon-icon text-emerald-400" />
      case 'tool':
        return <Wrench size={20} className="neon-icon text-amber-400" />
      default:
        return <FileQuestion size={20} className="neon-icon text-purple-400" />
    }
  }

  // Extract distinct course tags from library items for quick filter pills
  const availableCourses = useMemo(() => {
    const courses = new Set<string>()
    libraryItems.forEach((it) => {
      if (it.course && it.course.trim()) {
        courses.add(it.course.trim().toUpperCase())
      }
    })
    return Array.from(courses).sort()
  }, [libraryItems])

  // Filtered Library Items
  const displayedLibraryItems = useMemo(() => {
    return libraryItems.filter((item) => {
      // Type filter
      if (libraryTypeFilter === 'notes' && !item.is_private && !item.resource_type?.includes('note')) {
        return false
      }
      if (libraryTypeFilter === 'links' && !item.url) {
        return false
      }
      // Course filter
      if (
        libraryCourseFilter &&
        (!item.course || !item.course.toUpperCase().includes(libraryCourseFilter.toUpperCase()))
      ) {
        return false
      }
      // Search query
      if (librarySearch.trim()) {
        const q = librarySearch.toLowerCase()
        const matchTitle = item.title?.toLowerCase().includes(q)
        const matchDesc = item.description?.toLowerCase().includes(q)
        const matchCourse = item.course?.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchCourse) return false
      }
      return true
    })
  }, [libraryItems, libraryTypeFilter, libraryCourseFilter, librarySearch])

  return (
    <div className="resources-page">
      {/* ── Page Header & Action Controls ── */}
      <div className="resources-header-row">
        <div>
          <h1 className="page-main-title">Academic Resources & Library</h1>
          <p className="page-subtitle">
            Curated student knowledge hub with Google Drive 2-way sync & deadline scheduling
          </p>
        </div>

        <div className="header-action-buttons">
          <button className="primary add-btn" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus size={18} /> Add Note / Link
          </button>
        </div>
      </div>

      {/* ── Apple-Inspired Dual Hub Navigation Switcher ── */}
      <div className="hub-nav-switcher-container">
        <div className="hub-nav-switcher">
          <button
            className={`hub-nav-pill ${activeHubView === 'library' ? 'active' : ''}`}
            onClick={() => setActiveHubView('library')}
          >
            <BookmarkCheck size={18} />
            <span>My Library</span>
            <span className="hub-pill-counter">{libraryItems.length}</span>
          </button>

          <button
            className={`hub-nav-pill ${activeHubView === 'explore' ? 'active' : ''}`}
            onClick={() => setActiveHubView('explore')}
          >
            <Compass size={18} />
            <span>Explore Resources</span>
            <span className="hub-pill-counter">{resources.length}</span>
          </button>
        </div>
      </div>

      {/* ── Toast Notification Banner ── */}
      {toast && (
        <div className="resource-floating-toast">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toast.message}</span>
          {toast.link && (
            <a
              href={toast.link}
              target="_blank"
              rel="noopener noreferrer"
              className="toast-drive-link"
            >
              Open in Drive <ExternalLink size={12} />
            </a>
          )}
        </div>
      )}

      {/* ── Create / Share Resource Modal Form ── */}
      {showAddForm && (
        <div className="card form-card">
          <div className="form-card-header">
            <h3>{form.is_private ? 'Add to My Library (Private Note / Link)' : 'Share Resource with Campus'}</h3>
            <button className="close-btn" onClick={() => setShowAddForm(false)}>
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreateResource}>
            <div className="form-row">
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. CS316 Database Normalization & Indexing Cheat Sheet"
                  required
                />
              </div>
              <div className="form-group">
                <label>Domain *</label>
                <select
                  value={form.domain}
                  onChange={(e) => setForm({ ...form, domain: e.target.value })}
                >
                  {DOMAINS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>URL (Optional if writing notes)</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label>Course / Subject Code</label>
                <input
                  value={form.course}
                  onChange={(e) => setForm({ ...form, course: e.target.value.toUpperCase() })}
                  placeholder="e.g. CS316, CS101"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Description & Notes</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Key concepts, syllabus coverage, or personal remarks..."
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Resource Type</label>
                <select
                  value={form.resource_type}
                  onChange={(e) => setForm({ ...form, resource_type: e.target.value })}
                >
                  <option value="">Select type</option>
                  <option value="notes">Notes</option>
                  <option value="video">Video</option>
                  <option value="article">Article</option>
                  <option value="course">Course</option>
                  <option value="book">Book</option>
                  <option value="tool">Tool</option>
                </select>
              </div>

              <div className="form-group visibility-toggle-box">
                <label className="checkbox-toggle">
                  <input
                    type="checkbox"
                    checked={form.is_private}
                    onChange={(e) => setForm({ ...form, is_private: e.target.checked })}
                  />
                  <span>Save for myself only (Private Note)</span>
                </label>
                <span className="visibility-hint">
                  {form.is_private
                    ? '🔒 Kept securely in your private My Library'
                    : '🌐 Publicly visible to all students in Explore Resources'}
                </span>
              </div>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowAddForm(false)}>
                Cancel
              </button>
              <button type="submit" className="primary">
                Save Note
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 📚 SURFACE 1: MY LIBRARY                                             */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeHubView === 'library' && (
        <div className="my-library-surface">
          {/* Sub-view switcher bar: All | Google Drive Navigator | Saved Links & Notes */}
          <div className="library-subbar">
            <div className="subbar-left">
              <div className="library-type-pills">
                <button
                  className={`type-pill ${libraryTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setLibraryTypeFilter('all')}
                >
                  <Layers size={14} />
                  <span>All Items ({libraryItems.length})</span>
                </button>
                <button
                  className={`type-pill ${libraryTypeFilter === 'drive' ? 'active' : ''}`}
                  onClick={() => setLibraryTypeFilter('drive')}
                >
                  <HardDrive size={14} />
                  <span>Google Drive Explorer</span>
                </button>
                <button
                  className={`type-pill ${libraryTypeFilter === 'links' ? 'active' : ''}`}
                  onClick={() => setLibraryTypeFilter('links')}
                >
                  <Bookmark size={14} />
                  <span>Saved Links & Hero Cards</span>
                </button>
                <button
                  className={`type-pill ${libraryTypeFilter === 'notes' ? 'active' : ''}`}
                  onClick={() => setLibraryTypeFilter('notes')}
                >
                  <FileText size={14} />
                  <span>Personal Notes</span>
                </button>
              </div>
            </div>

            <div className="subbar-right">
              {/* In-Library Search */}
              <div className="library-search-wrap">
                <Search size={15} />
                <input
                  type="text"
                  placeholder="Filter your notes & links..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                />
                {librarySearch && (
                  <button className="clear-search" onClick={() => setLibrarySearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Course Pills Filter Row */}
          {availableCourses.length > 0 && libraryTypeFilter !== 'drive' && (
            <div className="course-pills-row">
              <span className="course-pills-label">Courses:</span>
              <button
                className={`course-pill ${!libraryCourseFilter ? 'active' : ''}`}
                onClick={() => setLibraryCourseFilter('')}
              >
                All Courses
              </button>
              {availableCourses.map((c) => (
                <button
                  key={c}
                  className={`course-pill ${libraryCourseFilter === c ? 'active' : ''}`}
                  onClick={() => setLibraryCourseFilter(libraryCourseFilter === c ? '' : c)}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Conditional Content: Drive Explorer vs Saved Links Cards */}
          {libraryTypeFilter === 'drive' ? (
            <div className="library-drive-view">
              <DriveNavigator
                onOpenTaskModal={(data) => {
                  setTaskModalData(data)
                  setIsTaskModalOpen(true)
                }}
                onConnectGoogle={() => setIsGoogleModalOpen(true)}
                onToast={showToast}
              />
            </div>
          ) : (
            <div className="library-cards-view">
              {/* If "all" selected, display a neat Google Drive Quick Tile banner */}
              {libraryTypeFilter === 'all' && !librarySearch && !libraryCourseFilter && (
                <div className="drive-quick-access-banner" onClick={() => setLibraryTypeFilter('drive')}>
                  <div className="banner-left">
                    <div className="banner-drive-icon">
                      <FolderSync size={26} className="text-primary" />
                    </div>
                    <div>
                      <h5>Google Drive Course Folders</h5>
                      <p>Browse semester hierarchy (<code>ATLAS-Academics/2026/Sem-3/Courses</code>) with 2-way live sync</p>
                    </div>
                  </div>
                  <button className="btn-open-drive-explorer">
                    <span>Open Drive Explorer</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              )}

              {loadingLibrary ? (
                <div className="loading">Loading your library...</div>
              ) : (
                <SavedLinksList
                  items={displayedLibraryItems}
                  onOpenTaskModal={(item) => {
                    setTaskModalData({
                      title: item.title,
                      url: item.url,
                      course_code: item.course,
                      resource_id: item.id,
                      description: item.description,
                    })
                    setIsTaskModalOpen(true)
                  }}
                  onExportToDrive={handleSaveToDrive}
                  onToggleBookmark={(id) => {
                    const item = libraryItems.find((i) => i.id === id)
                    if (item) handleToggleSaveToLibrary(id, item.title)
                  }}
                  onEditItem={openEditModal}
                  onDeleteItem={handleDeleteResource}
                  savingDriveTitle={savingDriveTitle}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 🧭 SURFACE 2: EXPLORE RESOURCES                                      */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeHubView === 'explore' && (
        <div className="explore-resources-surface">
          {/* Search Bar */}
          <div className="search-bar">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search community resources by title, description, or course..."
              value={exploreSearch}
              onChange={(e) => setExploreSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleExploreSearch()
              }}
            />
            {exploreSearch && (
              <button
                className="clear-search"
                onClick={() => {
                  setExploreSearch('')
                  fetchExploreResources()
                }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Domain Filters */}
          <div className="filters">
            <button
              className={`filter-btn ${!exploreFilter ? 'active' : ''}`}
              onClick={() => setExploreFilter('')}
            >
              All Domains
            </button>
            {DOMAINS.map((d) => (
              <button
                key={d.value}
                className={`filter-btn ${exploreFilter === d.value ? 'active' : ''}`}
                onClick={() => setExploreFilter(d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Recommended Section */}
          {recommended.filter((r) => !exploreFilter || r.domain === exploreFilter).length > 0 &&
            !exploreSearch &&
            (!exploreFilter || userDomains.includes(exploreFilter)) && (
              <div className="recommended-section">
                <h2>
                  <Star size={20} className="text-amber-500 fill-amber-500" /> Recommended for You
                </h2>
                <div className="recommended-grid">
                  {recommended
                    .filter((r) => !exploreFilter || r.domain === exploreFilter)
                    .slice(0, 4)
                    .map((rec) => (
                      <div key={rec.id} className="resource-card card recommended-card">
                        <div className="card-top-row">
                          <div className="icon-container amber-icon">
                            <Star size={18} color="#d97706" />
                          </div>
                          <div className="card-actions-right">
                            <span className="match-badge">{rec.match_score}% match</span>
                            <button
                              className={`save-to-lib-btn ${rec.user_bookmarked ? 'saved' : ''}`}
                              onClick={() => handleToggleSaveToLibrary(rec.id, rec.title)}
                              title={rec.user_bookmarked ? 'Saved in My Library' : 'Save to My Library'}
                            >
                              {rec.user_bookmarked ? (
                                <>
                                  <BookmarkCheck size={14} className="text-accent" />
                                  <span>Saved</span>
                                </>
                              ) : (
                                <>
                                  <Bookmark size={14} />
                                  <span>Save</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        <h3 className="rec-card-title">{rec.title}</h3>
                        <p className="rec-card-desc">{rec.description}</p>

                        <div className="match-reasons">
                          {rec.match_reasons.map((reason, i) => (
                            <span key={i} className="reason-tag">
                              ✓ {reason}
                            </span>
                          ))}
                        </div>

                        <div className="card-footer">
                          <span className="card-meta">
                            {rec.resource_type || 'Resource'} • {rec.domain.toUpperCase()}
                          </span>
                          {rec.url && (
                            <a
                              href={rec.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="card-link explore-link"
                            >
                              Explore <ArrowRight size={14} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

          {/* Resources Grid */}
          {loadingExplore ? (
            <div className="loading">Loading curated resources...</div>
          ) : resources.length === 0 ? (
            <div className="empty-state">
              No resources found for this search/filter. Be the first to share one!
            </div>
          ) : (
            <div className="resources-grid">
              {resources.map((resource) => {
                const isOwner = canEdit(resource)
                const isDropdownOpen = activeMenuResourceId === resource.id

                return (
                  <div key={resource.id} className="resource-card card card-hover">
                    <div className="card-top-row">
                      <div className="icon-container">{getResourceIcon(resource.resource_type)}</div>
                      <div
                        className="card-actions-right"
                        ref={isDropdownOpen ? menuDropdownRef : null}
                      >
                        <span className={`domain-badge ${getDomainBadgeClass(resource.domain)}`}>
                          {resource.domain.toUpperCase()}
                        </span>
                        {resource.is_curated && <span className="curated-badge">⭐ Curated</span>}

                        {/* 1-Click Save to Library Toggle Button */}
                        <button
                          className={`save-to-lib-btn ${resource.user_bookmarked ? 'saved' : ''}`}
                          onClick={() => handleToggleSaveToLibrary(resource.id, resource.title)}
                          title={resource.user_bookmarked ? 'In My Library (click to remove)' : 'Save to My Library'}
                        >
                          {resource.user_bookmarked ? (
                            <>
                              <BookmarkCheck size={14} className="text-emerald-400" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <>
                              <Bookmark size={14} />
                              <span>Save to Library</span>
                            </>
                          )}
                        </button>

                        {/* 3-Dot Action Menu */}
                        <div className="menu-dropdown-container">
                          <button
                            className="icon-action-btn"
                            onClick={() =>
                              setActiveMenuResourceId(isDropdownOpen ? null : resource.id)
                            }
                            aria-label="More actions"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {isDropdownOpen && (
                            <div className="action-popover-menu">
                              <button
                                className="popover-menu-item"
                                onClick={() => {
                                  setActiveMenuResourceId(null)
                                  setTaskModalData({
                                    title: resource.title,
                                    url: resource.url,
                                    course_code: resource.course,
                                    resource_id: resource.id,
                                    description: resource.description,
                                  })
                                  setIsTaskModalOpen(true)
                                }}
                              >
                                <Calendar size={14} className="menu-icon text-accent" />
                                <span>Add to Deadlines & Tasks</span>
                              </button>

                              {resource.url && (
                                <button
                                  className="popover-menu-item"
                                  onClick={() => {
                                    setActiveMenuResourceId(null)
                                    handleSaveToDrive(resource)
                                  }}
                                  disabled={savingDriveTitle === resource.title}
                                >
                                  <HardDrive size={14} className="menu-icon text-primary" />
                                  <span>
                                    {savingDriveTitle === resource.title
                                      ? 'Saving to Drive...'
                                      : 'Save to Google Drive'}
                                  </span>
                                </button>
                              )}

                              {isOwner && (
                                <>
                                  <button
                                    className="popover-menu-item"
                                    onClick={() => {
                                      setActiveMenuResourceId(null)
                                      openEditModal(resource)
                                    }}
                                  >
                                    <Edit2 size={14} className="menu-icon" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    className="popover-menu-item popover-danger"
                                    onClick={() => {
                                      setActiveMenuResourceId(null)
                                      handleDeleteResource(resource.id)
                                    }}
                                  >
                                    <Trash2 size={14} className="menu-icon" />
                                    <span>Delete</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Upvote counter button */}
                        <button
                          className={`upvote-pill ${resource.user_upvoted ? 'upvoted' : ''}`}
                          onClick={() => toggleUpvote(resource.id)}
                          title="Upvote"
                        >
                          <ThumbsUp
                            size={13}
                            fill={resource.user_upvoted ? 'currentColor' : 'none'}
                            className="upvote-icon"
                          />
                          <span>{resource.upvotes}</span>
                        </button>
                      </div>
                    </div>

                    <h3 className="card-title">{resource.title}</h3>
                    <p className="card-desc">{resource.description}</p>

                    <div className="card-footer">
                      <span className="card-meta">
                        {resource.resource_type || 'Resource'}
                        {resource.course ? ` • ${resource.course}` : ''}
                      </span>
                      {resource.url && (
                        <a
                          href={resource.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="card-link"
                        >
                          Visit <ArrowRight size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingResource && (
        <div className="modal-backdrop" onClick={() => setEditingResource(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Resource</h3>
              <button className="close-btn" onClick={() => setEditingResource(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditResource}>
              <div className="form-group">
                <label>Title *</label>
                <input
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>URL</label>
                  <input
                    type="url"
                    value={editForm.url}
                    onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Domain</label>
                  <select
                    value={editForm.domain}
                    onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                  >
                    {DOMAINS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Course</label>
                  <input
                    value={editForm.course}
                    onChange={(e) => setEditForm({ ...editForm, course: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={editForm.resource_type}
                    onChange={(e) => setEditForm({ ...editForm, resource_type: e.target.value })}
                  >
                    <option value="">Select type</option>
                    <option value="notes">Notes</option>
                    <option value="video">Video</option>
                    <option value="article">Article</option>
                    <option value="course">Course</option>
                    <option value="book">Book</option>
                    <option value="tool">Tool</option>
                  </select>
                </div>
              </div>
              <div className="form-group visibility-toggle-box">
                <label className="checkbox-toggle">
                  <input
                    type="checkbox"
                    checked={editForm.is_private}
                    onChange={(e) => setEditForm({ ...editForm, is_private: e.target.checked })}
                  />
                  <span>Save for myself only (Private)</span>
                </label>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setEditingResource(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Add to Deadlines & Tasks Modal ── */}
      <ResourceTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        initialData={taskModalData}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* ── Google Workspace Connect Modal ── */}
      <GoogleConnectModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
      />
    </div>
  )
}

export default Resources
