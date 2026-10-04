import React, { useState, useRef } from 'react'
import {
  Shield,
  User,
  AlertTriangle,
  Upload,
  X,
  Eye,
  Edit3,
  Flame,
  MessageCircle,
  Send,
  Lock,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { AnonymousCategory } from '../../utils/api'
import api from '../../utils/api'

interface PostComposerProps {
  categories: AnonymousCategory[]
  isStudentLoggedIn: boolean
  studentName?: string
  studentMeta?: string
  isSenior?: boolean
  userRole?: string
  onPostCreated: () => void
  onCancel: () => void
}

const DISTRESS_KEYWORDS = ['depressed', 'suicide', 'anxious', 'stress', 'burnout', 'hopeless', 'failure', 'worthless', 'kill myself', 'self-harm', 'cant go on', 'cant take this']

/** In-Browser HTML5 Canvas EXIF/GPS metadata scrubber */
async function scrubImageClientSide(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_EDGE = 2048
        let width = img.width
        let height = img.height

        if (width > MAX_EDGE || height > MAX_EDGE) {
          if (width > height) {
            height = Math.round((height * MAX_EDGE) / width)
            width = MAX_EDGE
          } else {
            width = Math.round((width * MAX_EDGE) / height)
            height = MAX_EDGE
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          return reject(new Error('Canvas context unavailable'))
        }

        // Drawing onto canvas strips all EXIF, GPS, camera serial tags
        ctx.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to scrub image metadata'))
          },
          'image/webp',
          0.85
        )
      }
      img.onerror = () => reject(new Error('Failed to load image file'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read image file'))
    reader.readAsDataURL(file)
  })
}

