import React, { useState, useEffect, useMemo } from 'react'
import {
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  Calendar,
  Building,
  Sparkles,
  Link2,
  X,
  Compass,
} from 'lucide-react'
import './QuickLinks.css'

interface QuickLinkItem {
  id: string
  title: string
  url: string
  category: 'portals' | 'calendar' | 'personal'
  description?: string
  badge?: string
  isOfficial?: boolean
}

const OFFICIAL_LINKS: QuickLinkItem[] = [
  // Portals & Systems
  {
    id: 'internal-asc',
    title: 'Internal ASC',
    url: 'https://asc.iitb.ac.in/',
    category: 'portals',
    description: 'On-campus Academic Services Cloud for registrations, fee receipts, and official grades.',
    badge: 'On-Campus',
    isOfficial: true,
  },
  {
    id: 'external-asc',
    title: 'External ASC',
    url: 'https://portal.iitb.ac.in/asc/Login',
    category: 'portals',
    description: 'External off-campus login portal for Academic Services Cloud.',
    badge: 'Remote Access',
    isOfficial: true,
  },
  {
    id: 'iitb-moodle',
    title: 'IITB Moodle',
    url: 'https://moodle.iitb.ac.in/login/index.php',
    category: 'portals',
    description: 'Course lecture slides, assignments, quiz submissions, and instructor announcements.',
    badge: 'Academics',
    isOfficial: true,
  },
  {
    id: 'central-library',
    title: 'Central Library',
    url: 'https://library.iitb.ac.in/',
    category: 'portals',
    description: 'Search catalog, access IEEE / ACM digital subscriptions, journals, and thesis archives.',
    badge: 'Library',
    isOfficial: true,
  },
  // Calendar & Schedules
  {
    id: 'academic-calendar',
    title: 'Academic Calendar',
    url: 'https://acad.iitb.ac.in/academics/calendar-and-timetable',
    category: 'calendar',
    description: 'Official semester calendar with instruction dates, midsem/endsem exam windows, and recess.',
    badge: 'Calendar',
    isOfficial: true,
  },
  {
    id: 'academic-timetable',
    title: 'Academic Timetable',
    url: 'https://acad.iitb.ac.in/academics/calendar-and-timetable',
    category: 'calendar',
    description: 'Institute slot matrix, weekly lecture schedules, and classroom slot distributions.',
    badge: 'Timetable',
    isOfficial: true,
  },
  {
    id: 'course-info',
    title: 'Course Information',
    url: 'https://portal.iitb.ac.in/asc/Courses',
    category: 'calendar',
    description: 'Comprehensive directory of active institute courses, syllabus, and prerequisites.',
    badge: 'Curriculum',
    isOfficial: true,
  },
  {
    id: 'holidays-list',
    title: 'Holidays List',
    url: 'https://www.iitb.ac.in/holidays-list',
    category: 'calendar',
    description: 'Gazetted institute public holidays and mid-semester recess schedule.',
    badge: 'Holidays',
    isOfficial: true,
  },
  {
    id: 'circulars',
    title: 'Academic Circulars',
    url: 'https://www.iitb.ac.in/newacadhome/circular.jsp',
    category: 'calendar',
    description: 'Latest notifications, rules amendments, and official notices from the Academic Office.',
    badge: 'Notices',
    isOfficial: true,
  },
]

const STORAGE_KEY = 'atlas_student_instant_links'

