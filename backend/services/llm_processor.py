import json
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from .gemini_provider import GeminiProvider

_provider = GeminiProvider()


def extract_links_heuristic(text: str) -> List[Dict[str, str]]:
    """Extract and categorize URLs from email text using regex heuristics."""
    if not text:
        return []

    # Regex for finding HTTP/HTTPS links
    url_pattern = r'https?://[^\s<>"\')]+'
    raw_urls = re.findall(url_pattern, text)
    
    seen = set()
    links = []
    
    for url in raw_urls:
        # Strip trailing punctuation
        clean_url = re.sub(r'[.,;:\)\!?]+$', '', url).strip()
        if not clean_url or clean_url in seen:
            continue
        seen.add(clean_url)
        
        parsed = urlparse(clean_url)
        domain = parsed.netloc.lower()
        path = parsed.path.lower()
        
        link_type = "other"
        title = domain
        
        if "zoom.us" in domain or "meet.google.com" in domain or "teams.microsoft" in domain:
            link_type = "meeting"
            title = "Join Meeting (" + ("Zoom" if "zoom" in domain else "Google Meet" if "google" in domain else "Teams") + ")"
        elif "forms.gle" in domain or "docs.google.com/forms" in (domain + path) or "typeform" in domain:
            link_type = "form"
            title = "Google Form / Survey"
        elif "moodle" in domain or "gradescope" in domain or "devfolio" in domain:
            link_type = "submission"
            title = "Submission Portal (" + ("Moodle" if "moodle" in domain else "Devfolio" if "devfolio" in domain else "Gradescope") + ")"
        elif "drive.google.com" in domain or "dropbox" in domain or clean_url.endswith(".pdf"):
            link_type = "doc"
            title = "Document / PDF Resource"
        elif "github.com" in domain or "gitlab.com" in domain:
            link_type = "submission"
            title = "Repository / Classroom"
        elif "iitb.ac.in" in domain:
            link_type = "portal"
            title = "IITB Campus Portal"
        else:
            title = domain.replace("www.", "")

        links.append({
            "title": title,
            "url": clean_url,
            "type": link_type,
        })
        
        if len(links) >= 5:
            break

    return links


def extract_action_items_heuristic(text: str, subject: str) -> List[Dict[str, Any]]:
    """Heuristically extract action items and deadlines from email content."""
    action_items = []
    combined = (subject + "\n" + (text or "")).strip()
    if not combined:
        return []

    lines = combined.split("\n")
    action_cues = [
        ("submit", "HIGH"),
        ("deadline", "HIGH"),
        ("due date", "HIGH"),
        ("register before", "HIGH"),
        ("apply by", "HIGH"),
        ("interview", "HIGH"),
        ("fill the form", "MEDIUM"),
        ("mandatory", "MEDIUM"),
        ("rsvp", "MEDIUM"),
        ("review", "LOW"),
        ("prepare for", "MEDIUM"),
        ("quiz due", "HIGH"),
    ]

    seen_tasks = set()
    
    for line in lines:
        cleaned_line = line.strip().strip("-*•> ")
        if len(cleaned_line) < 12 or len(cleaned_line) > 160:
            continue
            
        lower = cleaned_line.lower()
        for cue, urgency in action_cues:
            if cue in lower:
                # Deduplicate similar cues
                normalized = re.sub(r'[^a-zA-Z0-9]', '', cleaned_line.lower()[:40])
                if normalized not in seen_tasks:
                    seen_tasks.add(normalized)
                    
                    # Try to extract date pattern if present
                    date_match = re.search(r'\b(?:before|by|on|due)\s+([A-Za-z0-9, /-]+)', cleaned_line, re.IGNORECASE)
                    deadline_str = date_match.group(1).strip() if date_match else None
                    
                    action_items.append({
                        "task": cleaned_line,
                        "deadline": deadline_str,
                        "urgency": urgency,
                        "completed": False,
                    })
                    break
        if len(action_items) >= 4:
            break

    return action_items


