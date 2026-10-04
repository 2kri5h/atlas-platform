import React, { useState } from 'react'
import { Phone, ShieldAlert, HeartHandshake, AlertCircle, Copy, Check, ChevronDown, ChevronUp, LifeBuoy } from 'lucide-react'
import { EmergencyTier } from '../../utils/api'

interface CrisisDirectoryProps {
  onClose?: () => void
  isFloating?: boolean
}

export const VERIFIED_CAMPUS_TIERS: EmergencyTier[] = [
  {
    id: 'immediate',
    title: 'Emergency & Urgent Medical / Security',
    items: [
      {
        name: 'IITB Hospital Emergency (24×7)',
        detail: 'Direct casualty & ambulance dispatch',
        phone: '022 2159 1110 / +91 82912 97051',
        tel: '02221591110',
      },
      {
        name: 'Quick Response Team (QRT - Male)',
        detail: 'Campus security fast response unit',
        phone: '+91 98333 38989',
        tel: '9833338989',
      },
      {
        name: 'Quick Response Team (QRT - Female)',
        detail: 'Campus security female patrol & support',
        phone: '+91 91673 98598',
        tel: '9167398598',
      },
      {
        name: 'Campus Main Gate Security Control',
        detail: 'General security central intercom: 1111',
        phone: '022 2576 1111',
        tel: '02225761111',
      },
    ],
  },
  {
    id: 'wellness',
    title: 'Mental Health & Student Counselling',
    items: [
      {
        name: 'Talk to Angel (24×7 Confidential Counselling)',
        detail: 'Free professional tele-counselling for all IITB students',
        phone: '080 4713 6761',
        tel: '08047136761',
      },
      {
        name: 'Student Wellness Centre (SWC)',
        detail: 'Main Building 3rd Floor, Intercom: 9070',
        phone: '022 2576 9070',
        tel: '02225769070',
      },
      {
        name: 'Tele-MANAS National Helpline',
        detail: 'Government of India 24×7 mental health care',
        phone: '14416',
        tel: '14416',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Rights, Gender Cell & Anti-Ragging',
    items: [
      {
        name: 'Internal Complaints Committee (ICC) / Gender Cell',
        detail: 'Protection against sexual harassment on campus',
        phone: '022 2576 7080',
        tel: '02225767080',
      },
      {
        name: 'National Anti-Ragging Helpline',
        detail: 'UGC 24×7 toll-free anti-ragging complaint line',
        phone: '1800 180 5522',
        tel: '18001805522',
      },
    ],
  },
]

export const CrisisDirectory: React.FC<CrisisDirectoryProps> = ({ onClose, isFloating = false }) => {
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<string>('immediate')

  const copyToClipboard = (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text)
    setCopiedPhone(text)
    setTimeout(() => setCopiedPhone(null), 2000)
  }

  return (
    <div className={`crisis-directory-card ${isFloating ? 'floating' : ''}`} role="region" aria-label="Crisis Directory">
      <div className="crisis-header">
        <div className="crisis-title-wrap">
          <div className="crisis-icon-badge" aria-hidden="true">
            <LifeBuoy size={20} className="pulse-icon" />
          </div>
          <div>
            <h3 className="crisis-heading">IIT Bombay Crisis & Wellness Directory</h3>
            <p className="crisis-subtext">Verified 24×7 campus emergency, medical & mental health contacts</p>
          </div>
        </div>
        {onClose && (
          <button className="crisis-close-btn" onClick={onClose} aria-label="Close directory">
            &times;
          </button>
        )}
      </div>

      <div className="crisis-disclaimer">
        <ShieldAlert size={16} className="text-amber" aria-hidden="true" />
        <span>All counselling and medical requests are strictly confidential under Institute policies.</span>
      </div>

      <div className="crisis-tiers">
        {VERIFIED_CAMPUS_TIERS.map((tier) => {
          const isOpen = openSection === tier.id
          return (
            <div key={tier.id} className={`crisis-tier-block ${isOpen ? 'open' : ''}`}>
              <button
                className="crisis-tier-header"
                onClick={() => setOpenSection(isOpen ? '' : tier.id)}
                aria-expanded={isOpen}
              >
                <div className="tier-header-left">
                  {tier.id === 'immediate' && <AlertCircle size={16} className="tier-icon danger" />}
                  {tier.id === 'wellness' && <HeartHandshake size={16} className="tier-icon wellness" />}
                  {tier.id === 'safety' && <ShieldAlert size={16} className="tier-icon safety" />}
                  <span className="tier-title">{tier.title}</span>
                </div>
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {isOpen && (
                <div className="crisis-tier-items">
                  {tier.items.map((item, idx) => (
                    <div key={idx} className="crisis-item">
                      <div className="crisis-item-info">
                        <div className="crisis-item-name">{item.name}</div>
                        <div className="crisis-item-detail">{item.detail}</div>
                      </div>
                      <div className="crisis-item-actions">
                        <a
                          href={`tel:${item.tel}`}
                          className="crisis-call-btn"
                          aria-label={`Call ${item.name} at ${item.phone}`}
                        >
                          <Phone size={14} />
                          <span>Call</span>
                        </a>
                        <button
                          type="button"
                          className="crisis-copy-btn"
                          onClick={(e) => copyToClipboard(item.phone, e)}
                          title="Copy number"
                          aria-label={`Copy phone number for ${item.name}`}
                        >
                          {copiedPhone === item.phone ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default CrisisDirectory
