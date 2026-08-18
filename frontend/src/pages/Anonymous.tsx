import { useState, useEffect } from 'react'
import { Plus, Send, Shield, AlertTriangle } from 'lucide-react'
import api from '../utils/api'
import { Post, Reply } from '../utils/api'
import { DOMAINS, formatDateTime } from '../utils/helpers'
import './Anonymous.css'

function Anonymous() {
  const [posts, setPosts] = useState<Post[]>([])
  const [filter, setFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [expandedPost, setExpandedPost] = useState<number | null>(null)
  const [form, setForm] = useState({ content: '', domain: '', is_mental_health: false })
  const [replyForms, setReplyForms] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPosts()
  }, [filter])

  const fetchPosts = async () => {
    try {
      const params = filter ? `?domain=${filter}` : ''
      const res = await api.get(`/anonymous/${params}`)
      setPosts(res.data)
    } catch (err) {
      console.error('Failed to fetch posts', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/anonymous/', form)
      setShowForm(false)
      setForm({ content: '', domain: '', is_mental_health: false })
      fetchPosts()
    } catch (err) {
      console.error('Failed to create post', err)
    }
  }

  const submitReply = async (postId: number) => {
    const content = replyForms[postId]
    if (!content?.trim()) return
    try {
      await api.post(`/anonymous/${postId}/replies`, { content })
      setReplyForms({ ...replyForms, [postId]: '' })
      setExpandedPost(postId)
    } catch (err) {
      console.error('Failed to submit reply', err)
    }
  }

  const detectMentalHealth = (content: string) => {
    const keywords = ['depressed', 'suicide', 'anxious', 'stress', 'burnout', 'hopeless', 'failure', 'worthless']
    return keywords.some(kw => content.toLowerCase().includes(kw))
  }

  const handleContentChange = (value: string) => {
    setForm({
      ...form,
      content: value,
      is_mental_health: detectMentalHealth(value),
    })
  }

  return (
    <div className="anonymous-page">
      <div className="page-header">
        <div>
          <h1>Anonymous Portal</h1>
          <p>Ask questions and share thoughts without revealing your identity</p>
        </div>
        <button className="primary" onClick={() => setShowForm(!showForm)}>
          <Plus size={18} /> New Post
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          <div className="form-header">
            <h3>New Anonymous Post</h3>
            {form.is_mental_health && (
              <span className="mental-health-warning">
                <AlertTriangle size={14} /> This post may be about mental health. Resources will be shown to responders.
              </span>
            )}
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Your Question or Thought *</label>
              <textarea
                value={form.content}
                onChange={(e) => handleContentChange(e.target.value)}
                rows={4}
                placeholder="Share what's on your mind. Your identity will remain anonymous."
                required
              />
            </div>
            <div className="form-group">
              <label>Related Domain (optional)</label>
              <select value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })}>
                <option value="">Select domain</option>
                {DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div className="safety-notice">
              <Shield size={16} />
              <span>If you're struggling, please reach out to IITB counseling services: 022-2576-2345</span>
            </div>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary">Post Anonymously</button>
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
      ) : posts.length === 0 ? (
        <div className="empty-state">No posts yet. Be the first to start a conversation.</div>
      ) : (
        <div className="posts-list">
          {posts.map(post => (
            <div key={post.id} className={`post-card card ${post.is_mental_health ? 'mental-health' : ''}`}>
              <div className="post-header">
                <span className="anonymous-badge">Anonymous</span>
                {post.is_mental_health && (
                  <span className="mental-badge">
                    <AlertTriangle size={12} /> Mental Health
                  </span>
                )}
                <span className="post-date">{formatDateTime(post.created_at)}</span>
              </div>
              <p className="post-content">{post.content}</p>

              {expandedPost === post.id ? (
                <div className="replies-section">
                  <ReplySection postId={post.id} />
                  <div className="reply-form">
                    <input
                      type="text"
                      value={replyForms[post.id] || ''}
                      onChange={(e) => setReplyForms({ ...replyForms, [post.id]: e.target.value })}
                      placeholder="Write a reply..."
                      onKeyDown={(e) => e.key === 'Enter' && submitReply(post.id)}
                    />
                    <button className="primary" onClick={() => submitReply(post.id)}>
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <button className="view-replies-btn" onClick={() => setExpandedPost(post.id)}>
                  View Replies
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ReplySection({ postId }: { postId: number }) {
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReplies()
  }, [postId])

  const fetchReplies = async () => {
    try {
      const res = await api.get(`/anonymous/${postId}/replies`)
      setReplies(res.data)
    } catch (err) {
      console.error('Failed to fetch replies', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div className="loading">Loading replies...</div>

  return (
    <div className="replies-list">
      {replies.map(reply => (
        <div key={reply.id} className={`reply-item ${reply.is_senior_verified ? 'verified' : ''}`}>
          <div className="reply-header">
            {reply.is_senior_verified && <span className="verified-tag">Senior Verified</span>}
            <span className="reply-date">{formatDateTime(reply.created_at)}</span>
          </div>
          <p>{reply.content}</p>
        </div>
      ))}
    </div>
  )
}

export default Anonymous