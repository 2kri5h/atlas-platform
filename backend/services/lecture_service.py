"""Lecture audio transcription and structured note generation.

Pipeline: uploaded/recoded lecture audio → provider Whisper-compatible
transcription endpoint → LLM structured summary (overview, key topics,
definitions, action items, likely exam topics) → saved as a private
Resource so it flows into the existing resource library.

Transcription uses the OpenAI-compatible ``/audio/transcriptions`` API.
Providers without an official Whisper endpoint can still work when the
user supplies a custom base_url that implements the same contract; Gemini
users get a native fallback that sends the audio inline to the LLM.

All user-facing failures raise :class:`LectureServiceError` with safe
messages — raw provider errors are logged server-side only, matching the
conventions in llm_router.py.
"""

import base64
import json
import logging
import os
import tempfile
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

# Hard caps keep request sizes and costs sane. 25MB matches the OpenAI
# transcription upload limit; ~3h of audio at typical lecture bitrates.
MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_TRANSCRIPT_CHARS = 60_000

SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac", ".aac", ".opus",
}

TRANSCRIPTION_TIMEOUT_SECONDS = 300  # long lectures transcribe slowly
SUMMARY_TIMEOUT_SECONDS = 120


class LectureServiceError(RuntimeError):
    """Safe, user-facing error for the lecture pipeline."""


@dataclass
class LectureNotes:
    title: str
    overview: str
    key_topics: List[str] = field(default_factory=list)
    definitions: List[Dict[str, str]] = field(default_factory=list)
    action_items: List[str] = field(default_factory=list)
    exam_topics: List[str] = field(default_factory=list)

    def to_markdown(self) -> str:
        """Render as markdown suitable for storage/display in the library."""
        parts = [f"# {self.title}", "", "## Overview", self.overview or "_None_", ""]
        if self.key_topics:
            parts += ["## Key Topics"] + [f"- {t}" for t in self.key_topics] + [""]
        if self.definitions:
            parts.append("## Definitions")
            parts += [f"- **{d.get('term', '?')}**: {d.get('meaning', '')}" for d in self.definitions]
            parts.append("")
        if self.action_items:
            parts += ["## Action Items"] + [f"- [ ] {a}" for a in self.action_items] + [""]
        if self.exam_topics:
            parts += ["## Likely Exam Topics"] + [f"- {t}" for t in self.exam_topics] + [""]
        return "\n".join(parts)


def validate_audio_upload(filename: str, size_bytes: int) -> None:
    """Reject unsupported or oversized uploads early with clear messages."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in SUPPORTED_AUDIO_EXTENSIONS:
        supported = ", ".join(sorted(SUPPORTED_AUDIO_EXTENSIONS))
        raise LectureServiceError(f"Unsupported audio format '{ext or 'unknown'}'. Supported: {supported}")
    if size_bytes > MAX_AUDIO_BYTES:
        raise LectureServiceError("Audio file too large (max 25MB). Trim or compress the recording.")
    if size_bytes == 0:
        raise LectureServiceError("Audio file is empty.")


# ─────────────────────────────────────────────────────────────────────────────
# Transcription
# ─────────────────────────────────────────────────────────────────────────────

def _transcribe_openai_compatible(
    api_key: str,
    base_url: str,
    model: str,
    audio_bytes: bytes,
    filename: str,
) -> str:
    """POST multipart audio to an OpenAI-compatible /audio/transcriptions route."""
    url = f"{base_url.rstrip('/')}/audio/transcriptions"
    try:
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, os.path.basename(filename) or "lecture.audio")
            with open(path, "wb") as f:
                f.write(audio_bytes)
            with open(path, "rb") as f:
                res = requests.post(
                    url,
                    headers={"Authorization": f"Bearer {api_key}"},
                    files={"file": (os.path.basename(path), f)},
                    data={"model": model},
                    timeout=TRANSCRIPTION_TIMEOUT_SECONDS,
                )
    except requests.RequestException as e:
        logger.error("[Lecture] Transcription request failed: %s", e)
        raise LectureServiceError("Transcription service unreachable. Check your connection and key.")
    if res.status_code != 200:
        logger.error("[Lecture] Transcription error %s: %s", res.status_code, res.text[:500])
        raise LectureServiceError(f"Transcription failed (provider returned {res.status_code}).")
    try:
        return str(res.json().get("text", "")).strip()
    except ValueError:
        # Some compatible servers return plain text.
        return res.text.strip()


def _transcribe_gemini_inline(
    api_key: str,
    model: str,
    audio_bytes: bytes,
    mime_type: str,
) -> str:
    """Gemini fallback: send audio inline and ask the model to transcribe."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "contents": [{
            "parts": [
                {"text": "Transcribe this lecture recording. Output ONLY the verbatim transcript text."},
                {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(audio_bytes).decode()}},
            ],
        }],
    }
    try:
        res = requests.post(url, json=payload, headers={"Content-Type": "application/json"},
                            timeout=TRANSCRIPTION_TIMEOUT_SECONDS)
    except requests.RequestException as e:
        logger.error("[Lecture] Gemini transcription failed: %s", e)
        raise LectureServiceError("Transcription service unreachable. Check your connection and key.")
    if res.status_code != 200:
        logger.error("[Lecture] Gemini transcription error %s: %s", res.status_code, res.text[:500])
        raise LectureServiceError(f"Transcription failed (provider returned {res.status_code}).")
    try:
        parts = res.json()["candidates"][0]["content"]["parts"]
        return " ".join(str(p.get("text", "")) for p in parts).strip()
    except (KeyError, IndexError, ValueError):
        raise LectureServiceError("Transcription returned an unexpected response.")


