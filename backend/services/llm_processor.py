import json
import time

from .gemini_provider import GeminiProvider
_provider = GeminiProvider()

def batch_emails(emails, batch_size=20):

    for i in range(0, len(emails), batch_size):
        yield emails[i:i + batch_size]
def build_batch_prompt(email_batch):
    prompt = """You are an AI email assistant for an IIT Bombay student.
Analyze every email and return ONLY a valid JSON array.

For each email return:
- id
- category
- importance
- summary
- events

Categories:
academic, administrative, placement, event, deadline, spam_promotional, personal, other

Importance:
high, medium, low

Date resolution rules:
- Each email includes its own Date header (shown as "Date:" below). Use this as the reference point ("today") when resolving relative date language such as "tomorrow", "next Monday", or "this Friday" — do NOT use the actual current real-world date.
- If a date/time cannot be confidently resolved even using the email's Date header, set it to null rather than guessing.

Event extraction rules:
- If an email describes multiple distinct sessions/batches/workshops with different dates or times (e.g. "Batch I: Tuesday... Batch II: Wednesday..."), create a SEPARATE event object for each — do not merge or pick only one.
- If an email describes a date range (e.g. a registration window), use start date/time plus end_date/end_time rather than forcing it into a single point.
- If an email has no concrete events, return an empty events array.
- Do not invent dates, times, or locations that are not stated or clearly implied in the email.

Events are any date/time-bound occurrence a student would want on a calendar, including:
- Workshops, seminars, talks, and info sessions
- Deadlines (assignment, registration, application)
- Fee payment due dates
- Registration or nomination windows (with open/close dates)
- Exams, vivas, and academic evaluations
- Competitions and contests (including submission deadlines)
- Placement-related sessions (interviews, tests, company visits)
- Club, cultural, or sports events

If an email mentions no specific date or time-bound occurrence, return an empty events array — do not force an event out of a purely informational email.

Confidence rule:
- Set confidence to "high" only when the date/time is stated explicitly and unambiguously.
- Set confidence to "low" if the date/time was inferred indirectly or is ambiguous.

General rules:
- Return exactly one JSON object for every email, in the same order as given.
- Preserve the same id that was provided.

Return JSON in this format:
[
  {
    "id": 0,
    "category": "...",
    "importance": "...",
    "summary": "...",
    "events": [
      {
        "title": "...",
        "event_type": "deadline | workshop | talk | exam | meeting | other",
        "date": "YYYY-MM-DD or null",
        "time": "HH:MM or null",
        "end_date": "YYYY-MM-DD or null",
        "end_time": "HH:MM or null",
        "location": "string or null",
        "confidence": "high | low"
      }
    ]
  }
]

Return ONLY JSON. Do not use markdown. Do not explain anything.

EMAILS:
"""
    for idx, email in enumerate(email_batch):
        prompt += f"""
------------------------
ID: {idx}
Subject: {email["subject"]}
From: {email["sender"]}
Date: {email["date"]}
Body:
{email["body"]}
"""
    return prompt

def try_fix_json(raw_text):
    """Attempt a cheap fix for the common 'array closed with } instead of ]' case."""
    stripped = raw_text.strip()
    if stripped.startswith("[") and stripped.endswith("}"):
        fixed = stripped[:-1] + "]"  # replace trailing } with ]
        try:
            return json.loads(fixed)
        except json.JSONDecodeError:
            return None
    return None

def process_emails(cleaned_emails, batch_size=20, delay_between_batches=2, user_llm=None):
    """
    Returns: list: Processed emails with category, summary and extracted events.
    Uses user_llm if provided. If not provided, falls back to basic metadata extraction (0 token cost).
    """
    all_results = []

    if not cleaned_emails:
        return all_results

    # If user has not provided their LLM key, do zero-cost basic extraction
    if user_llm is None:
        print("[BYOK NOTICE] No user AI key configured for email processing. Using zero-token basic extraction.")
        for e in cleaned_emails:
            body = e.get("body_plain") or e.get("body_html") or ""
            snippet = body[:160].replace("\n", " ").strip()
            all_results.append({
                "message_id": e.get("message_id", ""),
                "subject": e.get("subject", ""),
                "sender": e.get("sender", ""),
                "date": e.get("date", ""),
                "category": "academic" if "course" in (e.get("subject", "") + body).lower() else "other",
                "importance": "high" if "deadline" in (e.get("subject", "") + body).lower() else "medium",
                "summary": snippet if snippet else e.get("subject", "No summary"),
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

        parsed_results = parse_llm_response(
            raw_response,
            batch
        )

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
        results = try_fix_json(raw_text)  # Keep the recovery logic!
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
        
        # Use safe .get() calls to protect against unexpected missing keys
        processed.append({
            "message_id": original.get("message_id", ""),
            "subject": original.get("subject", ""),
            "sender": original.get("sender", ""),
            "date": original.get("date", ""),
            "category": r.get("category", "other"),
            "importance": r.get("importance", "medium"),
            "summary": r.get("summary", ""),
            "events": r.get("events", []),
        })
        
    return processed

