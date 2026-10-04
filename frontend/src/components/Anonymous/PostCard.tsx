import React, { useState } from 'react'
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Flag,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Sparkles,
  Send,
  Shield,
  User,
  Heart,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { AnonymousPostV2Item, AnonymousReplyNode } from '../../utils/api'
import { formatDateTime } from '../../utils/helpers'
import ThreadNode from './ThreadNode'
import api from '../../utils/api'

interface PostCardProps {
  post: AnonymousPostV2Item
  isStudentLoggedIn: boolean
  studentName?: string
  studentMeta?: string
  onVote: (targetType: 'post' | 'reply', targetId: number, value: number) => Promise<void>
  onToggleMeToo: (postId: number) => Promise<void>
  onReport: (targetType: 'post' | 'reply', targetId: number, title: string) => void
  onOpenCrisisHelp: () => void
  onPostUpdated?: () => void
}

const PASTEL_PALETTE = [
  { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
  { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' },
  { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' },
  { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' },
  { bg: '#f0fdfa', text: '#115e59', border: '#99f6e4' },
]

export const PostCard: React.FC<PostCardProps> = ({
  post,
  isStudentLoggedIn,
  studentName,
  studentMeta,
  onVote,
  onToggleMeToo,
  onReport,
  onOpenCrisisHelp,
  onPostUpdated,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [replies, setReplies] = useState<AnonymousReplyNode[]>(post.replies || [])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyAsAnon, setReplyAsAnon] = useState(true)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [copiedShare, setCopiedShare] = useState(false)

  // Local optimistic states
  const [localVote, setLocalVote] = useState(post.user_vote || 0)
  const [localScore, setLocalScore] = useState(post.score || 0)
  const [localHasMeToo, setLocalHasMeToo] = useState(post.has_metoo || false)
  const [localMeTooCount, setLocalMeTooCount] = useState(post.metoo || 0)
  const [replyCount, setReplyCount] = useState(post.reply_count || 0)

  const isGrievance = post.kind === 'grievance'

  // Author details
  const isAnon = post.is_anonymous
  const authorName = isAnon ? (post.author?.handle || 'Anonymous Student') : (post.author?.name || 'Verified Student')
  const isSenior = !isAnon && (post.author?.is_senior_verified || (post.author?.year || 0) >= 4)
  const authorSub = !isAnon && post.author ? `${post.author.year ? `${post.author.year}th Year, ` : ''}${post.author.branch || ''}` : ''

  const paletteIndex = post.author?.tint ?? (authorName.charCodeAt(0) % PASTEL_PALETTE.length)
  const colorScheme = PASTEL_PALETTE[paletteIndex % PASTEL_PALETTE.length]
  const initials = authorName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  const handleVoteClick = async (val: number) => {
    const prevVote = localVote
    const prevScore = localScore

    let nextVote = 0
    let delta = 0
    if (localVote === val) {
      nextVote = 0
      delta = -val
    } else {
      nextVote = val
      delta = prevVote === 0 ? val : val * 2
    }

    setLocalVote(nextVote)
    setLocalScore(prevScore + delta)

    try {
      await onVote('post', post.id, val)
    } catch {
      setLocalVote(prevVote)
      setLocalScore(prevScore)
    }
  }

  const handleMeTooClick = async () => {
    const prevHas = localHasMeToo
    const prevCount = localMeTooCount

    setLocalHasMeToo(!prevHas)
    setLocalMeTooCount(prevHas ? Math.max(prevCount - 1, 0) : prevCount + 1)

    try {
      await onToggleMeToo(post.id)
    } catch {
      setLocalHasMeToo(prevHas)
      setLocalMeTooCount(prevCount)
    }
  }

  const handleExpandReplies = async () => {
    const nextState = !expanded
    setExpanded(nextState)
    if (nextState && replies.length === 0) {
      setLoadingReplies(true)
      try {
        const res = await api.get(`/anonymous/posts/${post.id}`)
        if (res.data?.replies) {
          setReplies(res.data.replies)
        }
      } catch (err) {
        console.error('Failed to load thread replies', err)
      } finally {
        setLoadingReplies(false)
      }
    }
  }

  const handleTopLevelReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyText.trim() || submittingReply) return
    setSubmittingReply(true)
    try {
      await api.post(`/anonymous/posts/${post.id}/replies`, {
        body: replyText.trim(),
        parent_id: null,
        is_anonymous: replyAsAnon,
      })
      setReplyText('')
      setReplyCount((prev) => prev + 1)
      // Refresh replies
      const res = await api.get(`/anonymous/posts/${post.id}`)
      if (res.data?.replies) {
        setReplies(res.data.replies)
      }
      onPostUpdated?.()
    } catch (err: any) {
      console.error('Failed to submit reply', err)
    } finally {
      setSubmittingReply(false)
    }
  }

  const handleNestedReplySubmit = async (parentId: number, body: string, isAnonymous: boolean) => {
    await api.post(`/anonymous/posts/${post.id}/replies`, {
      body,
      parent_id: parentId,
      is_anonymous: isAnonymous,
    })
    setReplyCount((prev) => prev + 1)
    const res = await api.get(`/anonymous/posts/${post.id}`)
    if (res.data?.replies) {
      setReplies(res.data.replies)
    }
    onPostUpdated?.()
  }

  const handleShare = () => {
    const url = `${window.location.origin}/anonymous?post=${post.slug || post.id}`
    navigator.clipboard.writeText(url)
    setCopiedShare(true)
    setTimeout(() => setCopiedShare(false), 2000)
  }

  return (
    <article className={`post-card card ${post.is_official ? 'official-post' : ''} ${post.has_distress ? 'distress-post' : ''}`}>
      {/* Official Announcement Banner */}
      {post.is_official && (
        <div className="official-banner-strip">
          <Sparkles size={14} className="text-amber" />
          <span>Official Institute Announcement</span>
        </div>
      )}

      {/* High-Intent Distress Alert */}
      {post.has_distress && (
        <div className="distress-banner-strip" role="alert">
          <div className="distress-left">
            <AlertTriangle size={16} className="text-danger" />
            <span>It looks like this post touches upon severe stress or personal struggle. Help is available 24×7.</span>
          </div>
          <button type="button" className="distress-help-btn" onClick={onOpenCrisisHelp}>
            View Campus Helplines
          </button>
        </div>
      )}

      <div className="post-header-row">
        {/* Category Pill */}
        {post.category && (
          <span className={`category-tag cat-${post.category.slug}`}>
            {post.category.name}
          </span>
        )}

        {/* Kind Pill */}
        <span className={`kind-pill ${isGrievance ? 'kind-grievance' : 'kind-conversation'}`}>
          {isGrievance ? '📢 Grievance' : '💭 Conversation'}
        </span>

        {/* Author Metadata */}
        <div className="author-pill">
          <div
            className="author-avatar-sm"
            style={{
              backgroundColor: colorScheme.bg,
              color: colorScheme.text,
              borderColor: colorScheme.border,
            }}
          >
            {initials}
          </div>
          <div className="author-names">
            <span className="author-main-name">
              {authorName}
              {isAnon && <span className="author-badge-op">OP</span>}
            </span>
            {!isAnon && isSenior && (
              <span className="senior-badge-inline" title="Verified Senior (Year 4+)">
                <CheckCircle2 size={12} /> Senior Verified
              </span>
            )}
            {!isAnon && authorSub && (
              <span className="author-dept-text">({authorSub})</span>
            )}
          </div>
        </div>

        <span className="post-timestamp-text">{formatDateTime(post.created_at)}</span>
      </div>

      {/* Post Title */}
      <h2 className="post-title-heading">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <>{children}</>,
          }}
        >
          {post.title}
        </ReactMarkdown>
      </h2>

      {/* Post Markdown Body */}
      <div className="post-body-markdown markdown-content">
        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
          {post.body}
        </ReactMarkdown>
      </div>

      {/* Image Gallery */}
      {post.images && post.images.length > 0 && (
        <div className="post-image-gallery">
          {post.images.map((imgUrl, i) => (
            <div
              key={i}
              className="gallery-thumb-wrap"
              onClick={() => setSelectedImage(imgUrl)}
              role="button"
              tabIndex={0}
              aria-label={`View full image ${i + 1}`}
            >
              <img src={imgUrl} alt={`Attachment ${i + 1}`} loading="lazy" />
              <div className="zoom-hint">
                <ImageIcon size={14} /> Zoom
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {selectedImage && (
        <div className="image-lightbox-modal" onClick={() => setSelectedImage(null)} role="dialog">
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={selectedImage} alt="Attachment full view" />
            <button className="lightbox-close-btn" onClick={() => setSelectedImage(null)} aria-label="Close image">
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Actions Toolbar */}
      <div className="post-actions-toolbar">
        {/* Voting Group */}
        <div className="vote-toolbar-group">
          <button
            type="button"
            className={`vote-btn up ${localVote === 1 ? 'active' : ''}`}
            onClick={() => handleVoteClick(1)}
            aria-label="Upvote post"
          >
            <ArrowBigUp size={18} />
          </button>
          <span className={`vote-score-label ${localScore > 0 ? 'pos' : localScore < 0 ? 'neg' : ''}`}>
            {localScore}
          </span>
          <button
            type="button"
            className={`vote-btn down ${localVote === -1 ? 'active' : ''}`}
            onClick={() => handleVoteClick(-1)}
            aria-label="Downvote post"
          >
            <ArrowBigDown size={18} />
          </button>
        </div>

        {/* Grievance: "Affects me too" button / Conversation: "I feel this too" */}
        <button
          type="button"
          className={`metoo-btn ${localHasMeToo ? 'active' : ''} ${isGrievance ? 'grievance-style' : 'conversation-style'}`}
          onClick={handleMeTooClick}
          aria-pressed={localHasMeToo}
        >
          {isGrievance ? <Flame size={16} className={localHasMeToo ? 'flame-active' : ''} /> : <Heart size={16} />}
          <span className="metoo-label">
            {isGrievance ? 'Affects me too' : 'I feel this too'}
          </span>
          <span className="metoo-badge">{localMeTooCount}</span>
        </button>

        {/* Comment Count / Expand Toggle */}
        <button
          type="button"
          className={`toolbar-btn comment-btn ${expanded ? 'active' : ''}`}
          onClick={handleExpandReplies}
          aria-expanded={expanded}
        >
          <MessageSquare size={16} />
          <span>{replyCount} {replyCount === 1 ? 'Reply' : 'Replies'}</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {/* Share Button */}
        <button
          type="button"
          className="toolbar-btn share-btn"
          onClick={handleShare}
          title="Share thread link"
        >
          <Share2 size={15} />
          <span>{copiedShare ? 'Copied Link!' : 'Share'}</span>
        </button>

        {/* Report Button */}
        <button
          type="button"
          className="toolbar-btn report-btn"
          onClick={() => onReport('post', post.id, post.title)}
          title="Report this post"
        >
          <Flag size={14} />
          <span>Report</span>
        </button>
      </div>

      {/* Expanded Comments & Recursive Thread Tree */}
      {expanded && (
        <section className="post-expanded-thread" aria-label="Replies">
          <div className="thread-divider" />

          {/* Top-Level Reply Composer */}
          <form onSubmit={handleTopLevelReply} className="top-reply-composer">
            {isStudentLoggedIn && (
              <div className="reply-mode-switcher">
                <span className="mode-label">Reply as:</span>
                <button
                  type="button"
                  className={`mode-pill ${replyAsAnon ? 'active' : ''}`}
                  onClick={() => setReplyAsAnon(true)}
                >
                  <Shield size={12} /> Anonymous (Ephemeral Handle)
                </button>
                <button
                  type="button"
                  className={`mode-pill ${!replyAsAnon ? 'active' : ''}`}
                  onClick={() => setReplyAsAnon(false)}
                >
                  <User size={12} /> {studentName || 'Verified Profile'} {studentMeta ? `(${studentMeta})` : ''}
                </button>
              </div>
            )}

            <div className="top-reply-input-box">
              <textarea
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Join the discussion... (Markdown supported)"
                className="top-reply-textarea"
              />
              <div className="top-reply-footer">
                <span className="markdown-hint">LaTeX equations e.g. $e^{"{i\\pi}"}$ & Markdown supported</span>
                <button
                  type="submit"
                  className="primary-btn submit-btn"
                  disabled={submittingReply || !replyText.trim()}
                >
                  <Send size={14} />
                  <span>{submittingReply ? 'Posting...' : 'Post Reply'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* Replies Tree */}
          {loadingReplies ? (
            <div className="loading-replies">
              <div className="skeleton-bar" />
              <div className="skeleton-bar short" />
            </div>
          ) : replies.length === 0 ? (
            <div className="empty-thread-notice">
              <MessageSquare size={24} className="text-muted" />
              <p>No replies yet. Be the first to add your perspective!</p>
            </div>
          ) : (
            <div className="thread-replies-list">
              {replies.map((replyNode) => (
                <ThreadNode
                  key={replyNode.id}
                  node={replyNode}
                  postId={post.id}
                  postAuthorHandle={post.author?.handle}
                  isStudentLoggedIn={isStudentLoggedIn}
                  studentName={studentName}
                  studentMeta={studentMeta}
                  onVote={onVote}
                  onReplySubmit={handleNestedReplySubmit}
                  onReport={onReport}
                  depth={0}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </article>
  )
}
export default PostCard
