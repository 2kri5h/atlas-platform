import React, { useState } from 'react'
import {
  Mail,
  Copy,
  Check,
  Send,
  MessageSquare,
  HelpCircle,
  AlertCircle,
  Phone,
  Shield,
  HeartHandshake,
  ExternalLink,
  Sparkles,
  MapPin,
  Clock,
} from 'lucide-react'
import './ContactUs.css'

const CONTACT_EMAIL = 'atlas.studenthub@gmail.com'

const CAMPUS_EMERGENCY_CONTACTS = [
  {
    title: 'Student Wellness Centre (SWC)',
    contact: '022-2576-9070',
    description: 'Confidential mental health counselors, peer support, and student well-being sessions.',
    badge: 'Wellness',
    link: 'tel:02225769070',
    icon: HeartHandshake,
    accent: 'purple',
  },
  {
    title: 'IITB Hospital Emergency',
    contact: '022-2576-1110',
    description: '24/7 on-campus ambulance, casualty ward, medical triage, and emergency doctor line.',
    badge: 'Medical 24/7',
    link: 'tel:02225761110',
    icon: Phone,
    accent: 'rose',
  },
  {
    title: 'Main Security Control Room',
    contact: '022-2576-1100',
    description: 'Main Gate security, lost and found, quick response team, and campus night safety.',
    badge: 'Security',
    link: 'tel:02225761100',
    icon: Shield,
    accent: 'blue',
  },
  {
    title: 'Dean of Academic Programmes (Dean AP)',
    contact: 'dean.ap@iitb.ac.in',
    description: 'Official academic policies, semester rules, registration appeals, and course drop queries.',
    badge: 'Academics',
    link: 'mailto:dean.ap@iitb.ac.in',
    icon: HelpCircle,
    accent: 'amber',
  },
]

