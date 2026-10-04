import React, { useState } from 'react'
import { KeyRound, ShieldCheck, Copy, Check, RefreshCw, LogIn, AlertCircle, Info } from 'lucide-react'
import api from '../../utils/api'

interface RecoveryKeyModalProps {
  isOpen: boolean
  onClose: () => void
  currentRecoveryKey: string | null
  accountId: string | null
  isStudentLoggedIn: boolean
  onIdentityChanged: () => void
}

export const RecoveryKeyModal: React.FC<RecoveryKeyModalProps> = ({
  isOpen,
  onClose,
  currentRecoveryKey,
  accountId,
  isStudentLoggedIn,
  onIdentityChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'my-key' | 'restore' | 'claim'>('my-key')
  const [inputKey, setInputKey] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!isOpen) return null

  const handleCopy = () => {
    if (!currentRecoveryKey) return
    navigator.clipboard.writeText(currentRecoveryKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    if (!inputKey.trim()) {
      setErrorMsg('Please enter your 24-character Recovery Key.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/anonymous/session/recover', {
        recovery_key: inputKey.trim(),
      })
      if (res.data?.anon_token) {
        localStorage.setItem('atlas_anon_token', res.data.anon_token)
        localStorage.setItem('atlas_recovery_key', inputKey.trim())
        setSuccessMsg('Anonymous account restored successfully!')
        setTimeout(() => {
          onIdentityChanged()
          onClose()
        }, 1200)
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to restore account. Check your key format.')
    } finally {
      setLoading(false)
    }
  }

  const handleClaimVoucher = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    setLoading(true)
    try {
      // 1. Claim voucher token
      const claimRes = await api.post('/anonymous/voucher/claim')
      const { voucher, semester } = claimRes.data

      // 2. Redeem voucher immediately to generate new decoupled account
      const redeemRes = await api.post('/anonymous/voucher/redeem', {
        voucher,
        semester,
      })

      if (redeemRes.data?.anon_token) {
        localStorage.setItem('atlas_anon_token', redeemRes.data.anon_token)
        if (redeemRes.data.recovery_key) {
          localStorage.setItem('atlas_recovery_key', redeemRes.data.recovery_key)
        }
        setSuccessMsg('New anonymous identity created! Save your recovery key below.')
        setActiveTab('my-key')
        onIdentityChanged()
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to claim voucher. You may already have claimed one this semester.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="recovery-modal-card card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <KeyRound size={22} className="text-primary" />
            <div>
              <h3>Anonymous Identity & Recovery Key</h3>
              <p className="modal-subtitle">Zero-knowledge student identity management</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">&times;</button>
        </div>

        <div className="modal-tabs">
          <button
            className={`modal-tab ${activeTab === 'my-key' ? 'active' : ''}`}
            onClick={() => { setActiveTab('my-key'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            My Recovery Key
          </button>
          <button
            className={`modal-tab ${activeTab === 'restore' ? 'active' : ''}`}
            onClick={() => { setActiveTab('restore'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            Restore on Another Device
          </button>
          {isStudentLoggedIn && !accountId && (
            <button
              className={`modal-tab ${activeTab === 'claim' ? 'active' : ''}`}
              onClick={() => { setActiveTab('claim'); setErrorMsg(''); setSuccessMsg(''); }}
            >
              Claim Semester Voucher
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="alert-banner alert-error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="alert-banner alert-success" role="status">
            <Check size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {activeTab === 'my-key' && (
          <div className="tab-pane">
            <div className="info-banner">
              <ShieldCheck size={18} className="text-success" />
              <div>
                <strong>How Decoupled Privacy Works:</strong>
                <p>
                  Your anonymous posts, replies, and votes are linked ONLY to this 120-bit recovery key. Your IITB Roll Number is never stored in forum records.
                </p>
              </div>
            </div>

            {currentRecoveryKey ? (
              <div className="key-display-box">
                <label className="key-label">Your Crockford Base32 Recovery Key</label>
                <div className="key-code-row">
                  <code className="key-code">{currentRecoveryKey}</code>
                  <button
                    type="button"
                    className="key-copy-btn"
                    onClick={handleCopy}
                    aria-label="Copy recovery key"
                  >
                    {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
                    <span>{copied ? 'Copied' : 'Copy Key'}</span>
                  </button>
                </div>
                <p className="key-hint">
                  Keep this safe! If you clear your browser cache or browse incognito, this is the only way to retain your anonymous identity.
                </p>
              </div>
            ) : (
              <div className="no-key-state">
                <Info size={24} className="text-muted" />
                <p>No active anonymous account found in this browser.</p>
                {isStudentLoggedIn ? (
                  <button className="primary-btn mt-2" onClick={handleClaimVoucher} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    <span>{loading ? 'Claiming Voucher...' : 'Claim 1-Click Voucher'}</span>
                  </button>
                ) : (
                  <p className="text-secondary text-sm">
                    Log in with your IITB Roll Number to claim your semester voucher, or restore an existing key.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'restore' && (
          <form onSubmit={handleRestore} className="tab-pane">
            <p className="tab-desc">
              Paste your 24-character Crockford Base32 Recovery Key to restore your anonymous identity on this device.
            </p>
            <div className="form-group">
              <label htmlFor="recovery-key-input">Recovery Key</label>
              <input
                id="recovery-key-input"
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="e.g. K7QM-2XRT-9BWD-F4NH-6JPC-3VLA"
                className="key-input"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="primary-btn" disabled={loading || !inputKey.trim()}>
                <LogIn size={16} />
                <span>{loading ? 'Restoring...' : 'Restore Identity'}</span>
              </button>
            </div>
          </form>
        )}

        {activeTab === 'claim' && (
          <div className="tab-pane">
            <p className="tab-desc">
              As a verified student, you are entitled to one anonymous voucher per academic semester.
            </p>
            <div className="voucher-explanation">
              <ul>
                <li>The server signs an unlinked voucher proving you are a current student.</li>
                <li>Your roll number is detached before the anonymous account is created.</li>
                <li>You will receive a 120-bit recovery key that only you control.</li>
              </ul>
            </div>
            <div className="modal-actions">
              <button type="button" className="secondary-btn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="primary-btn" onClick={handleClaimVoucher} disabled={loading}>
                <ShieldCheck size={16} />
                <span>{loading ? 'Issuing Blind Token...' : 'Claim Anonymous Identity'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default RecoveryKeyModal