def batch_emails(emails, batch_size=20):
    for i in range(0, len(emails), batch_size):
        yield emails[i:i + batch_size]


def build_batch_prompt(email_batch):
    prompt = """You are an AI email assistant for an IIT Bombay student.
Analyze every email and return ONLY a valid JSON array.

For each email return:
- id: integer
- category: academic | administrative | placement | event | deadline | spam_promotional | personal | other
- importance: high | medium | low
- summary: concise 1-2 sentence overview
- structured_summary: 2-3 clean bullet points highlighting key details, requirements, and takeaways
- links: list of objects with { "title": "string", "url": "string", "type": "submission | meeting | form | doc | portal | other" }
- action_items: list of objects with { "task": "string describing what the student must do", "deadline": "YYYY-MM-DD or readable date string or null", "urgency": "HIGH | MEDIUM | LOW" }
- events: list of calendar event objects

Events Schema:
- title: string
- event_type: deadline | workshop | talk | exam | meeting | interview | other
- date: YYYY-MM-DD or null
- time: HH:MM or null
- end_date: YYYY-MM-DD or null
- end_time: HH:MM or null
- location: string or null
- confidence: high | low

Return JSON in this format:
[
  {
    "id": 0,
    "category": "academic",
    "importance": "high",
    "summary": "Assignment 3 on Binary Search Trees has been released.",
    "structured_summary": "• Covers BST, AVL, and Red-Black tree implementations.\n• Groups of up to 2 students are permitted.\n• Late submissions incur a 10% penalty per day.",
    "links": [
      { "title": "Moodle Submission", "url": "https://moodle.iitb.ac.in/mod/assign/view.php?id=123", "type": "submission" }
    ],
    "action_items": [
      { "task": "Submit Assignment 3 on Moodle", "deadline": "2026-08-25", "urgency": "HIGH" }
    ],
    "events": [
      {
        "title": "CS215 Assignment 3 Submission",
        "event_type": "deadline",
        "date": "2026-08-25",
        "time": "23:59",
        "end_date": null,
        "end_time": null,
        "location": "Moodle Portal",
        "confidence": "high"
      }
    ]
  }
]

Return ONLY JSON. Do not use markdown backticks. Do not explain anything.

EMAILS:
"""
    for idx, email in enumerate(email_batch):
        prompt += f"""
------------------------
ID: {idx}
Subject: {email.get("subject", "")}
From: {email.get("sender", "")}
Date: {email.get("date", "")}
Body:
{email.get("body", "")}
"""
    return prompt


def try_fix_json(raw_text):
    """Attempt a cheap fix for the common 'array closed with } instead of ]' case."""
    stripped = raw_text.strip()
    if stripped.startswith("[") and stripped.endswith("}"):
        fixed = stripped[:-1] + "]"
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            return None
    return None


def clean_email_subject(subject: str) -> str:
    """Strip repetitive noisy email tag prefixes like [Student-notices], Re:, Fwd:, etc."""
    if not subject:
        return "Untitled Email"
    cleaned = subject.strip()
    prefix_pattern = r'^(?:\[(?:Student-notices|S\.Events|Placement|Academics|Notices|Event|Alert|Events|Admin)\]|\s*(?:Re|Fwd|FW|Fw)\s*:\s*)+\s*'
    while re.search(prefix_pattern, cleaned, re.IGNORECASE):
        cleaned = re.sub(prefix_pattern, '', cleaned, flags=re.IGNORECASE).strip()
    return cleaned if cleaned else subject.strip()


