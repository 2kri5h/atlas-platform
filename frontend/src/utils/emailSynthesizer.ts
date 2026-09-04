import type { EmailRecord } from './api'

export interface SynthesizedBriefingItem {
  id: string | number
  lineNumber: number
  originSource: 'iitb' | 'gmail'
  senderClean: string
  actionType: 'quiz' | 'deadline' | 'event' | 'application' | 'academic' | 'general'
  actionBadge: string
  briefingSentence: string
  date?: string
  time?: string
  venue?: string
  rawEmail: EmailRecord & { originSource: 'iitb' | 'gmail' }
}

function decodeHtmlEntities(str: string): string {
  if (!str) return ''
  return str
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
}

export function cleanSenderName(sender?: string): string {
  if (!sender) return 'Someone'
  const decoded = decodeHtmlEntities(sender).trim()

  // Match "Name <email@domain>"
  const match = decoded.match(/^([^<]+)<.*>/)
  if (match) {
    let name = match[1].trim().replace(/^["']|["']$/g, '')
    if (name.length > 0) return name
  }

  // If email address only: user@company.com -> Company
  if (decoded.includes('@')) {
    const domainPart = decoded.split('@')[1]
    if (domainPart) {
      const parts = domainPart.split('.')
      const brand = parts.length > 2 ? parts[parts.length - 2] : parts[0]
      if (brand && brand.length > 2) {
        return brand.charAt(0).toUpperCase() + brand.slice(1)
      }
    }
  }

  return decoded
}

function cleanSubjectTopic(subject?: string): string {
  if (!subject) return 'an update'
  let s = decodeHtmlEntities(subject).trim()

  // Remove common prefixes
  s = s.replace(/^(?:re|fwd|fw|notice|urgent|update|reminder)\s*:\s*/gi, '')
  s = s.replace(/^\[[^\]]+\]\s*/g, '')

  return s.trim() || 'an update'
}

function formatDateDisplay(dateRaw?: string): string {
  if (!dateRaw) return ''
  try {
    const d = new Date(dateRaw)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
      })
    }
  } catch {
    // fallback
  }
  return dateRaw
}

