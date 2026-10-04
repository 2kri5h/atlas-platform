import React, { useState } from 'react'
import { Flag, AlertTriangle, Check, Shield } from 'lucide-react'
import api from '../../utils/api'

interface ReportModalProps {
  isOpen: boolean
  onClose: () => void
  targetType: 'post' | 'reply'
  targetId: number
  targetTitle?: string
}

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or Bullying', desc: 'Targeting individuals with insults or intimidation' },
  { value: 'identifying', label: 'Doxxing / Exposing Identity', desc: 'Revealing real name, room number, or roll number without consent' },
  { value: 'hate', label: 'Hate Speech', desc: 'Attacking groups based on identity, region, religion, or gender' },
  { value: 'danger', label: 'Self-Harm or Immediate Threat', desc: 'Severe distress or threat to physical safety' },
  { value: 'spam', label: 'Spam or Commercial Promotion', desc: 'Advertisements, bots, or duplicate repetitive content' },
  { value: 'other', label: 'Other Guidelines Violation', desc: 'Content violating campus community norms' },
]

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetTitle,
}) => {
  const [reason, setReason] = useState('harassment')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSubmitting(true)
    try {
      await api.post('/anonymous/report', {
        target_type: targetType,
        target_id: targetId,
        reason,
        note: note.trim(),
      })
      setSubmitted(true)
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to submit report. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="report-modal-card card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="report-icon-box">
              <Flag size={20} className="text-danger" />
            </div>
            <div>
              <h3>Report {targetType === 'post' ? 'Thread' : 'Comment'}</h3>
              <p className="modal-subtitle">Anonymous flag submitted to campus moderators</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">&times;</button>
        </div>

        {targetTitle && (
          <div className="report-target-preview">
            <span className="preview-label">Target:</span>
            <span className="preview-text">"{targetTitle}"</span>
          </div>
        )}

        {submitted ? (
          <div className="report-success-state">
            <div className="success-circle">
              <Check size={28} className="text-success" />
            </div>
            <h4>Thank you for keeping our community safe</h4>
            <p>Our moderation team reviews flagged content promptly. High threshold flags are held automatically.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="report-reasons-list">
              <label className="reasons-label">Select Reason *</label>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`reason-option ${reason === r.value ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r.value}
                    checked={reason === r.value}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="reason-text">
                    <span className="reason-title">{r.label}</span>
                    <span className="reason-desc">{r.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="form-group mt-3">
              <label htmlFor="report-note">Additional Context (Optional)</label>
              <textarea
                id="report-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Brief details to help the moderator team understand the context..."
                maxLength={500}
              />
            </div>

            <div className="privacy-pill">
              <Shield size={14} className="text-muted" />
              <span>Your report is anonymous. Neither the post author nor peers can see who reported.</span>
            </div>

            {errorMsg && (
              <div className="alert-banner alert-error" role="alert">
                <AlertTriangle size={14} />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onClose} disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="danger-btn" disabled={submitting}>
                <Flag size={15} />
                <span>{submitting ? 'Submitting...' : 'Submit Report'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
export default ReportModal