def extract_smart_summary(body: str, subject: str) -> str:
    """Extract a concise 1-2 sentence overview from body that does not duplicate subject."""
    clean_subj = clean_email_subject(subject)
    if not body:
        return clean_subj
    
    # Strip common email greeting / signature lines
    lines = body.replace("\r", "").split("\n")
    substantive_sentences = []
    
    greeting_patterns = [
        r'^(?:dear|hello|hi|greetings|respected|attn|to all)\b',
        r'^(?:with warm regards|thanks & regards|regards|sincerely|cheers|best wishes|yours sincerely)\b',
        r'^(?:sent from my|disclaimer|this email was sent to|unsubscribe)\b',
    ]
    
    for line in lines:
        l = line.strip()
        if not l or len(l) < 15:
            continue
        if any(re.search(p, l, re.IGNORECASE) for p in greeting_patterns):
            continue
        for sentence in re.split(r'(?<=[.!?])\s+', l):
            s = sentence.strip()
            if len(s) >= 20 and not any(re.search(p, s, re.IGNORECASE) for p in greeting_patterns):
                if s.lower() == subject.strip().lower() or s.lower() == clean_subj.lower():
                    continue
                substantive_sentences.append(s)
                if len(substantive_sentences) >= 2:
                    break
        if len(substantive_sentences) >= 2:
            break
            
    if substantive_sentences:
        summary_text = " ".join(substantive_sentences)
        if len(summary_text) > 160:
            summary_text = summary_text[:157] + "..."
        return summary_text
    
    return clean_subj


def build_structured_summary_heuristic(body: str, subject: str, sender: str = "", category: str = "other") -> str:
    """Build 2-3 genuine, distinct bullet points without placeholder lines or repeating subjects."""
    clean_subj = clean_email_subject(subject)
    bullets = []
    
    # 1. Main Focus / Context
    bullets.append(f"• Announcement: {clean_subj}")
    
    # Extract details / action from body
    lines = (body or "").replace("\r", "").split("\n")
    detail_candidates = []
    for line in lines:
        l = line.strip().strip("-*•> ")
        if len(l) < 20 or len(l) > 180:
            continue
        lower = l.lower()
        if any(w in lower for w in ["meeting", "zoom", "deadline", "scheduled", "submit", "apply", "session", "venue", "eligibility", "portal", "link", "register"]):
            if l.lower() != subject.lower() and l.lower() != clean_subj.lower():
                detail_candidates.append(l)
        if len(detail_candidates) >= 2:
            break
            
    if detail_candidates:
        for d in detail_candidates:
            bullets.append(f"• {d}")
    else:
        summary = extract_smart_summary(body, subject)
        if summary and summary.lower() != clean_subj.lower():
            bullets.append(f"• Details: {summary}")
        if sender and sender != "Unknown":
            sender_clean = sender.split("<")[0].strip().strip('"')
            bullets.append(f"• Issued by: {sender_clean}")
            
    # Deduplicate bullets
    seen = set()
    final_bullets = []
    for b in bullets:
        norm = re.sub(r'[^a-zA-Z0-9]', '', b.lower())
        if norm not in seen:
            seen.add(norm)
            final_bullets.append(b)
            
    return "\n".join(final_bullets)