export function synthesizeEmailBriefing(
  email: EmailRecord & { originSource: 'iitb' | 'gmail' },
  index: number
): SynthesizedBriefingItem {
  const sender = cleanSenderName(email.sender)
  const cleanSubject = cleanSubjectTopic(email.subject)
  const fullText = `${email.subject} ${email.summary || ''} ${email.body_snippet || ''}`.toLowerCase()

  // Check attached events
  const attachedEvent = email.events && email.events.length > 0 ? email.events[0] : null

  let date = attachedEvent?.event_date
    ? formatDateDisplay(attachedEvent.event_date)
    : undefined
  let time = attachedEvent?.event_time || undefined
  let venue = attachedEvent?.location || undefined

  // If date/time/venue not in attachedEvent, inspect text heuristically
  if (!date) {
    const dateMatch = fullText.match(
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2})\b/i
    )
    if (dateMatch) date = dateMatch[1]
  }

  if (!time) {
    const timeMatch = fullText.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)|\d{1,2}:\d{2}\s*(?:hrs|hours))\b/)
    if (timeMatch) time = timeMatch[1]
  }

  // Enhanced Venue Detection
  if (!venue) {
    const rawContent = decodeHtmlEntities(`${email.subject} ${email.summary || ''} ${email.body || ''} ${email.body_snippet || ''}`)
    
    // Check known IIT Bombay venues first
    const knownVenues = [
      /\b(LA\s*\d{1,3}[A-Z]?|Lecture\s+Hall\s+Complex|LHC)\b/i,
      /\b(LH\s*\d{1,3}[A-Z]?|LT\s*\d{1,3}[A-Z]?)\b/i,
      /\b(P\.?\s*C\.?\s*Saxena\s+Auditorium|PC\s*Saxena|PCS\s+Auditorium)\b/i,
      /\b(Convocation\s+Hall|Convo\s+Hall)\b/i,
      /\b(VMCC(?:\s*(?:Room|MR|LT)\s*\d+)?|Victor\s+Menezes\s+Convention\s+Cent(?:re|er))\b/i,
      /\b(SAC|Students?\s+Activity\s+Cent(?:re|er)|Gymkhana\s+Grounds?|Old\s+SAC|New\s+SAC)\b/i,
      /\b(Computer\s+Cent(?:re|er)|CC\s+Lab|KReSIT(?:\s*Auditorium)?|Kanwal\s+Rekhi)\b/i,
      /\b(Main\s+Building(?:\s*Foyer)?|MB\s*\d+[a-z]?|SOM\s*Room\s*\d+|DSSE)\b/i,
      /\b(Online\s*(?:\(Zoom\/Teams\/Meet\))?|Zoom(?:\s+Meeting)?|Google\s+Meet|MS\s+Teams|Webex)\b/i,
    ]

    for (const rx of knownVenues) {
      const match = rawContent.match(rx)
      if (match) {
        venue = match[1].trim()
        break
      }
    }

    // Fallback: search for "Venue: ...", "Location: ...", or "at <Place>"
    if (!venue) {
      const venueLabelMatch = rawContent.match(/\b(?:venue|location)\s*[:\-]\s*([A-Za-z0-9\s,\-]{3,35})(?:\r|\n|\.|\)|$)/i)
      if (venueLabelMatch) {
        venue = venueLabelMatch[1].trim()
      } else {
        const atVenueMatch = rawContent.match(/\b(?:at|in)\s+([A-Z][A-Za-z0-9\s\-]{2,25}(?:Hall|Auditorium|Lab|Complex|Grounds?|Foyer))\b/)
        if (atVenueMatch) {
          venue = atVenueMatch[1].trim()
        }
      }
    }
  }

  // Enhanced Time Detection
  if (!time) {
    const rawContent = `${email.subject} ${email.summary || ''} ${email.body || ''} ${email.body_snippet || ''}`
    const timeMatch = rawContent.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)|\d{1,2}:\d{2}\s*(?:hrs|hours|IST)?)\b/)
    if (timeMatch) {
      time = timeMatch[1].trim()
    } else {
      const rangeMatch = rawContent.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i)
      if (rangeMatch) time = rangeMatch[1].trim()
    }
  }

  // Enhanced Date Detection
  if (!date) {
    const dateMatch = fullText.match(
      /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/i
    )
    if (dateMatch) {
      date = dateMatch[1].trim()
    } else if (email.date_received || email.received_at || email.date) {
      date = formatDateDisplay(email.date_received || email.received_at || email.date)
    }
  }

  // Ensure venue fallback for events if completely unspecified
  const isEventLike =
    fullText.includes('organis') ||
    fullText.includes('organiz') ||
    fullText.includes('workshop') ||
    fullText.includes('talk') ||
    fullText.includes('seminar') ||
    fullText.includes('summit') ||
    fullText.includes('conference') ||
    fullText.includes('hackathon') ||
    fullText.includes('symposium') ||
    fullText.includes('quiz') ||
    fullText.includes('midsem') ||
    fullText.includes('endsem') ||
    attachedEvent?.event_type?.toUpperCase() === 'EVENT' ||
    attachedEvent?.event_type?.toUpperCase() === 'WORKSHOP' ||
    attachedEvent?.event_type?.toUpperCase() === 'TALK' ||
    attachedEvent?.event_type?.toUpperCase() === 'QUIZ'

  // Extract email received timestamp for general notices
  const emailRawDate = email.date_received || email.received_at || email.date
  let emailDateFormatted = ''
  let emailTimeFormatted = ''

  if (emailRawDate) {
    try {
      const d = new Date(emailRawDate)
      if (!isNaN(d.getTime())) {
        emailDateFormatted = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
        const hours = d.getHours()
        const minutes = d.getMinutes().toString().padStart(2, '0')
        const ampm = hours >= 12 ? 'pm' : 'am'
        const hour12 = hours % 12 || 12
        emailTimeFormatted = `${hour12}:${minutes} ${ampm}`
      }
    } catch {
      // fallback
    }
  }

  // Format date/time/venue string for natural sentence
  const eventDateStr = date ? ` on ${date}` : (emailDateFormatted ? ` on ${emailDateFormatted}` : '')
  const eventTimeStr = time && time !== 'TBA' ? ` at ${time}` : (emailTimeFormatted ? ` at ${emailTimeFormatted}` : '')
  const eventVenueStr = venue ? ` in ${venue}` : ''

  // 1. QUIZ / TEST / EXAM
  // e.g.: "Quiz for CS213 is scheduled on 15 Sept at 10:00 AM in LA 101."
  const isQuiz =
    fullText.includes('quiz') ||
    fullText.includes('midsem') ||
    fullText.includes('endsem') ||
    fullText.includes('midterm') ||
    fullText.includes('examination') ||
    attachedEvent?.event_type?.toUpperCase() === 'EXAM' ||
    attachedEvent?.event_type?.toUpperCase() === 'QUIZ'

  if (isQuiz) {
    const courseMatch = email.subject.match(/\b([A-Z]{2,4}\s*\d{3}[A-Z]?)\b/i)
    const courseName = courseMatch ? courseMatch[1].toUpperCase() : 'this course'
    const quizTitle = cleanSubject.toLowerCase().includes('quiz') ? cleanSubject : `Quiz for ${courseName}`

    return {
      id: email.id,
      lineNumber: index + 1,
      originSource: email.originSource,
      senderClean: sender,
      actionType: 'quiz',
      actionBadge: 'Quiz / Exam',
      briefingSentence: `${quizTitle} is scheduled${eventDateStr}${eventTimeStr}${eventVenueStr}.`,
      date,
      time,
      venue,
      rawEmail: email,
    }
  }

  // 2. ASSIGNMENT / DEADLINE DUE
  // e.g.: "You have Lab Assignment 3 due by 23:59 on 20 Sept."
  const isAssignmentOrDeadline =
    fullText.includes('assignment') ||
    fullText.includes('homework') ||
    fullText.includes('due by') ||
    fullText.includes('submission deadline') ||
    fullText.includes('project submission') ||
    attachedEvent?.event_type?.toUpperCase() === 'DEADLINE' ||
    email.category?.toUpperCase() === 'DEADLINE'

  if (isAssignmentOrDeadline) {
    const dueTime = time || (emailTimeFormatted ? emailTimeFormatted : '23:59 IST')
    const dueDate = date || emailDateFormatted
    return {
      id: email.id,
      lineNumber: index + 1,
      originSource: email.originSource,
      senderClean: sender,
      actionType: 'deadline',
      actionBadge: 'Assignment Due',
      briefingSentence: `You have ${cleanSubject} due by ${dueTime}${dueDate ? ` on ${dueDate}` : ''}.`,
      date: dueDate,
      time: dueTime,
      venue,
      rawEmail: email,
    }
  }

  // 3. APPLICATIONS / CLUB / TEAM RECRUITMENT
  // e.g.: "Applications open for Team Shunya — last date to apply: 25 Sept at 11:59 PM."
  const isApplication =
    fullText.includes('application') ||
    fullText.includes('applications open') ||
    fullText.includes('recruitment') ||
    fullText.includes('call for applications') ||
    fullText.includes('apply for') ||
    fullText.includes('team induction') ||
    fullText.includes('join our team') ||
    fullText.includes('club registrations')

  if (isApplication) {
    const targetEntity = sender.includes('from') ? sender.split('from')[1].trim() : sender
    const deadlineText = date || emailDateFormatted || 'specified date'

    return {
      id: email.id,
      lineNumber: index + 1,
      originSource: email.originSource,
      senderClean: sender,
      actionType: 'application',
      actionBadge: 'Applications Open',
      briefingSentence: `Applications open for ${targetEntity || cleanSubject} — last date to apply: ${deadlineText}${time ? ` at ${time}` : ''}${eventVenueStr}.`,
      date: deadlineText,
      time,
      venue,
      rawEmail: email,
    }
  }

  // 4. CAMPUS / IITB ORGANISED EVENT / WORKSHOP / TALK
  // e.g.: "IITB is organising E-Summit on 18 Oct at 09:30 AM in Convocation Hall."
  if (isEventLike) {
    const organizer = email.originSource === 'iitb' ? 'IITB' : sender
    const eventName = attachedEvent?.title || cleanSubject

    return {
      id: email.id,
      lineNumber: index + 1,
      originSource: email.originSource,
      senderClean: sender,
      actionType: 'event',
      actionBadge: 'Campus Event',
      briefingSentence: `${organizer} is organising ${eventName}${eventDateStr}${eventTimeStr}${eventVenueStr}.`,
      date,
      time,
      venue,
      rawEmail: email,
    }
  }

  // 5. GENERAL / SENDER MAILED REGARDING TOPIC
  // e.g.: "Jovin from Mobbin has mailed you regarding discovering why designers love Mobbin on 3 Sept at 05:36 pm."
  let topic = cleanSubject
  topic = topic.replace(/^Discover\b/i, 'discovering')
  topic = topic.replace(/^Explore\b/i, 'exploring')
  topic = topic.replace(/^Welcome to\b/i, 'getting started with')
  topic = topic.replace(/^You've enabled\b/i, 'enabling')

  const timeStampClause = emailDateFormatted
    ? ` on ${emailDateFormatted}${emailTimeFormatted ? ` at ${emailTimeFormatted}` : ''}`
    : ''

  return {
    id: email.id,
    lineNumber: index + 1,
    originSource: email.originSource,
    senderClean: sender,
    actionType: 'general',
    actionBadge: email.category || 'Email Notice',
    briefingSentence: `${sender} has mailed you regarding ${topic}${timeStampClause}.`,
    date: emailDateFormatted,
    time: emailTimeFormatted,
    venue,
    rawEmail: email,
  }
}
