import React, { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import './FAQSection.css'

interface FAQItem {
  id: number
  question: string
  answer: string
  category: string
}

const FAQS: FAQItem[] = [
  {
    id: 1,
    category: 'Timetable & OCR',
    question: 'How does the AI Timetable OCR scanner extract my course slots?',
    answer: 'Upload or paste an image or PDF screenshot of your IIT Bombay ASC timetable. The integrated vision model automatically parses slot timings (Slot 1-14, labs, and tutorials) and generates a structured weekly grid that you can review and import with 1 click.',
  },
  {
    id: 2,
    category: 'Security & Webmail',
    question: 'Is my IITB Webmail / IMAP sync credentials secure?',
    answer: 'Yes. Your Webmail IMAP app password is cryptographically encrypted using Fernet symmetric key tokens on the server. Credentials are never stored in plaintext or shared with external parties, and sync requests run purely within isolated sessions.',
  },
  {
    id: 3,
    category: 'AI Mentor & Wellness',
    question: 'How is the Burnout & Workload Score calculated?',
    answer: 'The system uses an analytics pipeline incorporating your active study hours, course credit load, sleep patterns, screen time, upcoming exam deadlines, and academic stress indicators to provide early burnout risk alerts and adaptive rebalancing suggestions.',
  },
  {
    id: 4,
    category: 'Privacy & Forum',
    question: 'How does privacy work on the Anonymous Discussion Portal?',
    answer: 'Posts and replies created in the Anonymous Portal are dissociated from your roll number, name, and profile before persistence. Other students and moderators only see randomized pseudonymous identifiers, allowing safe academic and campus discussions.',
  },
  {
    id: 5,
    category: 'Placements & Academics',
    question: 'How do Senior Journeys and curated Resources help my career prep?',
    answer: 'Senior Journeys feature verified interview experiences and preparation timelines from graduating IITB seniors across SDE, AI/ML, Finance, Core Engineering, Research, and Consulting. You can bookmark curated resources and add recommended milestones directly to your planner.',
  },
]

export const FAQSection: React.FC = () => {
  const [openId, setOpenId] = useState<number | null>(1)

  const toggle = (id: number) => {
    setOpenId(prev => (prev === id ? null : id))
  }

  return (
    <section className="faq-section" aria-label="Frequently Asked Questions">
      <div className="faq-header">
        <div className="faq-badge">
          <HelpCircle size={14} />
          <span>Help & Knowledge Center</span>
        </div>
        <h2 className="faq-title">Frequently Asked Questions</h2>
        <p className="faq-subtitle">
          Everything you need to know about ATLAS features, security, AI planning, and IIT Bombay integrations.
        </p>
      </div>

      <div className="faq-list">
        {FAQS.map((faq) => {
          const isOpen = openId === faq.id
          return (
            <div key={faq.id} className={`faq-card ${isOpen ? 'open' : ''}`}>
              <button
                type="button"
                className="faq-question-btn"
                onClick={() => toggle(faq.id)}
                aria-expanded={isOpen}
              >
                <div className="faq-question-text">
                  <span className="faq-category-tag">{faq.category}</span>
                  <span className="faq-question">{faq.question}</span>
                </div>
                <div className="faq-toggle-icon">
                  <ChevronDown size={18} />
                </div>
              </button>
              {isOpen && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