def process_emails(cleaned_emails, batch_size=20, delay_between_batches=2, user_llm=None):
    """
    Returns processed emails with category, summary, structured summary, links, action items, and events.
    Uses user_llm if provided. If not provided, falls back to zero-cost smart heuristic extraction.
    """
    all_results = []

    if not cleaned_emails:
        return all_results

    # If user has not provided their LLM key, do zero-cost smart heuristic extraction
    if user_llm is None:
        print("[BYOK NOTICE] No user AI key configured for email processing. Using zero-token smart heuristic extraction.")
        for e in cleaned_emails:
            body = e.get("body_plain") or e.get("body_html") or e.get("body") or ""
            raw_subject = e.get("subject", "")
            clean_subj = clean_email_subject(raw_subject)
            sender = e.get("sender", "")
            
            # Smart extractions
            links = extract_links_heuristic(body)
            action_items = extract_action_items_heuristic(body, raw_subject)
            smart_summary = extract_smart_summary(body, raw_subject)
            
            is_deadline = bool(re.search(r'\b(deadline|due date|submission|submit by|exam|quiz)\b', (raw_subject + " " + body).lower()))
            is_placement = bool(re.search(r'\b(interview|shortlist|internship|job offer|placement|recruitment)\b', (raw_subject + " " + body).lower()))
            is_event = bool(re.search(r'\b(workshop|talk|webinar|seminar|session|hackathon|meet)\b', (raw_subject + " " + body).lower()))
            
            cat = "deadline" if is_deadline else "placement" if is_placement else "event" if is_event else "academic" if "course" in (raw_subject + body).lower() else "other"
            imp = "high" if (is_deadline or is_placement) else "medium"
            structured_summary = build_structured_summary_heuristic(body, raw_subject, sender, cat)

            all_results.append({
                "message_id": e.get("message_id", ""),
                "subject": raw_subject,
                "clean_subject": clean_subj,
                "sender": sender,
                "date": e.get("date", ""),
                "category": cat,
                "importance": imp,
                "summary": smart_summary,
                "structured_summary": structured_summary,
                "links": links,
                "action_items": action_items,
                "events": [],
            })
        return all_results

    batches = list(batch_emails(cleaned_emails, batch_size))

    print(f"\nProcessing {len(cleaned_emails)} emails with user's {getattr(user_llm, 'model', 'LLM')}...")
    print(f"Created {len(batches)} batches of size {batch_size}.\n")

    for batch_number, batch in enumerate(batches, start=1):
        print(f"[Batch {batch_number}/{len(batches)}] Processing {len(batch)} emails...")
        prompt = build_batch_prompt(batch)
        try:
            raw_response = user_llm.generate(prompt, response_json=True)
        except Exception as err:
            print(f"[LLM Error on batch {batch_number}]: {err}")
            raw_response = None

        parsed_results = parse_llm_response(raw_response, batch)
        all_results.extend(parsed_results)
        print(f"✓ Parsed {len(parsed_results)} emails.\n")

        if batch_number != len(batches):
            time.sleep(delay_between_batches)

    print("=" * 80)
    print(f"Finished processing {len(all_results)} emails.")
    print("=" * 80)

    return all_results


def parse_llm_response(raw_text, email_batch):
    if raw_text is None:
        return []

    try:
        results = json.loads(raw_text)
    except json.JSONDecodeError as e:
        print("[PARSE ERROR]", e)
        results = try_fix_json(raw_text)
        if results is None:
            print("[PARSE ERROR] Could not recover malformed JSON.")
            return []
        print("[RECOVERED] Fixed malformed JSON structure.")

    if not isinstance(results, list):
        print("[PARSE ERROR] Expected a JSON array.")
        return []

    processed = []
    for r in results:
        if not isinstance(r, dict) or "id" not in r:
            continue

        idx = r["id"]
        if not isinstance(idx, int) or idx < 0 or idx >= len(email_batch):
            continue

        original = email_batch[idx]
        body = original.get("body_plain") or original.get("body_html") or original.get("body") or ""

        # Fallback to heuristic links/actions if LLM returned empty
        llm_links = r.get("links") or []
        if not llm_links:
            llm_links = extract_links_heuristic(body)

        llm_actions = r.get("action_items") or []
        if not llm_actions:
            llm_actions = extract_action_items_heuristic(body, original.get("subject", ""))

        processed.append({
            "message_id": original.get("message_id", ""),
            "subject": original.get("subject", ""),
            "sender": original.get("sender", ""),
            "date": original.get("date", ""),
            "category": r.get("category", "other"),
            "importance": r.get("importance", "medium"),
            "summary": r.get("summary", ""),
            "structured_summary": r.get("structured_summary", ""),
            "links": llm_links,
            "action_items": llm_actions,
            "events": r.get("events", []),
        })

    return processed