export const PostComposer: React.FC<PostComposerProps> = ({
  categories,
  isStudentLoggedIn,
  studentName,
  studentMeta,
  isSenior,
  userRole: _userRole,
  onPostCreated,
  onCancel,
}) => {
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [kind, setKind] = useState<'grievance' | 'conversation'>('grievance')
  const [categorySlug, setCategorySlug] = useState(categories[0]?.slug || 'hostel-mess')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
  const [images, setImages] = useState<{ filename: string; url: string; preview: string }[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const detectedDistress = DISTRESS_KEYWORDS.some((kw) =>
    `${title} ${body}`.toLowerCase().includes(kw)
  )

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    if (images.length + files.length > 4) {
      setErrorMessage('You can attach a maximum of 4 photos per post.')
      return
    }

    setUploadingImage(true)
    setErrorMessage('')

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        // 1. Client-side canvas redraw: 100% EXIF/GPS stripped on-device
        const scrubbedBlob = await scrubImageClientSide(file)

        // 2. Upload scrubbed WebP blob to backend for second-tier re-encoding
        const formData = new FormData()
        formData.append('file', scrubbedBlob, 'scrubbed.webp')

        const res = await api.post('/anonymous/upload-image', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        if (res.data?.filename) {
          setImages((prev) => [
            ...prev,
            {
              filename: res.data.filename,
              url: res.data.url,
              preview: URL.createObjectURL(scrubbedBlob),
            },
          ])
        }
      }
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to upload photo. Supported: JPEG, PNG, WebP up to 5MB.')
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!title.trim() || title.length < 3) {
      setErrorMessage('Title must be at least 3 characters long.')
      return
    }
    if (!body.trim() || body.length < 5) {
      setErrorMessage('Post content must be at least 5 characters long.')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        category_slug: categorySlug,
        kind,
        is_anonymous: isAnonymous,
        images: images.map((img) => img.filename),
      }

      await api.post('/anonymous/posts', payload)
      onPostCreated()
    } catch (err: any) {
      setErrorMessage(err.response?.data?.detail || 'Failed to publish post. Please check your network connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card composer-card" role="region" aria-label="Create Post">
      <div className="composer-header">
        <div>
          <h3 className="composer-title">Create Forum Discussion</h3>
          <p className="composer-subtitle">Choose your identity mode, category, and reach the insti community</p>
        </div>
        <button type="button" className="composer-close-btn" onClick={onCancel} aria-label="Cancel composer">
          &times;
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 1. Hybrid Dual-Mode Identity Switcher */}
        <div className="composer-identity-section">
          <label className="section-label">Posting Identity Mode:</label>
          <div className="identity-toggle-group">
            <button
              type="button"
              className={`identity-btn ${isAnonymous ? 'active' : ''}`}
              onClick={() => setIsAnonymous(true)}
            >
              <Shield size={16} className="identity-icon shield" />
              <div className="identity-text">
                <span className="identity-main">🛡️ Anonymous Mode</span>
                <span className="identity-desc">Ephemeral handle (e.g. Amber Finch) · Zero roll link</span>
              </div>
            </button>

            <button
              type="button"
              className={`identity-btn ${!isAnonymous ? 'active' : ''}`}
              onClick={() => {
                if (!isStudentLoggedIn) {
                  setErrorMessage('You must be logged into your ATLAS account to post with your verified student identity.')
                  return
                }
                setIsAnonymous(false)
              }}
              disabled={!isStudentLoggedIn}
              title={!isStudentLoggedIn ? 'Log in to post as yourself' : undefined}
            >
              <User size={16} className="identity-icon user" />
              <div className="identity-text">
                <span className="identity-main">
                  👤 Post as Myself {isStudentLoggedIn ? `(${studentName})` : ''}
                </span>
                <span className="identity-desc">
                  {isStudentLoggedIn ? (
                    <>
                      {studentMeta} {isSenior && <strong className="text-success">· Senior Verified</strong>}
                    </>
                  ) : (
                    'Requires ATLAS student login'
                  )}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* 2. Post Kind: Grievance vs Conversation */}
        <div className="composer-kind-section">
          <label className="section-label">Discussion Type:</label>
          <div className="kind-selector-row">
            <button
              type="button"
              className={`kind-select-btn ${kind === 'grievance' ? 'selected' : ''}`}
              onClick={() => setKind('grievance')}
            >
              <Flame size={18} className="kind-icon text-amber" />
              <div>
                <strong>Grievance</strong>
                <p>Campus issue, hostel defect, mess problem. Features "Affects me too" petition counter.</p>
              </div>
            </button>

            <button
              type="button"
              className={`kind-select-btn ${kind === 'conversation' ? 'selected' : ''}`}
              onClick={() => setKind('conversation')}
            >
              <MessageCircle size={18} className="kind-icon text-primary" />
              <div>
                <strong>Conversation</strong>
                <p>Academic questions, career dilemmas, general insti banter, and thoughts.</p>
              </div>
            </button>
          </div>
        </div>

        {/* 3. Category Selector */}
        <div className="form-group">
          <label htmlFor="post-category">Category *</label>
          <select
            id="post-category"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            className="composer-select"
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name} — {c.description}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Title Input */}
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="post-title">Title *</label>
            <span className="char-count">{title.length}/250</span>
          </div>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A clear, concise title summarizing your grievance or topic..."
            maxLength={250}
            required
            className="composer-input-title"
          />
        </div>

        {/* 5. Body with Write / Preview Tabs */}
        <div className="form-group">
          <div className="field-label-row">
            <label htmlFor="post-body">Body *</label>
            <div className="tab-pill-group">
              <button
                type="button"
                className={`tab-pill-btn ${activeTab === 'write' ? 'active' : ''}`}
                onClick={() => setActiveTab('write')}
              >
                <Edit3 size={13} /> Write
              </button>
              <button
                type="button"
                className={`tab-pill-btn ${activeTab === 'preview' ? 'active' : ''}`}
                onClick={() => setActiveTab('preview')}
              >
                <Eye size={13} /> Preview
              </button>
            </div>
          </div>

          {activeTab === 'write' ? (
            <textarea
              id="post-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Provide background, details, hostel wing, or specific course code. Markdown and LaTeX math e.g. $\sigma = 14.5$ supported."
              required
              className="composer-textarea"
            />
          ) : (
            <div className="composer-preview-box markdown-content">
              {body.trim() ? (
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {body}
                </ReactMarkdown>
              ) : (
                <span className="text-muted italic">Nothing to preview yet. Write some text above.</span>
              )}
            </div>
          )}
        </div>

        {/* 6. Two-Tier Canvas Image Sanitizer Upload */}
        <div className="composer-media-section">
          <div className="media-header">
            <label>Attach Evidence Photos (Optional, max 4)</label>
            <span className="privacy-badge">
              <Lock size={12} /> Auto-EXIF/GPS Stripped On-Device
            </span>
          </div>

          <div className="image-previews-row">
            {images.map((img, i) => (
              <div key={i} className="composer-img-preview">
                <img src={img.preview} alt={`Upload ${i + 1}`} />
                <button
                  type="button"
                  className="remove-img-btn"
                  onClick={() => removeImage(i)}
                  aria-label="Remove image"
                >
                  <X size={13} />
                </button>
              </div>
            ))}

            {images.length < 4 && (
              <label className={`image-upload-dropzone ${uploadingImage ? 'disabled' : ''}`}>
                <Upload size={18} className="upload-icon" />
                <span>{uploadingImage ? 'Scrubbing...' : 'Add Photo'}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageSelect}
                  disabled={uploadingImage}
                  className="visually-hidden"
                />
              </label>
            )}
          </div>
          <p className="media-note">
            Photos are re-drawn into an offscreen HTML5 canvas to guarantee that camera serial numbers, GPS coordinates, and device timestamps are eliminated before leaving your browser.
          </p>
        </div>

        {/* Distress Notice */}
        {detectedDistress && (
          <div className="distress-live-alert" role="status">
            <AlertTriangle size={16} className="text-amber" />
            <span>
              If you or a friend are feeling overwhelmed, remember that Student Wellness Centre (SWC) and Talk to Angel (080 4713 6761) are confidential and free.
            </span>
          </div>
        )}

        {errorMessage && (
          <div className="alert-banner alert-error" role="alert">
            <AlertTriangle size={15} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="composer-actions-bar">
          <button type="button" className="secondary-btn" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="primary-btn submit-post-btn" disabled={submitting || uploadingImage}>
            <Send size={15} />
            <span>
              {submitting ? 'Publishing...' : isAnonymous ? 'Publish Anonymously' : 'Publish as Myself'}
            </span>
          </button>
        </div>
      </form>
    </div>
  )
}
export default PostComposer
