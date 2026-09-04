import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Globe,
  Mail,
  HardDrive,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  X,
  Unplug,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react'
import { googleIntegrationsAPI, GoogleAccountStatus } from '../utils/api'
import './GoogleConnectModal.css'

interface GoogleConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onStatusChange?: (status: GoogleAccountStatus) => void
}

export default function GoogleConnectModal({ isOpen, onClose, onStatusChange }: GoogleConnectModalProps) {
  const [status, setStatus] = useState<GoogleAccountStatus | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadStatus()
    }
  }, [isOpen])

  const loadStatus = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await googleIntegrationsAPI.getStatus()
      setStatus(data)
      if (onStatusChange) onStatusChange(data)

      try {
        const redirectUri = window.location.origin + '/integrations/google/callback'
        const authData = await googleIntegrationsAPI.getAuthUrl(redirectUri)
        setIsConfigured(Boolean(authData.is_configured))
      } catch {
        // Backend status check fallback
      }
    } catch (err: any) {
      console.error('Failed to load Google account status', err)
      setError('Could not verify Google account connection.')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const redirectUri = window.location.origin + '/integrations/google/callback'
      const { auth_url, is_configured } = await googleIntegrationsAPI.getAuthUrl(redirectUri)
      if (!is_configured) {
        setIsConfigured(false)
        setError('Google OAuth is not configured on the backend server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your Render Environment Variables, or use Sandbox Demo mode below.')
        return
      }
      // Redirect to Google's official OAuth consent screen
      window.location.href = auth_url
    } catch (err: any) {
      console.error('Failed to connect Google account', err)
      setError(err.response?.data?.detail || 'Failed to initiate Google connection.')
    } finally {
      setConnecting(false)
    }
  }

  const handleConnectSandbox = async () => {
    setConnecting(true)
    setError(null)
    setSuccessMsg(null)
    try {
      await googleIntegrationsAPI.handleCallback('sandbox_demo_token')
      setSuccessMsg('Sandbox Demo mode connected! Sample Gmail, Drive folders, and Calendar slots are now active.')
      await loadStatus()
    } catch (err: any) {
      console.error('Failed to activate sandbox mode', err)
      setError('Could not activate demo sandbox.')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    setError(null)
    try {
      await googleIntegrationsAPI.disconnect()
      setSuccessMsg('Google account disconnected successfully.')
      await loadStatus()
    } catch (err: any) {
      console.error('Failed to disconnect Google account', err)
      setError('Failed to disconnect Google account.')
    } finally {
      setDisconnecting(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="google-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="google-modal-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="google-modal-header">
          <div className="google-modal-title-wrap">
            <div className="google-icon-badge">
              <Globe size={20} className="google-color-icon" />
            </div>
            <div className="google-title-text-group">
              <h2 className="google-modal-title">Google Workspace Integration</h2>
              <p className="google-modal-subtitle">Connect Personal Gmail, Google Drive, and Google Calendar</p>
            </div>
          </div>
          <button className="google-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="google-alert error">
            <AlertCircle size={16} className="google-alert-icon" />
            <div className="google-alert-text">{error}</div>
          </div>
        )}
        {successMsg && (
          <div className="google-alert success">
            <CheckCircle2 size={16} className="google-alert-icon" />
            <div className="google-alert-text">{successMsg}</div>
          </div>
        )}

        {/* Body */}
        <div className="google-modal-body">
          {loading ? (
            <div className="google-loading-state">
              <RefreshCw size={24} className="spin-icon" />
              <span>Verifying Google connection...</span>
            </div>
          ) : status?.is_connected ? (
            <div className="google-connected-view">
              {/* Account Pill */}
              <div className="google-user-pill">
                {status.picture ? (
                  <img src={status.picture} alt="Google Profile" className="google-user-avatar" />
                ) : (
                  <div className="google-user-initial">
                    {status.name ? status.name.charAt(0) : 'G'}
                  </div>
                )}
                <div className="google-user-details">
                  <span className="google-user-name">{status.name || 'Connected User'}</span>
                  <span className="google-user-email">{status.email}</span>
                </div>
                {status.is_sandbox ? (
                  <span className="google-status-tag sandbox">
                    <Sparkles size={12} /> Sandbox Demo
                  </span>
                ) : (
                  <span className="google-status-tag connected">
                    <ShieldCheck size={12} /> Active
                  </span>
                )}
              </div>

              {/* Enabled Capabilities */}
              <div className="google-features-grid">
                <div className="google-feature-card active">
                  <div className="feature-icon-wrap gmail">
                    <Mail size={16} />
                  </div>
                  <div className="feature-info">
                    <h4>Personal Gmail</h4>
                    <p>Read emails, auto-detect assignment submissions & interviews</p>
                  </div>
                  <CheckCircle2 size={15} className="feature-check-icon" />
                </div>

                <div className="google-feature-card active">
                  <div className="feature-icon-wrap drive">
                    <HardDrive size={16} />
                  </div>
                  <div className="feature-info">
                    <h4>Google Drive Auto-Cataloger</h4>
                    <p>1-Click organize syllabus materials into <code>ATLAS-Academics/Year/Course</code></p>
                  </div>
                  <CheckCircle2 size={15} className="feature-check-icon" />
                </div>

                <div className="google-feature-card active">
                  <div className="feature-icon-wrap calendar">
                    <Calendar size={16} />
                  </div>
                  <div className="feature-info">
                    <h4>Google Calendar 2-Way Sync</h4>
                    <p>Sync recurring timetable slots & deadline alerts with notifications</p>
                  </div>
                  <CheckCircle2 size={15} className="feature-check-icon" />
                </div>
              </div>

              {/* Actions */}
              <div className="google-connected-actions">
                <button
                  type="button"
                  className="google-disconnect-btn"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  <Unplug size={15} />
                  {disconnecting ? 'Disconnecting...' : 'Disconnect Account'}
                </button>
              </div>
            </div>
          ) : (
            <div className="google-disconnected-view">
              {!isConfigured && (
                <div className="google-setup-notice">
                  <div className="setup-notice-header">
                    <Info size={15} className="notice-icon" />
                    <strong>Live Google Sign-In Setup</strong>
                  </div>
                  <p>
                    Google protects personal accounts by requiring the official <em>"Sign in with Google"</em> consent flow (Google OAuth).
                    To enable live account sync, add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to your server settings (Render dashboard).
                  </p>
                </div>
              )}

              <div className="google-hero-box">
                <div className="google-features-list">
                  <div className="google-benefit-row">
                    <div className="benefit-icon gmail"><Mail size={15} /></div>
                    <div>
                      <strong>Dual-Inbox Hub:</strong> Read Personal Gmail alongside official IITB Webmail with AI deadline extraction.
                    </div>
                  </div>
                  <div className="google-benefit-row">
                    <div className="benefit-icon drive"><HardDrive size={15} /></div>
                    <div>
                      <strong>Drive Auto-Cataloger:</strong> Auto-creates <code>ATLAS-Academics/Year/Course</code> directories in Google Drive.
                    </div>
                  </div>
                  <div className="google-benefit-row">
                    <div className="benefit-icon calendar"><Calendar size={15} /></div>
                    <div>
                      <strong>Calendar Sync:</strong> Push timetable classes and assignment deadlines to Google Calendar with reminders.
                    </div>
                  </div>
                </div>
              </div>

              <div className="google-connect-actions">
                {!isConfigured ? (
                  <>
                    <button
                      type="button"
                      className="google-sandbox-connect-btn"
                      onClick={handleConnectSandbox}
                      disabled={connecting}
                    >
                      <Sparkles size={16} />
                      {connecting ? 'Connecting Demo...' : 'Explore with Demo Sandbox'}
                    </button>
                    <button
                      type="button"
                      className="google-secondary-connect-btn"
                      onClick={handleConnect}
                      disabled={connecting}
                    >
                      <Globe size={15} />
                      Connect Live Google Account
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="google-primary-connect-btn"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    <Globe size={18} />
                    {connecting ? 'Connecting...' : 'Connect Google Workspace'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
