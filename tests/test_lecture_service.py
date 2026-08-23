"""Tests for the lecture transcription/notes service.

All provider calls are mocked — no network access. Run: pytest tests/ -q
"""

import json

import pytest

from backend.services.lecture_service import (
    MAX_AUDIO_BYTES,
    LectureNotes,
    LectureServiceError,
    parse_notes_json,
    summarize_transcript,
    transcribe_audio,
    validate_audio_upload,
)


class FakeAdapter:
    """Stands in for a BaseLLMAdapter without touching the network."""

    def __init__(self, base_url="https://api.example.com/v1"):
        self.api_key = "test-key"
        self.model = "test-model"
        self.base_url = base_url


class TestValidateAudioUpload:
    def test_rejects_unsupported_extension(self):
        with pytest.raises(LectureServiceError, match="Unsupported audio format"):
            validate_audio_upload("lecture.txt", 100)

    def test_rejects_empty_file(self):
        with pytest.raises(LectureServiceError, match="empty"):
            validate_audio_upload("lecture.mp3", 0)

    def test_rejects_oversized_file(self):
        with pytest.raises(LectureServiceError, match="too large"):
            validate_audio_upload("lecture.mp3", MAX_AUDIO_BYTES + 1)

    def test_accepts_supported_format(self):
        validate_audio_upload("lecture.m4a", 1024)  # no raise


class TestParseNotesJson:
    def test_parses_full_structure(self):
        raw = json.dumps({
            "title": "Fourier Transforms",
            "overview": "We covered the basics.",
            "key_topics": ["FT", "DFT"],
            "definitions": [{"term": "FT", "meaning": "A transform."}],
            "action_items": ["Read chapter 4"],
            "exam_topics": ["Convolution"],
        })
        notes = parse_notes_json(raw)
        assert isinstance(notes, LectureNotes)
        assert notes.title == "Fourier Transforms"
        assert notes.definitions[0]["term"] == "FT"

    def test_tolerates_code_fences(self):
        raw = f"```json\n{json.dumps({'title': 'T', 'overview': 'O'})}\n```"
        assert parse_notes_json(raw).title == "T"

    def test_invalid_json_raises_safe_error(self):
        with pytest.raises(LectureServiceError, match="Could not structure"):
            parse_notes_json("not json at all")

    def test_missing_sections_default_empty(self):
        notes = parse_notes_json(json.dumps({"title": "Only Title"}))
        assert notes.key_topics == [] and notes.definitions == []


class FakeLLM:
    """Adapter double for the LLM summarize step."""

    def __init__(self, response="{}"):
        self._response = response
        self.calls = []

    def generate(self, prompt, system_prompt=None, response_json=False):
        self.calls.append({"prompt": prompt, "system": system_prompt})
        return self._response


class TestSummarizeTranscript:
    def _valid_json(self):
        return json.dumps({
            "title": "Lecture 5",
            "overview": "Overview text.",
            "key_topics": ["Topic A"],
            "definitions": [],
            "action_items": ["Do problem set"],
            "exam_topics": [],
        })

    def test_success(self):
        llm = FakeLLM(self._valid_json())
        notes = summarize_transcript("Some transcript text.", llm)
        assert notes.title == "Lecture 5"
        assert len(llm.calls) == 1
        # Transcript is passed to the model
        assert "Some transcript text." in llm.calls[0]["prompt"]

    def test_requires_adapter(self):
        with pytest.raises(LectureServiceError, match="Connect an AI key"):
            summarize_transcript("text", None)

    def test_provider_failure_is_safe_error(self):
        class BoomLLM(FakeLLM):
            def generate(self, **kwargs):
                raise RuntimeError("api exploded")

        with pytest.raises(LectureServiceError, match="failed"):
            summarize_transcript("text", BoomLLM())


class TestTranscribeAudioRouting:
    def test_requires_adapter(self):
        with pytest.raises(LectureServiceError, match="Connect an AI key"):
            transcribe_audio(b"audio-bytes", "lecture.mp3", None)

    def test_gemini_routes_to_inline_path(self, monkeypatch):
        def fake_inline(api_key, model, audio_bytes, mime):
            return "hello"

        import backend.services.lecture_service as ls
        monkeypatch.setattr(ls, "_transcribe_gemini_inline", fake_inline)

        # Name must match the routing check (same as the real adapter class).
        class GeminiAdapter:
            api_key = "g-key"
            model = "gemini-2.5-flash"
            base_url = ""

        out = transcribe_audio(b"bytes", "lecture.mp3", GeminiAdapter())
        assert out == "hello"

    def test_openai_compatible_uses_whisper_endpoint(self, monkeypatch):
        captured = {}

        def fake_openai(api_key, base_url, model, audio_bytes, filename):
            captured.update(base_url=base_url, model=model)
            return "transcribed text"

        import backend.services.lecture_service as ls
        monkeypatch.setattr(ls, "_transcribe_openai_compatible", fake_openai)
        out = transcribe_audio(b"bytes", "lecture.m4a", FakeAdapter())
        assert out == "transcribed text"
        assert captured["model"] == "whisper-1"
        assert captured["base_url"] == "https://api.example.com/v1"