_GEMINI_MIME = {
    ".mp3": "audio/mp3", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".ogg": "audio/ogg", ".webm": "audio/webm", ".flac": "audio/flac",
    ".aac": "audio/aac", ".opus": "audio/opus",
}


def transcribe_audio(
    audio_bytes: bytes,
    filename: str,
    llm_adapter,
) -> str:
    """Transcribe lecture audio using the student's configured provider."""
    if llm_adapter is None:
        raise LectureServiceError(
            "Connect an AI key first (Profile → API Key Vault) to use lecture transcription."
        )
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise LectureServiceError("Audio file too large (max 25MB).")

    provider_base = (getattr(llm_adapter, "base_url", "") or "").rstrip("/")
    is_gemini = (
        type(llm_adapter).__name__ == "GeminiAdapter"
        or "generativelanguage.googleapis.com" in provider_base
    )

    if is_gemini:
        ext = os.path.splitext(filename)[1].lower()
        mime = _GEMINI_MIME.get(ext, "audio/mpeg")
        return _transcribe_gemini_inline(llm_adapter.api_key, llm_adapter.model, audio_bytes, mime)

    # Everything else speaks the OpenAI-compatible transcription contract.
    base_url = provider_base or "https://api.openai.com/v1"
    transcript_model = "whisper-1"
    return _transcribe_openai_compatible(
        llm_adapter.api_key, base_url, transcript_model, audio_bytes, filename
    )


# ─────────────────────────────────────────────────────────────────────────────
# Structured notes from a transcript
# ─────────────────────────────────────────────────────────────────────────────

_SUMMARY_SYSTEM_PROMPT = (
    "You convert lecture transcripts into structured study notes for IIT Bombay students. "
    "Respond with ONLY valid JSON matching this schema: "
    '{"title": string (short lecture title), "overview": string (2-4 sentences), '
    '"key_topics": string[], "definitions": [{"term": string, "meaning": string}], '
    '"action_items": string[], "exam_topics": string[]}. '
    "Omit sections that genuinely have no content rather than inventing material."
)


def parse_notes_json(raw: str) -> LectureNotes:
    """Parse the LLM's JSON into LectureNotes, tolerating code fences."""
    text = (raw or "").strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0]
    try:
        data = json.loads(text.strip())
    except ValueError:
        raise LectureServiceError("Could not structure the lecture notes. Try again.")

    definitions = [
        {"term": str(d.get("term", ""))[:200], "meaning": str(d.get("meaning", ""))[:1000]}
        for d in data.get("definitions", []) if isinstance(d, dict)
    ]
    return LectureNotes(
        title=str(data.get("title") or "Untitled Lecture")[:200],
        overview=str(data.get("overview") or "")[:4000],
        key_topics=[str(t)[:200] for t in data.get("key_topics", [])][:30],
        definitions=definitions[:40],
        action_items=[str(a)[:300] for a in data.get("action_items", [])][:20],
        exam_topics=[str(t)[:200] for t in data.get("exam_topics", [])][:20],
    )


def summarize_transcript(transcript: str, llm_adapter) -> LectureNotes:
    """Turn a raw transcript into structured notes via the student's LLM."""
    if llm_adapter is None:
        raise LectureServiceError(
            "Connect an AI key first (Profile → API Key Vault) to generate lecture notes."
        )
    trimmed = transcript[:MAX_TRANSCRIPT_CHARS]
    try:
        raw = llm_adapter.generate(
            f"Lecture transcript:\n\n{trimmed}",
            system_prompt=_SUMMARY_SYSTEM_PROMPT,
            response_json=True,
        )
    except Exception as e:
        logger.error("[Lecture] Summary generation failed: %s", e)
        raise LectureServiceError("Note generation failed. Check your AI key and try again.")
    return parse_notes_json(raw)


def process_lecture_audio(audio_bytes: bytes, filename: str, llm_adapter) -> tuple:
    """Full pipeline: audio → (transcript, LectureNotes)."""
    validate_audio_upload(filename, len(audio_bytes))
    transcript = transcribe_audio(audio_bytes, filename, llm_adapter)
    if not transcript:
        raise LectureServiceError("Transcription came back empty — the recording may be silent or corrupted.")
    notes = summarize_transcript(transcript, llm_adapter)
    return transcript, notes
