import { useState, useEffect, useRef } from 'react'
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Timer,
  CheckCircle2,
  Minimize2,
  Maximize2,
  X,
  Flame,
  Volume2,
  VolumeX,
} from 'lucide-react'
import api from '../utils/api'
import './PomodoroTimer.css'

export type TimerMode = 'pomodoro' | 'deepwork' | 'shortbreak' | 'longbreak'

const MODE_DURATIONS: Record<TimerMode, number> = {
  pomodoro: 25 * 60,
  deepwork: 50 * 60,
  shortbreak: 5 * 60,
  longbreak: 15 * 60,
}

const MODE_LABELS: Record<TimerMode, string> = {
  pomodoro: 'Pomodoro (25m)',
  deepwork: 'Deep Work (50m)',
  shortbreak: 'Short Break (5m)',
  longbreak: 'Long Break (15m)',
}

interface PomodoroTimerProps {
  onSessionLogged?: () => void
}

export default function PomodoroTimer({ onSessionLogged }: PomodoroTimerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [mode, setMode] = useState<TimerMode>('pomodoro')
  const [timeLeft, setTimeLeft] = useState(MODE_DURATIONS.pomodoro)
  const [isRunning, setIsRunning] = useState(false)
  const [subject, setSubject] = useState('DSA & Core Academics')
  const [autoLog, setAutoLog] = useState(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [completedSessions, setCompletedSessions] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  
  const timerRef = useRef<number | null>(null)
  const startTimeRef = useRef<Date | null>(null)

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) {
        startTimeRef.current = new Date()
      }
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerComplete()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRunning, mode])

  const playBeep = () => {
    if (!soundEnabled) return
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 587.33 // D5
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch {
      // AudioContext not allowed or supported
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleTimerComplete = async () => {
    setIsRunning(false)
    playBeep()
    setCompletedSessions(prev => prev + 1)

    const isStudySession = mode === 'pomodoro' || mode === 'deepwork'
    if (isStudySession && autoLog) {
      await logSessionToPlanner()
    } else {
      showToast(`🎉 ${MODE_LABELS[mode]} session completed!`)
    }

    // Auto-switch to break or pomodoro
    if (mode === 'pomodoro' || mode === 'deepwork') {
      const nextBreak = (completedSessions + 1) % 4 === 0 ? 'longbreak' : 'shortbreak'
      switchMode(nextBreak)
    } else {
      switchMode('pomodoro')
    }
  }

  const logSessionToPlanner = async () => {
    const now = new Date()
    const durationMinutes = mode === 'deepwork' ? 50 : 25
    const startDate = new Date(now.getTime() - durationMinutes * 60000)

    const startH = startDate.getHours().toString().padStart(2, '0')
    const startM = startDate.getMinutes().toString().padStart(2, '0')
    const endH = now.getHours().toString().padStart(2, '0')
    const endM = now.getMinutes().toString().padStart(2, '0')
    const dateStr = now.toISOString().split('T')[0]

    try {
      await api.post('/events/', {
        title: `Focus Session: ${subject || 'Study'}`,
        description: `Automated focus session logged via ATLAS Pomodoro Timer (${durationMinutes} mins).`,
        date: dateStr,
        start_time: `${startH}:${startM}`,
        end_time: `${endH}:${endM}`,
        tag: 'IMPORTANT',
        category: 'CLASS',
        is_working_hour: true,
        is_recurring: false,
        is_completed: true,
      })

      showToast(`🎯 Logged ${durationMinutes}m focus session to Planner! +${(durationMinutes / 60).toFixed(2)}h working hours added to Telemetry.`)
      if (onSessionLogged) onSessionLogged()
    } catch (err) {
      showToast(`Session finished (${durationMinutes}m). Could not auto-log to planner.`)
    }
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const switchMode = (newMode: TimerMode) => {
    setMode(newMode)
    setTimeLeft(MODE_DURATIONS[newMode])
    setIsRunning(false)
    startTimeRef.current = null
  }

  const togglePlay = () => {
    setIsRunning(!isRunning)
  }

  const resetTimer = () => {
    setIsRunning(false)
    setTimeLeft(MODE_DURATIONS[mode])
    startTimeRef.current = null
  }

  const skipTimer = () => {
    handleTimerComplete()
  }

  const totalDuration = MODE_DURATIONS[mode]
  const progressPercent = ((totalDuration - timeLeft) / totalDuration) * 100

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="pomodoro-toast">
          <CheckCircle2 size={18} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Floating Launcher Pill when closed */}
      {!isOpen && (
        <button
          className="pomodoro-floating-launcher"
          onClick={() => setIsOpen(true)}
          title="Open Focus Timer"
        >
          <Timer size={18} className={isRunning ? 'spin-icon' : ''} />
          <span>{isRunning ? formatTime(timeLeft) : 'Focus Timer'}</span>
          {completedSessions > 0 && (
            <span className="session-count-badge">
              <Flame size={12} /> {completedSessions}
            </span>
          )}
        </button>
      )}

      {/* Open Timer Panel */}
      {isOpen && (
        <div className={`pomodoro-widget ${isMinimized ? 'minimized' : ''}`}>
          <div className="pomodoro-header">
            <div className="pomodoro-title">
              <Timer size={16} />
              <span>Pomodoro Focus</span>
              {completedSessions > 0 && (
                <span className="session-pill">🔥 {completedSessions} done</span>
              )}
            </div>
            <div className="pomodoro-header-actions">
              <button
                className="header-icon-btn"
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                className="header-icon-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              </button>
              <button
                className="header-icon-btn close"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <div className="pomodoro-body">
              {/* Mode Switcher */}
              <div className="pomodoro-modes">
                <button
                  className={`mode-btn ${mode === 'pomodoro' ? 'active' : ''}`}
                  onClick={() => switchMode('pomodoro')}
                >
                  Pomodoro
                </button>
                <button
                  className={`mode-btn ${mode === 'deepwork' ? 'active' : ''}`}
                  onClick={() => switchMode('deepwork')}
                >
                  Deep Work
                </button>
                <button
                  className={`mode-btn ${mode === 'shortbreak' ? 'active' : ''}`}
                  onClick={() => switchMode('shortbreak')}
                >
                  Short Break
                </button>
                <button
                  className={`mode-btn ${mode === 'longbreak' ? 'active' : ''}`}
                  onClick={() => switchMode('longbreak')}
                >
                  Long Break
                </button>
              </div>

              {/* Progress Ring and Digits */}
              <div className="timer-display-container">
                <svg className="timer-progress-ring" viewBox="0 0 120 120">
                  <circle
                    className="progress-ring-bg"
                    cx="60"
                    cy="60"
                    r="52"
                    strokeWidth="8"
                  />
                  <circle
                    className="progress-ring-fill"
                    cx="60"
                    cy="60"
                    r="52"
                    strokeWidth="8"
                    strokeDasharray={2 * Math.PI * 52}
                    strokeDashoffset={2 * Math.PI * 52 * (1 - progressPercent / 100)}
                  />
                </svg>
                <div className="timer-digits">
                  <span className="digits">{formatTime(timeLeft)}</span>
                  <span className="mode-name">{mode.toUpperCase()}</span>
                </div>
              </div>

              {/* Subject Tag Selector */}
              <div className="subject-input-row">
                <input
                  type="text"
                  placeholder="What are you focusing on?"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="subject-input"
                />
              </div>

              {/* Controls */}
              <div className="pomodoro-controls">
                <button className="control-btn" onClick={resetTimer} title="Reset">
                  <RotateCcw size={16} />
                </button>
                <button
                  className={`control-btn primary ${isRunning ? 'running' : ''}`}
                  onClick={togglePlay}
                >
                  {isRunning ? <Pause size={20} /> : <Play size={20} className="play-icon" />}
                </button>
                <button className="control-btn" onClick={skipTimer} title="Complete/Skip">
                  <SkipForward size={16} />
                </button>
              </div>

              {/* Auto Log Checkbox */}
              <label className="auto-log-label">
                <input
                  type="checkbox"
                  checked={autoLog}
                  onChange={e => setAutoLog(e.target.checked)}
                />
                <span>Auto-log study time to Planner & Telemetry</span>
              </label>
            </div>
          )}

          {/* Minimized View */}
          {isMinimized && (
            <div className="minimized-strip" onClick={() => setIsMinimized(false)}>
              <span className="minimized-digits">{formatTime(timeLeft)}</span>
              <button
                className="mini-play-btn"
                onClick={e => {
                  e.stopPropagation()
                  togglePlay()
                }}
              >
                {isRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
