import { useState, useEffect, useRef, type ComponentType } from 'react'
import { Activity, Calendar, Check, ExternalLink, Pin, RefreshCw, Sparkles, X, Menu } from 'lucide-react'
import api from '../utils/api'
import { Student, BurnoutScore, SmartSuggestion } from '../utils/api'
import './AIAssistant.css'
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

const Markdown = ReactMarkdown as unknown as ComponentType<any>

function AIAssistant() {
  const [student, setStudent] = useState<Student | null>(null)
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [hasChat, setHasChat] = useState(false)
  const [burnout, setBurnout] = useState<BurnoutScore | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false)
  const [checkingBurnout, setCheckingBurnout] = useState(false)
  const [burnoutError, setBurnoutError] = useState('')
  const [chatMessage, setChatMessage] = useState("")
  const [hasUsedAI, setHasUsedAI] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [chatError, setChatError] = useState('')
  const [currentChatId, setCurrentChatId] = useState<number | null>(null)
  const [chatList, setChatList] = useState<Array<{id: number, title: string}>>([])
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(true)
  const [refreshingSuggestions, setRefreshingSuggestions] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void Promise.all([fetchData(), loadChats(), fetchSmartSuggestions()])
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchData = async () => {
    try {
      const res = await api.get('/auth/me')
      setStudent(res.data)
      try {
        const chatRes = await api.get("/ai/latest-chat")
        if (chatRes.data.exists) {
          setHasChat(true)
          setHasUsedAI(true)
          setCurrentChatId(chatRes.data.chat_id)
          setMessages(chatRes.data.messages)
        } else {
          setHasChat(false)
        }
      } catch (err) {
        console.error("Failed to load chat", err)
      }
    } catch (err) {
      console.error('Failed to fetch student', err)
    } finally {
      setLoading(false)
    }
  }

  const loadChat = async (chatId: number) => {
    try {
      const res = await api.get(`/ai/chat/${chatId}`)
      setCurrentChatId(chatId)
      setMessages(res.data.messages)
    } catch (err) {
      console.error("Failed to load chat", err)
    }
  }

  const createNewChat = async () => {
    setChatError('')
    try {
      const res = await api.post("/ai/new-chat")
      setCurrentChatId(res.data.chat_id)
      await loadChats()
      setMessages([])
      setHasChat(true)
      setHasUsedAI(true)
    } catch (err: any) {
      console.error("Failed to create chat", err)
      setChatError(err.response?.data?.detail || 'A new chat could not be created. Please try again.')
    }
  }

  const loadChats = async () => {
    try {
      const res = await api.get("/ai/chats")
      setChatList(res.data.chats)
    } catch (err) {
      console.error("Failed to load chats", err)
    }
  }

  const generateRoadmap = async () => {
    if (!student) return
    setGeneratingRoadmap(true)
    setChatError('')

    try {
      const newChat = await api.post("/ai/new-chat")
      setCurrentChatId(newChat.data.chat_id)
      await loadChats()
      const res = await api.post('/ai/roadmap', {
        chat_id: newChat.data.chat_id,
        branch: student.branch || 'Computer Science',
        year: student.year || 1,
        goals: student.goals || 'placements',
        weak_subjects: student.weak_subjects || '',
        study_hours_per_week: student.study_hours_per_week || 20,
      })
      setMessages([
        {
          role: "assistant",
          content: res.data.message,
        },
      ])
      setHasChat(true)
      setHasUsedAI(true)
    } catch (err: any) {
      console.error('Failed to generate roadmap', err)
      setChatError(err.response?.data?.detail || 'The roadmap could not be generated. Please try again.')
    } finally {
      setGeneratingRoadmap(false)
    }
  }

  const sendMessage = async () => {
    if (!chatMessage.trim()) return
    if (sendingMessage) return
    if (currentChatId === null) {
      setChatError('Create or select a chat before sending a message.')
      return
    }

    setSendingMessage(true)
    setChatError('')

    try {
      const message = chatMessage
      const chatId = currentChatId
      const shouldRenameChat = messages.length === 0
      setChatMessage("")
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content: message,
        },
      ])

      const res = await api.post(`/ai/chat/${chatId}`, {
        message: message,
      })

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data.message,
        },
      ])

      // A chat title is cosmetic. Rename only after the message succeeds, so a
      // transient SQLite lock can never block the actual Gemini conversation.
      if (shouldRenameChat) {
        try {
          await api.patch(`/ai/chat/${chatId}`, {
            title: message.length > 30 ? message.slice(0, 30) + "..." : message,
          })
          await loadChats()
        } catch (renameError) {
          console.warn("Could not rename chat", renameError)
        }
      }
    } catch (err: any) {
      console.error("Failed to send message", err)
      setChatError(err.response?.data?.detail || 'Your message could not be sent. Please try again.')
    } finally {
      setSendingMessage(false)
    }
  }

  const checkBurnout = async () => {
    setCheckingBurnout(true)
    setBurnoutError('')
    try {
      const res = await api.post('/ai/burnout-score', {})
      setBurnout(res.data.data)
      if (res.data.data?.suggestions_injected) {
        fetchSmartSuggestions()
      }
    } catch (err: any) {
      console.error('Failed to check burnout', err)
      setBurnoutError(err.response?.data?.detail || 'The assessment could not be completed. Please try again.')
    } finally {
      setCheckingBurnout(false)
    }
  }

  const fetchSmartSuggestions = async () => {
    try {
      const res = await api.get('/ai/smart-suggestions')
      setSuggestions(res.data.suggestions)
    } catch (err) {
      console.error('Failed to load smart suggestions', err)
    } finally {
      setSuggestionsLoading(false)
    }
  }

  const refreshSuggestions = async () => {
    setRefreshingSuggestions(true)
    try {
      const res = await api.post('/ai/smart-suggestions/refresh')
      setSuggestions(res.data.suggestions)
    } catch (err) {
      console.error('Failed to refresh smart suggestions', err)
    } finally {
      setRefreshingSuggestions(false)
    }
  }

  const updateSuggestion = async (id: number, updates: Partial<Pick<SmartSuggestion, 'status' | 'is_pinned'>>) => {
    try {
      const res = await api.patch(`/ai/smart-suggestions/${id}`, updates)
      if (updates.status && updates.status !== 'active') {
        setSuggestions(current => current.filter(suggestion => suggestion.id !== id))
      } else {
        setSuggestions(current => current.map(suggestion => suggestion.id === id ? res.data : suggestion))
      }
    } catch (err) {
      console.error('Failed to update smart suggestion', err)
    }
  }

  if (loading) return <div className="loading">Loading...</div>

  return (
    <div className="ai-page">
      <header className="ai-page-header">
        <div className="ai-page-header-inner">
          <h1>AI Assistant</h1>
          <p>Get personalized guidance based on your profile and goals</p>
        </div>
      </header>
      <main className="ai-main">
        <section className="ai-main-content">
          <aside className={`ai-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <div className="sidebar-header">
              <div className="ai-icon"><Sparkles size={24} /></div>
              <div>
                <h2>AI Assistant</h2>
                <p>Your personalized learning mentor</p>
              </div>
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="sidebar-toggle" aria-label="Toggle sidebar">
                <Menu />
              </button>
            </div>
            <div className="sidebar-profile">
              <h3>Profile</h3>
              <div className="profile-info">
                <div>
                  <strong>Domain:</strong> <span>{student?.domains?.split(',')[0] || 'Not set'}</span>
                </div>
                <div>
                  <strong>Study hours:</strong> <span>{student?.study_hours_per_week || 0}h/week</span>
                </div>
              </div>
            </div>
            <div className="sidebar-actions">
              <button
                className="primary"
                onClick={hasUsedAI ? createNewChat : generateRoadmap}
                disabled={generatingRoadmap}
              >
                {generatingRoadmap ? 'Creating...' : hasUsedAI ? 'New Chat' : 'Generate Roadmap'}
              </button>
            </div>
            <div className="sidebar-chat-history">
              <h3>Chat History</h3>
              <div className="chat-list">
                {chatList.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => loadChat(chat.id)}
                    className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
                  >
                    <span className="chat-title">{chat.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <section className="ai-chat-window">
            <header className="chat-header">
              <h2>
                {hasUsedAI ? 'AI Mentor' : 'Personalized Roadmap'}
                {hasChat && !hasUsedAI && (
                  <span className="chat-status">Active</span>
                )}
              </h2>
              {!hasChat && !hasUsedAI && (
                <p className="chat-empty">
                  Start a conversation to get your personalized learning plan.
                </p>
              )}
            </header>
            <div className="chat-messages">
              {messages.length === 0 && hasChat && (
                <div className="chat-empty-state">
                  <p>Start a conversation by asking a question.</p>
                </div>
              )}
              <div>
                {messages.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}>
                    <div className="message-content">
                      <strong>{msg.role === 'user' ? 'You' : 'AI Mentor'}</strong>
                      <div className="message-text">
                        <Markdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </Markdown>
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={scrollRef} style={{ height: 0 }} />
              </div>
            </div>
            <form className="chat-form" onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Ask a follow-up question..."
                disabled={sendingMessage}
                required
              />
              <button type="submit" className="primary" disabled={sendingMessage}>
                {sendingMessage ? 'Answering...' : 'Send'}
              </button>
            </form>
            {chatError && <p className="burnout-error" role="alert">{chatError}</p>}
          </section>
        </section>
      </main>
      <section className="dashboard">
        <div className="dashboard-grid">
          <BurnoutAssessmentCard
            student={student}
            burnout={burnout}
            burnoutError={burnoutError}
            checkingBurnout={checkingBurnout}
            checkBurnout={checkBurnout}
          />
          <SmartSuggestionsCard suggestions={suggestions} loading={suggestionsLoading} refreshing={refreshingSuggestions} onRefresh={refreshSuggestions} onUpdate={updateSuggestion} />
        </div>
      </section>
    </div>
  )
}

// Burnout Assessment Card
function BurnoutAssessmentCard({
  student,
  burnout,
  burnoutError,
  checkingBurnout,
  checkBurnout,
}: any) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon"><Activity size={20} /></div>
        <h3>Burnout Risk Assessment</h3>
      </div>
      <p className="card-description">
        Understand your burnout risk based on study patterns and workload. This helps maintain balance.
      </p>
      <div className="card-content">
        <div className="info-item">
          <span><strong>Current study hours:</strong> {student?.study_hours_per_week || 0}h/week</span>
        </div>
        <button className="primary-btn" onClick={checkBurnout} disabled={checkingBurnout}>
          {checkingBurnout ? 'Analyzing...' : burnout ? 'Refresh Assessment' : 'Check Risk Level'}
        </button>
        {burnoutError && <p className="burnout-error">{burnoutError}</p>}
        {burnout && (
          <div className="burnout-result">
            <div className={`risk-indicator ${burnout.risk_level.toLowerCase()}`}>
              <span className="risk-score">{burnout.score}%</span>
              <span className="risk-label">{burnout.risk_level} Risk</span>
            </div>
            <h4>Recommendations</h4>
            <ul className="recommendations">
              {burnout.recommendations.map((rec: any, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

// Smart Suggestions Card
function SmartSuggestionsCard({
  suggestions,
  loading,
  refreshing,
  onRefresh,
  onUpdate,
}: {
  suggestions: SmartSuggestion[]
  loading: boolean
  refreshing: boolean
  onRefresh: () => Promise<void>
  onUpdate: (id: number, updates: Partial<Pick<SmartSuggestion, 'status' | 'is_pinned'>>) => Promise<void>
}) {
  return (
    <div className="card smart-suggestions-card">
      <div className="card-header">
        <div className="card-icon"><Calendar size={20} /></div>
        <h3>Smart Suggestions</h3>
        <button className="suggestion-refresh" onClick={onRefresh} disabled={refreshing} title="Refresh suggestions">
          <RefreshCw size={15} className={refreshing ? 'spinning' : ''} />
        </button>
      </div>
      <p className="card-description">
        Your next best actions, based on your profile and recent mentor conversations.
      </p>
      <div className="card-content">
        {loading ? <div className="suggestions-empty">Finding your next steps...</div> : suggestions.length === 0 ? (
          <div className="suggestions-empty">You're all caught up. Refresh when you want a new focus.</div>
        ) : <div className="suggestions-list">
          {suggestions.map(suggestion => (
            <article className="suggestion-item" key={suggestion.id}>
              <div className="suggestion-title-row">
                <strong>{suggestion.title}</strong>
                {suggestion.is_pinned && <Pin size={13} className="pinned-icon" fill="currentColor" />}
              </div>
              <p>{suggestion.reason}</p>
              <ol>{suggestion.action_steps.map((step, index) => <li key={index}>{step}</li>)}</ol>
              {suggestion.resource && (
                <a className="suggestion-resource" href={suggestion.resource.url || '/resources'} target={suggestion.resource.url ? '_blank' : undefined} rel="noreferrer">
                  {suggestion.resource.title} <ExternalLink size={12} />
                </a>
              )}
              <div className="suggestion-actions">
                <button onClick={() => onUpdate(suggestion.id, { is_pinned: !suggestion.is_pinned })}><Pin size={14} /> {suggestion.is_pinned ? 'Unpin' : 'Pin'}</button>
                <button onClick={() => onUpdate(suggestion.id, { status: 'completed' })}><Check size={14} /> Done</button>
                <button onClick={() => onUpdate(suggestion.id, { status: 'dismissed' })}><X size={14} /> Dismiss</button>
              </div>
            </article>
          ))}
        </div>}
      </div>
    </div>
  )
}

export default AIAssistant
