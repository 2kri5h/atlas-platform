import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { googleIntegrationsAPI } from '../utils/api'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import './GoogleCallback.css'

export default function GoogleCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const exchangeAttempted = useRef(false)

  useEffect(() => {
    if (exchangeAttempted.current) return
    exchangeAttempted.current = true

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      setStatus('error')
      setErrorMessage(
        error === 'access_denied'
          ? 'Google authorization was canceled. No account was connected.'
          : `Google returned error: ${error}`
      )
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMessage('No authorization code was found in the callback URL.')
      return
    }

    const exchangeTokens = async () => {
      try {
        const redirectUri = window.location.origin + '/integrations/google/callback'
        const res = await googleIntegrationsAPI.handleCallback(code, redirectUri, state || undefined)
        setConnectedEmail(res.email)
        setStatus('success')
        setTimeout(() => {
          navigate('/emails?google_connected=true')
        }, 1600)
      } catch (err: any) {
        setStatus('error')
        const detail = err.response?.data?.detail
        setErrorMessage(
          typeof detail === 'string'
            ? detail
            : 'Failed to verify authorization code with Google.'
        )
      }
    }

    exchangeTokens()
  }, [searchParams, navigate])

  return (
    <div className="google-callback-viewport">
      <div className="google-callback-card">
        {status === 'loading' && (
          <div className="callback-state loading">
            <Loader2 className="spinner-icon" size={48} />
            <h2>Connecting Google Workspace...</h2>
            <p>Verifying Google OAuth tokens and linking your personal Gmail, Calendar & Drive.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="callback-state success">
            <CheckCircle2 className="success-icon" size={48} />
            <h2>Google Account Connected!</h2>
            <p>
              Successfully authenticated <strong>{connectedEmail}</strong>.
            </p>
            <span className="redirecting-badge">Redirecting to your dashboard...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="callback-state error">
            <AlertCircle className="error-icon" size={48} />
            <h2>Connection Incomplete</h2>
            <p className="error-message">{errorMessage}</p>
            <div className="error-actions">
              <button
                className="btn-return"
                onClick={() => navigate('/emails')}
              >
                Return to Email & Sync
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
