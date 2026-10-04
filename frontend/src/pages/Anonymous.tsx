import React, { useState, useEffect, useCallback } from 'react'
import {
  Plus,
  Search,
  KeyRound,
  LifeBuoy,
  Flame,
  Clock,
  Sparkles,
  MessageSquareOff,
  Filter,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  Building2,
  GraduationCap,
  Heart,
  Briefcase,
  ShieldAlert,
  Landmark,
  Compass,
  Megaphone,
} from 'lucide-react'
import api, {
  AnonymousCategory,
  AnonymousPostV2Item,
  AnonymousMeResponse,
} from '../utils/api'
import PostCard from '../components/Anonymous/PostCard'
import PostComposer from '../components/Anonymous/PostComposer'
import CrisisDirectory from '../components/Anonymous/CrisisDirectory'
import RecoveryKeyModal from '../components/Anonymous/RecoveryKeyModal'
import ReportModal from '../components/Anonymous/ReportModal'
import './Anonymous.css'

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'hostel-mess': <Building2 size={16} />,
  'academics': <GraduationCap size={16} />,
  'wellbeing': <Heart size={16} />,
  'placements': <Briefcase size={16} />,
  'harassment': <ShieldAlert size={16} />,
  'administration': <Landmark size={16} />,
  'insti-life': <Compass size={16} />,
  'official': <Megaphone size={16} />,
}