export default function QuickLinks() {
  const [personalLinks, setPersonalLinks] = useState<QuickLinkItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'portals' | 'calendar' | 'personal'>('all')
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // New link form state
  const [newTitle, setNewTitle] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newDesc, setNewDesc] = useState('')

  // Load custom links from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setPersonalLinks(JSON.parse(stored))
      }
    } catch {
      // Fallback if localStorage parsing fails
    }
  }, [])

  const savePersonalLinks = (links: QuickLinkItem[]) => {
    setPersonalLinks(links)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(links))
    } catch {
      // Ignore write errors
    }
  }

  const handleAddLink = (e: React.FormEvent) => {
    e.preventDefault()
    let cleanUrl = newUrl.trim()
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`
    }

    const newItem: QuickLinkItem = {
      id: `custom-${Date.now()}`,
      title: newTitle.trim(),
      url: cleanUrl,
      category: 'personal',
      description: newDesc.trim() || 'Custom student shortcut',
      badge: 'Personal',
      isOfficial: false,
    }

    savePersonalLinks([newItem, ...personalLinks])
    setNewTitle('')
    setNewUrl('')
    setNewDesc('')
    setIsAddModalOpen(false)
  }

  const handleDeleteLink = (id: string) => {
    savePersonalLinks(personalLinks.filter((l) => l.id !== id))
  }

  const handleCopyLink = (item: QuickLinkItem) => {
    navigator.clipboard.writeText(item.url)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Combine links
  const allLinks = useMemo(() => {
    return [...OFFICIAL_LINKS, ...personalLinks]
  }, [personalLinks])

  // Filter links
  const filteredLinks = useMemo(() => {
    return allLinks.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory
      const query = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !query ||
        item.title.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query)) ||
        item.url.toLowerCase().includes(query) ||
        (item.badge && item.badge.toLowerCase().includes(query))
      return matchesCategory && matchesSearch
    })
  }, [allLinks, selectedCategory, searchQuery])

  // Group filtered links
  const portals = filteredLinks.filter((l) => l.category === 'portals')
  const calendarLinks = filteredLinks.filter((l) => l.category === 'calendar')
  const customLinks = filteredLinks.filter((l) => l.category === 'personal')

  return (
    <div className="quick-links-page">
      {/* ── Page Header ── */}
      <header className="ql-header">
        <div className="ql-title-group">
          <div className="ql-pill">
            <Compass size={13} className="ql-pill-icon" />
            <span>INSTITUTE PORTALS & SHORTCUTS</span>
          </div>
          <h1>Quick Links</h1>
          <p className="ql-subtitle">
            One-tap launchpad to official IIT Bombay systems, academic calendars, timetables, and your personal shortcuts.
          </p>
        </div>

        <button
          className="ql-add-btn"
          onClick={() => setIsAddModalOpen(true)}
          title="Add Instant Link"
        >
          <Plus size={16} />
          <span>Add Custom Link</span>
        </button>
      </header>

      {/* ── Search & Filter Controls ── */}
      <div className="ql-controls">
        <div className="ql-search-wrapper">
          <Search size={16} className="ql-search-icon" />
          <input
            type="text"
            className="ql-search-input"
            placeholder="Search ASC, Moodle, Timetables, Circulars, or your custom links..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="ql-clear-search"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="ql-category-filters">
          <button
            className={`ql-filter-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All ({allLinks.length})
          </button>
          <button
            className={`ql-filter-pill ${selectedCategory === 'portals' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('portals')}
          >
            <Building size={13} />
            Portals ({OFFICIAL_LINKS.filter((l) => l.category === 'portals').length})
          </button>
          <button
            className={`ql-filter-pill ${selectedCategory === 'calendar' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('calendar')}
          >
            <Calendar size={13} />
            Academic & Calendar ({OFFICIAL_LINKS.filter((l) => l.category === 'calendar').length})
          </button>
          <button
            className={`ql-filter-pill ${selectedCategory === 'personal' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('personal')}
          >
            <Sparkles size={13} />
            My Shortcuts ({personalLinks.length})
          </button>
        </div>
      </div>

      {/* ── Content Sections ── */}
      <main className="ql-content">
        {filteredLinks.length === 0 ? (
          <div className="ql-empty-state">
            <Link2 size={36} className="ql-empty-icon" />
            <h3>No links match your search</h3>
            <p>Try searching with another keyword or add a new personal shortcut.</p>
            {searchQuery && (
              <button className="ql-btn-secondary" onClick={() => setSearchQuery('')}>
                Clear Filter
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Custom Links Section */}
            {customLinks.length > 0 && (
              <section className="ql-section">
                <div className="ql-section-header">
                  <div className="ql-section-title">
                    <Sparkles size={18} className="ql-section-icon ql-icon-purple" />
                    <h2>My Instant Links</h2>
                  </div>
                  <span className="ql-section-count">{customLinks.length} saved</span>
                </div>
                <div className="ql-grid">
                  {customLinks.map((item) => (
                    <LinkCard
                      key={item.id}
                      item={item}
                      copied={copiedId === item.id}
                      onCopy={() => handleCopyLink(item)}
                      onDelete={() => handleDeleteLink(item.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Portals Section */}
            {portals.length > 0 && (
              <section className="ql-section">
                <div className="ql-section-header">
                  <div className="ql-section-title">
                    <Building size={18} className="ql-section-icon ql-icon-blue" />
                    <h2>Core Portals & Systems</h2>
                  </div>
                  <span className="ql-section-count">Official IITB</span>
                </div>
                <div className="ql-grid">
                  {portals.map((item) => (
                    <LinkCard
                      key={item.id}
                      item={item}
                      copied={copiedId === item.id}
                      onCopy={() => handleCopyLink(item)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Calendar & Resources Section */}
            {calendarLinks.length > 0 && (
              <section className="ql-section">
                <div className="ql-section-header">
                  <div className="ql-section-title">
                    <Calendar size={18} className="ql-section-icon ql-icon-amber" />
                    <h2>Academic Calendar & Notices</h2>
                  </div>
                  <span className="ql-section-count">Dean AP</span>
                </div>
                <div className="ql-grid">
                  {calendarLinks.map((item) => (
                    <LinkCard
                      key={item.id}
                      item={item}
                      copied={copiedId === item.id}
                      onCopy={() => handleCopyLink(item)}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* ── Add Custom Link Modal ── */}
      {isAddModalOpen && (
        <div className="ql-modal-backdrop" onClick={() => setIsAddModalOpen(false)}>
          <div
            className="ql-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="ql-modal-header">
              <div className="ql-modal-title">
                <Plus size={18} />
                <h3>Add Personal Shortcut</h3>
              </div>
              <button
                className="ql-modal-close"
                onClick={() => setIsAddModalOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleAddLink} className="ql-modal-form">
              <div className="ql-form-group">
                <label>Shortcut Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Overleaf Project, Lab Cluster, Drive Folder"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="ql-form-group">
                <label>Destination URL *</label>
                <input
                  type="text"
                  required
                  placeholder="https://example.com/..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                />
              </div>

              <div className="ql-form-group">
                <label>Description / Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g., GPU cluster access or Project repository"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                />
              </div>

              <div className="ql-modal-actions">
                <button
                  type="button"
                  className="ql-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="ql-btn-primary">
                  Save Shortcut
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function LinkCard({
  item,
  copied,
  onCopy,
  onDelete,
}: {
  item: QuickLinkItem
  copied: boolean
  onCopy: () => void
  onDelete?: () => void
}) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="ql-card"
    >
      <div className="ql-card-top">
        <div className="ql-card-header-left">
          <span className={`ql-badge ${item.isOfficial ? 'official' : 'custom'}`}>
            {item.badge || (item.isOfficial ? 'Official' : 'Custom')}
          </span>
          <h3 className="ql-card-title">{item.title}</h3>
        </div>

        <div className="ql-card-actions" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`ql-action-icon ${copied ? 'copied' : ''}`}
            onClick={(e) => {
              e.preventDefault()
              onCopy()
            }}
            title={copied ? 'Link Copied!' : 'Copy Link URL'}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          {onDelete && (
            <button
              type="button"
              className="ql-action-icon delete"
              onClick={(e) => {
                e.preventDefault()
                onDelete()
              }}
              title="Delete Shortcut"
            >
              <Trash2 size={14} />
            </button>
          )}

          <span className="ql-launch-icon">
            <ExternalLink size={15} />
          </span>
        </div>
      </div>

      {item.description && (
        <p className="ql-card-desc">{item.description}</p>
      )}

      <div className="ql-card-footer">
        <span className="ql-card-url" title={item.url}>
          {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
        </span>
      </div>
    </a>
  )
}