export default function ContactUs() {
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    emailOrRoll: '',
    subject: 'Feedback / General Query',
    message: '',
  })
  const [formSubmitted, setFormSubmitted] = useState(false)

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(CONTACT_EMAIL)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Form mailto draft fallback
    const subject = encodeURIComponent(`[ATLAS Support] ${formData.subject} - ${formData.name || formData.emailOrRoll}`)
    const body = encodeURIComponent(
      `From: ${formData.name}\nRoll / Contact: ${formData.emailOrRoll}\nCategory: ${formData.subject}\n\nMessage:\n${formData.message}`
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`

    setFormSubmitted(true)
    setTimeout(() => {
      setFormSubmitted(false)
      setFormData({
        name: '',
        emailOrRoll: '',
        subject: 'Feedback / General Query',
        message: '',
      })
    }, 4000)
  }

  return (
    <div className="contact-page">
      {/* ── Header ── */}
      <header className="contact-header">
        <div className="contact-badge-pill">
          <MessageSquare size={13} />
          <span>TEAM ATLAS SUPPORT & FEEDBACK</span>
        </div>
        <h1>Contact Us</h1>
        <p className="contact-subtitle">
          Have a question, feedback, or found a bug? We are here to help. Reach out directly to Team ATLAS.
        </p>
      </header>

      <div className="contact-layout">
        {/* ── Left Column: Contact Cards & Info ── */}
        <div className="contact-info-col">
          {/* Main Email Card */}
          <div className="contact-card primary-contact-card">
            <div className="contact-card-header">
              <div className="contact-icon-wrapper email-icon">
                <Mail size={22} />
              </div>
              <div>
                <span className="contact-label">Official Support Email</span>
                <h3 className="contact-email-text">{CONTACT_EMAIL}</h3>
              </div>
            </div>

            <p className="contact-card-desc">
              For platform inquiries, bug reports, feature requests, or collaborating with Team ATLAS.
            </p>

            <div className="contact-card-actions">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=[ATLAS]%20Inquiry`}
                className="contact-btn-primary"
              >
                <Mail size={15} />
                <span>Send Email</span>
              </a>

              <button
                type="button"
                className={`contact-btn-secondary ${copiedEmail ? 'copied' : ''}`}
                onClick={handleCopyEmail}
                title="Copy email to clipboard"
              >
                {copiedEmail ? <Check size={15} /> : <Copy size={15} />}
                <span>{copiedEmail ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>

            <div className="contact-meta-strip">
              <div className="contact-meta-item">
                <Clock size={13} />
                <span>Usually responds within 24h</span>
              </div>
              <div className="contact-meta-item">
                <MapPin size={13} />
                <span>IIT Bombay, Powai, Mumbai</span>
              </div>
            </div>
          </div>

          {/* About Team ATLAS Card */}
          <div className="contact-card about-atlas-card">
            <div className="contact-card-header">
              <div className="contact-icon-wrapper sparkles-icon">
                <Sparkles size={20} />
              </div>
              <div>
                <span className="contact-label">Student Initiative</span>
                <h3 className="contact-card-heading">About Team ATLAS</h3>
              </div>
            </div>
            <p className="contact-card-desc">
              ATLAS is an all-in-one productivity, mental wellbeing, and academic hub designed specifically for IIT Bombay students — uniting timetable management, campus circulars, webmail intelligence, anonymous peer support, and senior journeys in a single unified interface.
            </p>
            <div className="atlas-creators-pill">
              Built with ❤️ by students at IIT Bombay
            </div>
          </div>
        </div>

        {/* ── Right Column: Interactive Feedback / Inquiry Form ── */}
        <div className="contact-form-col">
          <div className="contact-card form-card">
            <div className="form-card-header">
              <h2>Send us a Message</h2>
              <p>Fill out the details below and we will get back to you promptly.</p>
            </div>

            {formSubmitted ? (
              <div className="contact-success-state">
                <div className="success-icon-wrapper">
                  <Check size={28} />
                </div>
                <h3>Message Ready!</h3>
                <p>
                  Your email client has opened with your inquiry draft addressed to <strong>{CONTACT_EMAIL}</strong>. If your email app did not open automatically, you can send an email directly to <strong>{CONTACT_EMAIL}</strong>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="contact-form">
                <div className="form-row">
                  <div className="form-field">
                    <label>Your Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Amit Patel"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="form-field">
                    <label>Roll Number or Email *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 21001001 or roll@iitb.ac.in"
                      value={formData.emailOrRoll}
                      onChange={(e) => setFormData({ ...formData, emailOrRoll: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label>Topic / Category</label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  >
                    <option value="Feedback / General Query">General Feedback & Suggestions</option>
                    <option value="Bug Report">Bug Report / Technical Issue</option>
                    <option value="Timetable or Academic Data Error">Timetable or Academic Data Issue</option>
                    <option value="Feature Suggestion">Feature Request</option>
                    <option value="Collaboration or SARC Connect">Collaboration / POR Query</option>
                  </select>
                </div>

                <div className="form-field">
                  <label>Message *</label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Describe your question, issue, or feedback in detail..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  />
                </div>

                <button type="submit" className="contact-submit-btn">
                  <Send size={16} />
                  <span>Send Message to Team ATLAS</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* ── Campus Emergency Directory ── */}
      <section className="emergency-contacts-section">
        <div className="section-title-wrap">
          <div className="section-title-left">
            <AlertCircle size={20} className="emergency-header-icon" />
            <div>
              <h2>IIT Bombay Campus Helpline & Support Contacts</h2>
              <p>Official institute contacts for academic, medical, and wellness support.</p>
            </div>
          </div>
        </div>

        <div className="emergency-grid">
          {CAMPUS_EMERGENCY_CONTACTS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={idx} className={`emergency-card accent-${item.accent}`}>
                <div className="emergency-card-top">
                  <div className="emergency-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <span className="emergency-badge">{item.badge}</span>
                </div>

                <h3 className="emergency-title">{item.title}</h3>
                <p className="emergency-desc">{item.description}</p>

                <div className="emergency-card-footer">
                  <a
                    href={item.link}
                    className="emergency-contact-link"
                    title={`Contact ${item.title}`}
                  >
                    <span>{item.contact}</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
