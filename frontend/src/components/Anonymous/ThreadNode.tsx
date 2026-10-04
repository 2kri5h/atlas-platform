import React, { useState } from 'react'
import { ArrowBigUp, ArrowBigDown, MessageSquare, Flag, ChevronDown, ChevronRight, CheckCircle2, Shield, User, Send } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { AnonymousReplyNode } from '../../utils/api'
import { formatDateTime } from '../../utils/helpers'

interface ThreadNodeProps {
  node: AnonymousReplyNode
  postId: number
  postAuthorHandle?: string
  isStudentLoggedIn: boolean
  studentName?: string
  studentMeta?: string
  onVote: (targetType: 'reply', targetId: number, value: number) => Promise<void>
  onReplySubmit: (parentId: number, body: string, isAnonymous: boolean) => Promise<void>
  onReport: (targetType: 'reply', targetId: number, text: string) => void
  depth?: number
}

const PASTEL_PALETTE = [
  { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }, // Blue
  { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' }, // Green
  { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff' }, // Purple
  { bg: '#fff7ed', text: '#9a3412', border: '#fed7aa' }, // Orange
  { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' }, // Pink
  { bg: '#f0fdfa', text: '#115e59', border: '#99f6e4' }, // Teal
]

export const ThreadNode: React.FC<ThreadNodeProps> = ({
  node,
  postId,
  postAuthorHandle,
  isStudentLoggedIn,
  studentName,
  studentMeta,
  onVote,
  onReplySubmit,
  onReport,
  depth = 0,
}) => {
  const [collapsed, setCollapsed] = useState(false)
  const [showReplyBox, setShowReplyBox] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [replyAsAnon, setReplyAsAnon] = useState(true)
  const [submittingReply, setSubmittingReply] = useState(false)
  const [localVote, setLocalVote] = useState(node.user_vote || 0)
  const [localScore, setLocalScore] = useState(node.score || 0)

  const handleVoteClick = async (val: number) => {
    const prevVote = localVote
    const prevScore = localScore

    let nextVote = 0
    let scoreDelta = 0

    if (localVote === val) {
      nextVote = 0
      scoreDelta = -val
    } else {
      nextVote = val
      scoreDelta = prevVote === 0 ? val : val * 2
    }

    setLocalVote(nextVote)
    setLocalScore(prevScore + scoreDelta)

    try {
      await onVote('reply', node.id, val)
    } catch {
      setLocalVote(prevVote)
      setLocalScore(prevScore)
    }
  }

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim() || submittingReply) return
    setSubmittingReply(true)
    try {
      await onReplySubmit(node.id, replyBody.trim(), replyAsAnon)
      setReplyBody('')
      setShowReplyBox(false)
    } finally {
      setSubmittingReply(false)
    }
  }

  // Author representation
  const isAnonymous = node.is_anonymous
  const authorHandle = node.author?.handle || 'Anonymous Student'
  const isOp = node.author?.is_op || (postAuthorHandle && authorHandle.includes(postAuthorHandle))
  const isSenior = node.is_senior_verified || node.author?.is_senior_verified
  const displayName = isAnonymous ? authorHandle : (node.author?.name || 'Verified Student')
  const authorBranchYear = !isAnonymous && node.author ? `${node.author.year ? `${node.author.year}th Year, ` : ''}${node.author.branch || ''}` : ''

  const paletteIndex = node.author?.tint ?? (displayName.charCodeAt(0) % PASTEL_PALETTE.length)
  const colorScheme = PASTEL_PALETTE[paletteIndex % PASTEL_PALETTE.length]

  const initials = isAnonymous
    ? authorHandle.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={`thread-node depth-${Math.min(depth, 6)} ${collapsed ? 'collapsed' : ''}`}>
      {/* Vertical guide rail that collapses the branch when clicked */}
      <div
        className="thread-rail"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Click to expand branch' : 'Click to collapse branch'}
        aria-label="Toggle comment thread"
      />

      <div className="thread-content-wrap">
        <div className="comment-header">
          <button
            type="button"
            className="collapse-toggle-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand comment' : 'Collapse comment'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Avatar Bubble */}
          <div
            className="comment-avatar"
            style={{
              backgroundColor: colorScheme.bg,
              color: colorScheme.text,
              borderColor: colorScheme.border,
            }}
            title={displayName}
          >
            {initials}
          </div>

          <div className="comment-meta">
            <span className="author-handle-text">
              {displayName}
            </span>

            {isOp && <span className="op-badge" title="Thread Creator">OP</span>}

            {!isAnonymous && isSenior && (
              <span className="senior-badge" title="Verified Senior (Year 4+)">
                <CheckCircle2 size={12} /> Senior Verified
              </span>
            )}

            {!isAnonymous && authorBranchYear && (
              <span className="author-subtext">· {authorBranchYear}</span>
            )}

            <span className="comment-timestamp">· {formatDateTime(node.created_at)}</span>
          </div>

          {collapsed && (
            <span className="collapsed-indicator">
              ({node.children?.length ? `${node.children.length + 1} comments collapsed` : 'collapsed'})
            </span>
          )}
        </div>

        {!collapsed && (
          <>
            <div className="comment-body markdown-content">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {node.body}
              </ReactMarkdown>
            </div>

            <div className="comment-footer-actions">
              {/* Upvote / Downvote */}
              <div className="comment-vote-pill">
                <button
                  type="button"
                  className={`vote-btn up ${localVote === 1 ? 'active' : ''}`}
                  onClick={() => handleVoteClick(1)}
                  aria-label="Upvote comment"
                >
                  <ArrowBigUp size={16} />
                </button>
                <span className={`vote-score ${localScore > 0 ? 'pos' : localScore < 0 ? 'neg' : ''}`}>
                  {localScore}
                </span>
                <button
                  type="button"
                  className={`vote-btn down ${localVote === -1 ? 'active' : ''}`}
                  onClick={() => handleVoteClick(-1)}
                  aria-label="Downvote comment"
                >
                  <ArrowBigDown size={16} />
                </button>
              </div>

              {/* Reply Button */}
              <button
                type="button"
                className={`action-btn reply-btn ${showReplyBox ? 'active' : ''}`}
                onClick={() => setShowReplyBox(!showReplyBox)}
              >
                <MessageSquare size={14} />
                <span>Reply</span>
              </button>

              {/* Report Button */}
              <button
                type="button"
                className="action-btn report-btn"
                onClick={() => onReport('reply', node.id, node.body.slice(0, 40))}
                title="Report violating content"
              >
                <Flag size={13} />
                <span>Report</span>
              </button>
            </div>

            {/* Inline Reply Form */}
            {showReplyBox && (
              <form onSubmit={handleSendReply} className="inline-reply-box">
                {isStudentLoggedIn && (
                  <div className="reply-mode-switcher">
                    <span className="mode-label">Reply as:</span>
                    <button
                      type="button"
                      className={`mode-pill ${replyAsAnon ? 'active' : ''}`}
                      onClick={() => setReplyAsAnon(true)}
                    >
                      <Shield size={12} /> Anonymous Handle
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

                <div className="reply-input-row">
                  <textarea
                    rows={2}
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${displayName}...`}
                    className="reply-textarea"
                    autoFocus
                  />
                  <div className="reply-btn-row">
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => setShowReplyBox(false)}
                      disabled={submittingReply}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="submit-reply-btn"
                      disabled={submittingReply || !replyBody.trim()}
                    >
                      <Send size={13} />
                      <span>{submittingReply ? 'Replying...' : 'Reply'}</span>
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Recursive Children (Nested Replies) */}
            {node.children && node.children.length > 0 && (
              <div className="nested-children-list">
                {node.children.map((child) => (
                  <ThreadNode
                    key={child.id}
                    node={child}
                    postId={postId}
                    postAuthorHandle={postAuthorHandle}
                    isStudentLoggedIn={isStudentLoggedIn}
                    studentName={studentName}
                    studentMeta={studentMeta}
                    onVote={onVote}
                    onReplySubmit={onReplySubmit}
                    onReport={onReport}
                    depth={depth + 1}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
export default ThreadNode
