import { useState, useEffect } from 'react'
import {
  Key,
  ShieldCheck,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  Plus,
  Server,
  Cpu,
  Globe
} from 'lucide-react'


import { apiKeysAPI, UserAPIKey, AIProvider } from '../utils/api'
import './ApiKeyVaultModal.css'

interface ApiKeyVaultModalProps {
  isOpen: boolean
  onClose: () => void
  onKeyUpdated?: () => void
}

export default function ApiKeyVaultModal({ isOpen, onClose, onKeyUpdated }: ApiKeyVaultModalProps) {
  const [keys, setKeys] = useState<UserAPIKey[]>([])
  const [providers, setProviders] = useState<AIProvider[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form State
  const [selectedProvider, setSelectedProvider] = useState('gemini')
  const [apiKey, setApiKey] = useState('')
  const [modelName, setModelName] = useState('')
  const [isCustomModel, setIsCustomModel] = useState(false)
  const [baseUrl, setBaseUrl] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      loadVaultData()
    }
  }, [isOpen])

  const loadVaultData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [provList, keysData] = await Promise.all([
        apiKeysAPI.getProviders(),
        apiKeysAPI.getKeys()
      ])
      setProviders(provList)
      setKeys(keysData.keys)

      // Set default model and base_url for selected provider
      const prov = provList.find(p => p.id === selectedProvider)
      if (prov) {
        if (!modelName) setModelName(prov.default_model)
        if (!baseUrl && prov.default_base_url) setBaseUrl(prov.default_base_url)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load key vault')
    } finally {
      setLoading(false)
    }
  }

  const handleProviderChange = (provId: string) => {
    setSelectedProvider(provId)
    setTestResult(null)
    setError(null)
    setIsCustomModel(false)
    const prov = providers.find(p => p.id === provId)
    if (prov) {
      setModelName(prov.default_model)
      setBaseUrl(prov.default_base_url || '')
      if (prov.id === 'custom' || prov.supports_custom_url) {
        setShowAdvanced(true)
      }
    }
  }

  const handleTestKey = async () => {
    const isCustom = selectedProvider === 'custom' || selectedProvider === 'ollama'
    if (!apiKey.trim() && !isCustom) {
      setError('Please enter an API key first.')
      return
    }
    setTesting(true)
    setTestResult(null)
    setError(null)
    try {
      const res = await apiKeysAPI.validateKey(
        selectedProvider,
        apiKey.trim(),
        modelName.trim() || undefined,
        baseUrl.trim() || undefined
      )
      if (res.is_valid) {
        setTestResult({ success: true, message: 'Connection successful! Model response verified.' })
      } else {
        setTestResult({ success: false, message: res.error || 'Connection or key validation failed.' })
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.response?.data?.detail || 'Validation request failed.' })
    } finally {
      setTesting(false)
    }
  }

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const isCustom = selectedProvider === 'custom' || selectedProvider === 'ollama'
    if (!apiKey.trim() && !isCustom) {
      setError('Please enter an API key.')
      return
    }
    setSaving(true)
    setError(null)
    setSuccessMessage(null)
    try {
      const res = await apiKeysAPI.saveKey(
        selectedProvider,
        apiKey.trim(),
        modelName.trim() || undefined,
        baseUrl.trim() || undefined
      )
      setSuccessMessage(res.message)
      setApiKey('')
      setTestResult(null)
      await loadVaultData()
      if (onKeyUpdated) onKeyUpdated()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save key in vault')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteKey = async (provId: string) => {
    if (!confirm(`Are you sure you want to remove your ${provId.toUpperCase()} configuration?`)) return
    try {
      await apiKeysAPI.deleteKey(provId)
      await loadVaultData()
      if (onKeyUpdated) onKeyUpdated()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete key')
    }
  }

  if (!isOpen) return null

  const currentProviderObj = providers.find(p => p.id === selectedProvider)

  return (
    <div className="vault-modal-overlay" onClick={onClose}>
      <div className="vault-modal-card" onClick={e => e.stopPropagation()}>
        <div className="vault-modal-header">
          <div className="vault-title-group">
            <div className="vault-icon-badge">
              <Key size={22} />
            </div>
            <div>
              <h2>BYOK AI Key Vault</h2>
              <p className="vault-subtitle">Connect any AI model — Gemini, DeepSeek, Claude, Groq, Llama, OpenAI, or Local Ollama</p>
            </div>
          </div>
          <button className="vault-close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="vault-modal-body">
          {/* Security Assurance Banner */}
          <div className="vault-security-pill">
            <ShieldCheck size={16} className="security-icon" />
            <span>Keys are encrypted with AES-256 at rest and used only for your direct academic requests.</span>
          </div>

          {/* Active Keys Section */}
          <div className="vault-section">
            <h3 className="vault-section-title">Connected Providers</h3>
            {loading ? (
              <div className="vault-loading">Loading keys...</div>
            ) : keys.length === 0 ? (
              <div className="vault-empty-state">
                <AlertCircle size={20} />
                <span>No keys connected yet. Add your free Gemini, DeepSeek, or Groq key below to unlock the AI Mentor.</span>
              </div>
            ) : (
              <div className="vault-keys-list">
                {keys.map(k => (
                  <div key={k.id} className="vault-key-card">
                    <div className="key-info">
                      <div className="key-header">
                        <span className="key-provider-badge">{k.provider.toUpperCase()}</span>
                        {k.is_active && <span className="key-active-badge">Active</span>}
                      </div>
                      <div className="key-model-name">
                        <Cpu size={13} style={{ display: 'inline', marginRight: 4 }} />
                        Model: <strong>{k.model_name || 'Default'}</strong>
                      </div>
                      {k.base_url && (
                        <div className="key-base-url">
                          <Globe size={12} style={{ display: 'inline', marginRight: 4 }} />
                          {k.base_url}
                        </div>
                      )}
                      <div className="key-meta">
                        {k.last_validated_at && (
                          <span>Verified: {new Date(k.last_validated_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="key-delete-btn"
                      onClick={() => handleDeleteKey(k.provider)}
                      title="Disconnect Key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add / Update Key Form */}
          <div className="vault-section">
            <h3 className="vault-section-title">
              <Plus size={16} /> Connect or Update AI Model
            </h3>

            {error && <div className="vault-alert error">{error}</div>}
            {successMessage && <div className="vault-alert success">{successMessage}</div>}

            <form onSubmit={handleSaveKey} className="vault-form">
              {/* Provider Selection Chips */}
              <div className="form-group">
                <label>Select Provider</label>
                <div className="provider-selector">
                  {providers.map(p => (
                    <button
                      type="button"
                      key={p.id}
                      className={`provider-chip ${selectedProvider === p.id ? 'active' : ''}`}
                      onClick={() => handleProviderChange(p.id)}
                    >
                      {p.name}
                      {p.free_tier_available && <span className="free-badge">FREE</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Model Choice & Custom Model Input */}
              <div className="form-group">
                <div className="label-with-link">
                  <label>Model Name</label>
                  <button
                    type="button"
                    className="vault-sub-toggle"
                    onClick={() => setIsCustomModel(!isCustomModel)}
                  >
                    {isCustomModel ? 'Pick from recommended list' : 'Type custom model ID'}
                  </button>
                </div>

                {isCustomModel ? (
                  <input
                    type="text"
                    placeholder="e.g., deepseek-r1:14b, llama-3.3-70b-instruct, custom-model"
                    value={modelName}
                    onChange={e => setModelName(e.target.value)}
                    className="vault-input"
                    required
                  />
                ) : (
                  currentProviderObj && (
                    <select
                      value={modelName}
                      onChange={e => setModelName(e.target.value)}
                      className="vault-select"
                    >
                      {currentProviderObj.recommended_models.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  )
                )}
              </div>

              {/* API Key Input */}
              <div className="form-group">
                <div className="label-with-link">
                  <label>API Key {selectedProvider === 'custom' || selectedProvider === 'ollama' ? '(Optional for local)' : ''}</label>
                  {currentProviderObj?.key_help_url && (
                    <a
                      href={currentProviderObj.key_help_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vault-help-link"
                    >
                      Get {currentProviderObj.name} Key <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                <div className="input-password-wrapper">
                  <input
                    type={showKey ? 'text' : 'password'}
                    placeholder={
                      selectedProvider === 'custom' || selectedProvider === 'ollama'
                        ? 'Enter API key (or leave empty for local Ollama)'
                        : `Enter your ${currentProviderObj?.name || ''} API key`
                    }
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    className="vault-input"
                    required={selectedProvider !== 'custom' && selectedProvider !== 'ollama'}
                  />
                  <button
                    type="button"
                    className="toggle-eye-btn"
                    onClick={() => setShowKey(!showKey)}
                    aria-label="Toggle password visibility"
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Advanced Endpoint Settings (Custom Base URL) */}
              {(currentProviderObj?.supports_custom_url || showAdvanced || selectedProvider === 'custom') && (
                <div className="form-group">
                  <div className="label-with-link">
                    <label>
                      <Server size={13} style={{ display: 'inline', marginRight: 4 }} />
                      Endpoint Base URL
                    </label>
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>OpenAI-compatible</span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g., https://api.deepseek.com, http://localhost:11434/v1"
                    value={baseUrl}
                    onChange={e => setBaseUrl(e.target.value)}
                    className="vault-input"
                  />
                  <small style={{ fontSize: '11px', color: '#6b7280', marginTop: '3px', display: 'block' }}>
                    Works with any OpenAI-compatible API (Ollama, LM Studio, vLLM, OpenRouter, DeepSeek, Groq, Together).
                  </small>
                </div>
              )}

              {/* Test Result Indicator */}
              {testResult && (
                <div className={`test-feedback ${testResult.success ? 'success' : 'fail'}`}>
                  {testResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  <span>{testResult.message}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="vault-actions">
                <button
                  type="button"
                  onClick={handleTestKey}
                  disabled={testing || (!apiKey.trim() && selectedProvider !== 'custom' && selectedProvider !== 'ollama')}
                  className="vault-btn secondary"
                >
                  {testing ? 'Testing Connection...' : 'Test Connection'}
                </button>
                <button
                  type="submit"
                  disabled={saving || (!apiKey.trim() && selectedProvider !== 'custom' && selectedProvider !== 'ollama')}
                  className="vault-btn primary"
                >
                  {saving ? 'Saving...' : 'Save & Encrypt Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