export function Anonymous() {
  // Navigation & Data States
  const [categories, setCategories] = useState<AnonymousCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [activeTab, setActiveTab] = useState<'all' | 'grievances' | 'conversations' | 'most-affected' | 'unanswered'>('all')
  const [activeSort, setActiveSort] = useState<'hot' | 'new' | 'top' | 'affected'>('hot')
  const [searchQuery, setSearchQuery] = useState('')
  const [posts, setPosts] = useState<AnonymousPostV2Item[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // UI Flow States
  const [showComposer, setShowComposer] = useState(false)
  const [showCrisisDirectory, setShowCrisisDirectory] = useState(false)
  const [showRecoveryModal, setShowRecoveryModal] = useState(false)

  // Report Modal States
  const [reportTarget, setReportTarget] = useState<{
    targetType: 'post' | 'reply'
    targetId: number
    title: string
  } | null>(null)

  // User & Identity State
  const [identity, setIdentity] = useState<AnonymousMeResponse | null>(null)
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null)

  // 1. Fetch Identity & Stored Key
  const fetchIdentity = useCallback(async () => {
    try {
      const res = await api.get('/anonymous/me')
      setIdentity(res.data)
      const storedKey = localStorage.getItem('atlas_recovery_key')
      setRecoveryKey(storedKey)
    } catch (err) {
      console.error('Failed to fetch anonymous identity', err)
    }
  }, [])

  // 2. Fetch Categories
  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/anonymous/categories')
      setCategories(res.data)
    } catch (err) {
      console.error('Failed to fetch categories', err)
    }
  }, [])

  // 3. Fetch Posts Feed
  const fetchFeed = useCallback(async () => {
    setErrorMsg('')
    try {
      if (searchQuery.trim().length >= 2) {
        const searchRes = await api.post('/anonymous/search', {
          query: searchQuery.trim(),
          category: selectedCategory !== 'all' ? selectedCategory : null,
        })
        setPosts(searchRes.data?.items || [])
      } else {
        const params = new URLSearchParams()
        params.set('tab', activeTab)
        params.set('sort', activeSort)
        if (selectedCategory !== 'all') {
          params.set('category', selectedCategory)
        }
        params.set('limit', '30')

        const res = await api.get(`/anonymous/feed?${params.toString()}`)
        setPosts(res.data?.items || [])
      }
    } catch (err: any) {
      console.error('Failed to fetch anonymous feed', err)
      setErrorMsg(err.response?.data?.detail || 'Failed to load posts. Please try again.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab, activeSort, selectedCategory, searchQuery])

  useEffect(() => {
    fetchIdentity()
    fetchCategories()
  }, [fetchIdentity, fetchCategories])

  useEffect(() => {
    setLoading(true)
    fetchFeed()
  }, [fetchFeed])

  // Voting handler
  const handleVote = async (targetType: 'post' | 'reply', targetId: number, value: number) => {
    await api.post('/anonymous/vote', {
      target_type: targetType,
      target_id: targetId,
      value,
    })
  }

  // MeToo handler
  const handleToggleMeToo = async (postId: number) => {
    await api.post(`/anonymous/posts/${postId}/metoo`)
  }

  // Report opening
  const handleOpenReport = (targetType: 'post' | 'reply', targetId: number, title: string) => {
    setReportTarget({ targetType, targetId, title })
  }

  const isStudentLoggedIn = Boolean(identity?.is_student_logged_in)
  const studentName = identity?.student?.name
  const studentMeta = identity?.student
    ? `${identity.student.year ? `${identity.student.year}th Year, ` : ''}${identity.student.branch || ''}`
    : ''
  const isSenior = Boolean(identity?.student?.is_senior)

  return (
    <div className="anonymous-portal-container">
      {/* ── Top Hero & Actions ─────────────────────────────────────────────── */}
      <header className="portal-header">
        <div className="portal-header-text">
          <div className="portal-badge-row">
            <span className="portal-pill-badge">
              <ShieldCheck size={14} className="text-emerald" /> Cryptographically Decoupled
            </span>
            <span className="portal-pill-badge insti">
              IIT Bombay Campus Community
            </span>
          </div>
          <h1 className="portal-title">Anonymous Portal</h1>
          <p className="portal-desc">
            Vulnerable questions, hostel grievances, and insti discussions — zero roll number correlation, guaranteed.
          </p>
        </div>

        <div className="portal-header-actions">
          {/* Recovery Key / Identity Button */}
          <button
            type="button"
            className="secondary-btn identity-btn"
            onClick={() => setShowRecoveryModal(true)}
            title="Manage your anonymous identity & recovery key"
          >
            <KeyRound size={16} />
            <span>{recoveryKey ? 'My Recovery Key' : 'Anonymous Identity'}</span>
          </button>

          {/* Emergency Crisis Directory Button */}
          <button
            type="button"
            className="secondary-btn crisis-btn"
            onClick={() => setShowCrisisDirectory(!showCrisisDirectory)}
            title="View 24×7 IITB medical, counselling, and security helplines"
          >
            <LifeBuoy size={16} className="text-rose" />
            <span>24×7 Helplines</span>
          </button>

          {/* New Post Button */}
          <button
            type="button"
            className="primary-btn new-post-btn"
            onClick={() => setShowComposer(!showComposer)}
          >
            <Plus size={18} />
            <span>New Discussion</span>
          </button>
        </div>
      </header>

      {/* ── Floating Crisis Directory Drawer / Card ──────────────────────── */}
      {showCrisisDirectory && (
        <div className="crisis-drawer-overlay" onClick={() => setShowCrisisDirectory(false)}>
          <div className="crisis-drawer-card" onClick={(e) => e.stopPropagation()}>
            <CrisisDirectory onClose={() => setShowCrisisDirectory(false)} isFloating={true} />
          </div>
        </div>
      )}

      {/* ── Post Composer ─────────────────────────────────────────────────── */}
      {showComposer && (
        <section className="composer-wrapper">
          <PostComposer
            categories={categories}
            isStudentLoggedIn={isStudentLoggedIn}
            studentName={studentName}
            studentMeta={studentMeta}
            isSenior={isSenior}
            userRole={identity?.student?.role}
            onPostCreated={() => {
              setShowComposer(false)
              fetchFeed()
              fetchCategories()
            }}
            onCancel={() => setShowComposer(false)}
          />
        </section>
      )}

      {/* ── Search & Filter Controls ───────────────────────────────────────── */}
      <section className="portal-controls-bar">
        {/* Search Input */}
        <div className="portal-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search grievances, courses, profs, hostels..."
            className="portal-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Sort Pills */}
        <div className="sort-pills-row" role="tablist" aria-label="Sort options">
          <button
            type="button"
            className={`sort-pill ${activeSort === 'hot' ? 'active' : ''}`}
            onClick={() => setActiveSort('hot')}
            role="tab"
            aria-selected={activeSort === 'hot'}
          >
            <Flame size={14} className="text-amber" />
            <span>Hot</span>
          </button>
          <button
            type="button"
            className={`sort-pill ${activeSort === 'affected' ? 'active' : ''}`}
            onClick={() => setActiveSort('affected')}
            role="tab"
            aria-selected={activeSort === 'affected'}
          >
            <Sparkles size={14} className="text-primary" />
            <span>Most Affected</span>
          </button>
          <button
            type="button"
            className={`sort-pill ${activeSort === 'new' ? 'active' : ''}`}
            onClick={() => setActiveSort('new')}
            role="tab"
            aria-selected={activeSort === 'new'}
          >
            <Clock size={14} />
            <span>New</span>
          </button>
          <button
            type="button"
            className={`sort-pill ${activeSort === 'top' ? 'active' : ''}`}
            onClick={() => setActiveSort('top')}
            role="tab"
            aria-selected={activeSort === 'top'}
          >
            <span>Top</span>
          </button>
        </div>
      </section>

      {/* ── Category Filter Chips ──────────────────────────────────────────── */}
      <nav className="category-chips-strip" aria-label="Categories">
        <button
          type="button"
          className={`category-chip ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          <Filter size={14} />
          <span>All Discussions</span>
        </button>

        {categories.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={`category-chip ${selectedCategory === c.slug ? 'active' : ''}`}
            onClick={() => setSelectedCategory(c.slug)}
          >
            {CATEGORY_ICONS[c.slug] || <Filter size={14} />}
            <span>{c.name}</span>
            {c.post_count > 0 && <span className="cat-count">{c.post_count}</span>}
          </button>
        ))}
      </nav>

      {/* ── Discussion Type Tabs ───────────────────────────────────────────── */}
      <div className="filter-tabs-row">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Feeds
        </button>
        <button
          className={`tab-btn ${activeTab === 'grievances' ? 'active' : ''}`}
          onClick={() => setActiveTab('grievances')}
        >
          📢 Grievances
        </button>
        <button
          className={`tab-btn ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          💭 Conversations
        </button>
        <button
          className={`tab-btn ${activeTab === 'unanswered' ? 'active' : ''}`}
          onClick={() => setActiveTab('unanswered')}
        >
          <MessageSquareOff size={14} /> Unanswered
        </button>
      </div>

      {/* ── Error Banner ───────────────────────────────────────────────────── */}
      {errorMsg && (
        <div className="alert-banner alert-error mb-4" role="alert">
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
          <button
            type="button"
            className="retry-btn"
            onClick={fetchFeed}
            disabled={refreshing}
          >
            <RefreshCw size={13} className={refreshing ? 'spin' : ''} /> Retry
          </button>
        </div>
      )}

      {/* ── Posts List Feed ────────────────────────────────────────────────── */}
      <main className="posts-feed-section">
        {loading ? (
          <div className="feed-loading-skeleton" aria-busy="true" aria-label="Loading posts">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="post-skeleton card">
                <div className="skeleton-row line-short" />
                <div className="skeleton-row line-title" />
                <div className="skeleton-row line-body" />
                <div className="skeleton-row line-body" />
                <div className="skeleton-row line-actions" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="empty-feed-card card">
            <div className="empty-icon-circle">
              <Compass size={36} className="text-muted" />
            </div>
            <h3>No discussions found in this view</h3>
            <p>
              {searchQuery
                ? `No posts matched your search for "${searchQuery}". Try different keywords.`
                : 'Be the first to raise a grievance or share a question with the IIT Bombay community.'}
            </p>
            <button
              type="button"
              className="primary-btn mt-3"
              onClick={() => setShowComposer(true)}
            >
              <Plus size={16} /> Start a Discussion
            </button>
          </div>
        ) : (
          <div className="posts-list-stack">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                isStudentLoggedIn={isStudentLoggedIn}
                studentName={studentName}
                studentMeta={studentMeta}
                onVote={handleVote}
                onToggleMeToo={handleToggleMeToo}
                onReport={handleOpenReport}
                onOpenCrisisHelp={() => setShowCrisisDirectory(true)}
                onPostUpdated={fetchFeed}
              />
            ))}
          </div>
        )}
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <RecoveryKeyModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        currentRecoveryKey={recoveryKey}
        accountId={identity?.anon_account_id || null}
        isStudentLoggedIn={isStudentLoggedIn}
        onIdentityChanged={() => {
          fetchIdentity()
          fetchFeed()
        }}
      />

      {reportTarget && (
        <ReportModal
          isOpen={true}
          onClose={() => setReportTarget(null)}
          targetType={reportTarget.targetType}
          targetId={reportTarget.targetId}
          targetTitle={reportTarget.title}
        />
      )}
    </div>
  )
}
export default Anonymous