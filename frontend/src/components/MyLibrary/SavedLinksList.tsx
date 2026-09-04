import React, { useState, useRef, useEffect } from 'react'
import {
  ExternalLink,
  MoreVertical,
  Calendar,
  HardDrive,
  Edit2,
  Trash2,
  Bookmark,
  FileText,
  Play,
  Code,
  BookOpen,
  GraduationCap,
  Globe,
} from 'lucide-react'
import { LibraryResource } from '../../utils/api'
import { getDomainBadgeClass } from '../../utils/helpers'

interface SavedLinksListProps {
  items: LibraryResource[]
  onOpenTaskModal: (item: LibraryResource) => void
  onExportToDrive: (item: LibraryResource) => void
  onToggleBookmark: (id: number) => void
  onEditItem?: (item: LibraryResource) => void
  onDeleteItem?: (id: number) => void
  savingDriveTitle?: string | null
}

interface DomainBrand {
  label: string
  color: string
  bg: string
  icon: React.ReactNode
}

export function detectDomainBrand(urlStr?: string): DomainBrand {
  if (!urlStr) {
    return {
      label: 'Academic Note',
      color: '#a855f7',
      bg: 'rgba(168, 85, 247, 0.15)',
      icon: <FileText size={14} />,
    }
  }

  try {
    const url = new URL(urlStr.startsWith('http') ? urlStr : `https://${urlStr}`)
    const host = url.hostname.toLowerCase()

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      return {
        label: 'YouTube',
        color: '#ff4444',
        bg: 'rgba(255, 68, 68, 0.15)',
        icon: <Play size={14} />,
      }
    }
    if (host.includes('github.com')) {
      return {
        label: 'GitHub',
        color: '#e2e8f0',
        bg: 'rgba(226, 232, 240, 0.15)',
        icon: <Code size={14} />,
      }
    }
    if (host.includes('coursera.org')) {
      return {
        label: 'Coursera',
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.15)',
        icon: <BookOpen size={14} />,
      }
    }
    if (host.includes('nptel.ac.in') || host.includes('swayam.gov.in')) {
      return {
        label: 'NPTEL / Swayam',
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        icon: <GraduationCap size={14} />,
      }
    }
    if (host.includes('arxiv.org')) {
      return {
        label: 'arXiv Paper',
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        icon: <FileText size={14} />,
      }
    }
    if (host.includes('overleaf.com')) {
      return {
        label: 'Overleaf LaTeX',
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.15)',
        icon: <Edit2 size={14} />,
      }
    }
    if (host.includes('drive.google.com') || host.includes('docs.google.com')) {
      return {
        label: 'Google Drive',
        color: '#60a5fa',
        bg: 'rgba(96, 165, 250, 0.15)',
        icon: <HardDrive size={14} />,
      }
    }
    if (host.includes('wikipedia.org')) {
      return {
        label: 'Wikipedia',
        color: '#94a3b8',
        bg: 'rgba(148, 163, 184, 0.15)',
        icon: <Globe size={14} />,
      }
    }

    const simpleHost = host.replace(/^www\./, '')
    return {
      label: simpleHost,
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
      icon: <Globe size={14} />,
    }
  } catch {
    return {
      label: 'Resource Link',
      color: '#38bdf8',
      bg: 'rgba(56, 189, 248, 0.15)',
      icon: <Globe size={14} />,
    }
  }
}

export const SavedLinksList: React.FC<SavedLinksListProps> = ({
  items,
  onOpenTaskModal,
  onExportToDrive,
  onToggleBookmark,
  onEditItem,
  onDeleteItem,
  savingDriveTitle,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (items.length === 0) {
    return (
      <div className="empty-library-state">
        <div className="empty-icon-circle">
          <Bookmark size={36} className="text-muted" />
        </div>
        <h4>No saved resources in your library yet</h4>
        <p>
          Save curated items from the <strong>Explore Resources</strong> catalog or add your own notes and links
          to build your personalized study deck.
        </p>
      </div>
    )
  }

  return (
    <div className="saved-links-grid">
      {items.map((item) => {
        const brand = detectDomainBrand(item.url)
        const isSavingDrive = savingDriveTitle === item.title

        return (
          <div key={item.id} className="hero-link-card">
            {/* Top Bar: Brand Badge & 3-Dot Action Menu */}
            <div className="card-top-bar">
              <div
                className="brand-pill"
                style={{ color: brand.color, backgroundColor: brand.bg }}
              >
                {brand.icon}
                <span>{brand.label}</span>
              </div>

              <div className="card-top-actions" ref={activeMenuId === item.id ? menuRef : null}>
                {item.course && <span className="course-code-badge">{item.course}</span>}

                <div className="menu-dropdown-container">
                  <button
                    className="icon-action-btn"
                    onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                    aria-label="Actions menu"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {activeMenuId === item.id && (
                    <div className="action-popover-menu">
                      <button
                        className="popover-menu-item"
                        onClick={() => {
                          setActiveMenuId(null)
                          onOpenTaskModal(item)
                        }}
                      >
                        <Calendar size={15} className="menu-icon text-accent" />
                        <span>Add to Deadlines & Tasks</span>
                      </button>

                      {item.url && (
                        <button
                          className="popover-menu-item"
                          onClick={() => {
                            setActiveMenuId(null)
                            onExportToDrive(item)
                          }}
                          disabled={isSavingDrive}
                        >
                          <HardDrive size={15} className="menu-icon text-primary" />
                          <span>{isSavingDrive ? 'Saving...' : 'Export to Google Drive'}</span>
                        </button>
                      )}

                      {item.is_owner && onEditItem && (
                        <button
                          className="popover-menu-item"
                          onClick={() => {
                            setActiveMenuId(null)
                            onEditItem(item)
                          }}
                        >
                          <Edit2 size={15} className="menu-icon" />
                          <span>Edit Note</span>
                        </button>
                      )}

                      <button
                        className="popover-menu-item popover-danger"
                        onClick={() => {
                          setActiveMenuId(null)
                          if (item.is_owner && onDeleteItem) {
                            onDeleteItem(item.id)
                          } else {
                            onToggleBookmark(item.id)
                          }
                        }}
                      >
                        <Trash2 size={15} className="menu-icon" />
                        <span>{item.is_owner ? 'Delete Resource' : 'Remove from Library'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Title & Description */}
            <div className="card-main-content">
              <h4 className="link-title">{item.title}</h4>
              {item.description && <p className="link-desc">{item.description}</p>}
            </div>

            {/* Bottom Meta & External Button */}
            <div className="card-footer-bar">
              <div className="meta-pills">
                <span className={`domain-badge ${getDomainBadgeClass(item.domain)}`}>
                  {item.domain?.toUpperCase()}
                </span>
                {item.resource_type && (
                  <span className="type-badge">
                    {item.resource_type}
                  </span>
                )}
                {item.is_private && (
                  <span className="private-badge">
                    Personal Note
                  </span>
                )}
              </div>

              {item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="open-link-btn"
                  title="Open in new tab"
                >
                  <span>Open</span>
                  <ExternalLink size={14} />
                </a>
              ) : (
                <button
                  className="open-link-btn secondary"
                  onClick={() => onOpenTaskModal(item)}
                >
                  <Calendar size={14} />
                  <span>Schedule</span>
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default SavedLinksList
