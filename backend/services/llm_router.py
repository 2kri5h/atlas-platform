import json
import logging
import re
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Tuple
import requests
from sqlalchemy.orm import Session

from .crypto import decrypt_secret
from ..models import UserAPIKey, Student, Resource, AIMessage

logger = logging.getLogger(__name__)


class LLMServiceError(RuntimeError):
    """Safe, user-facing error when calling an LLM provider."""
    pass


class NoUserKeyConfiguredError(LLMServiceError):
    """Raised when an operation strictly requires a user-provided API key."""
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Base Adapter
# ─────────────────────────────────────────────────────────────────────────────

class BaseLLMAdapter(ABC):
    def __init__(self, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None):
        self.api_key = api_key.strip() if api_key else ""
        self.model = model.strip() if model else self.default_model()
        self.base_url = base_url.strip() if base_url else self.default_base_url()

    def default_base_url(self) -> str:
        return ""

    @abstractmethod
    def default_model(self) -> str:
        pass

    @abstractmethod
    def generate(self, prompt: str, system_prompt: Optional[str] = None, response_json: bool = False) -> str:
        pass

    @abstractmethod
    def validate_key(self) -> Tuple[bool, Optional[str]]:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Google Gemini Adapter (Supports Gemini 2.5 Pro/Flash, 2.0, 1.5)
# ─────────────────────────────────────────────────────────────────────────────

class GeminiAdapter(BaseLLMAdapter):
    def default_model(self) -> str:
        return "gemini-2.5-flash"


    def default_base_url(self) -> str:
        return "https://generativelanguage.googleapis.com"

    def validate_key(self) -> Tuple[bool, Optional[str]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": "Ping"}]}],
            "generationConfig": {"maxOutputTokens": 5}
        }
        try:
            res = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=15)
            if res.status_code == 200:
                return True, None
            elif res.status_code in (400, 401, 403):
                data = res.json()
                msg = data.get("error", {}).get("message", "Invalid Gemini API key")
                return False, msg
            else:
                return False, f"Gemini API returned status {res.status_code}: {res.text}"
        except Exception as e:
            return False, f"Connection to Gemini failed: {str(e)}"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, response_json: bool = False) -> str:
        # Try official google.genai SDK first
        try:
            from google import genai
            client = genai.Client(api_key=self.api_key)
            config = {}
            if response_json:
                config["response_mime_type"] = "application/json"
            if system_prompt:
                config["system_instruction"] = system_prompt

            response = client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=config if config else None,
            )
            if response and response.text:
                return response.text
        except Exception as e:
            logger.warning(f"google.genai SDK failed, falling back to REST: {e}")

        # Direct REST API fallback
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        parts = []
        if system_prompt:
            parts.append({"text": f"System Instructions: {system_prompt}\n\n"})
        parts.append({"text": prompt})

        gen_config = {}
        if response_json:
            gen_config["responseMimeType"] = "application/json"

        payload = {
            "contents": [{"parts": parts}],
            "generationConfig": gen_config
        }
        headers = {"Content-Type": "application/json"}
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=60)
            if res.status_code == 200:
                data = res.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            else:
                raise LLMServiceError(f"Gemini generation error ({res.status_code}): {res.text}")
        except Exception as e:
            raise LLMServiceError(f"Gemini generation failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Anthropic Claude Adapter (Supports Claude 3.7 Sonnet, 3.5 Sonnet, 3.5 Haiku)
# ─────────────────────────────────────────────────────────────────────────────

class AnthropicAdapter(BaseLLMAdapter):
    def default_model(self) -> str:
        return "claude-3-7-sonnet-20250219"

    def default_base_url(self) -> str:
        return "https://api.anthropic.com/v1"

    def validate_key(self) -> Tuple[bool, Optional[str]]:
        url = f"{self.base_url.rstrip('/')}/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": self.model,
            "max_tokens": 5,
            "messages": [{"role": "user", "content": "Ping"}]
        }
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code == 200:
                return True, None
            else:
                data = res.json()
                msg = data.get("error", {}).get("message", f"Anthropic error: {res.text}")
                return False, msg
        except Exception as e:
            return False, f"Connection to Anthropic failed: {str(e)}"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, response_json: bool = False) -> str:
        url = f"{self.base_url.rstrip('/')}/messages"
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        user_prompt = prompt
        if response_json:
            user_prompt += "\n\nCRITICAL: Return ONLY valid JSON format without markdown code fences."

        payload = {
            "model": self.model,
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": user_prompt}]
        }
        if system_prompt:
            payload["system"] = system_prompt

        try:
            res = requests.post(url, json=payload, headers=headers, timeout=60)
            if res.status_code == 200:
                data = res.json()
                return data["content"][0]["text"]
            else:
                data = res.json()
                msg = data.get("error", {}).get("message", res.text)
                raise LLMServiceError(f"Anthropic error ({res.status_code}): {msg}")
        except Exception as e:
            raise LLMServiceError(f"Anthropic call failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Universal OpenAI-Compatible Adapter
# (Supports OpenAI, DeepSeek, Groq, OpenRouter, Mistral, xAI, Together, Ollama, vLLM, Custom)
# ─────────────────────────────────────────────────────────────────────────────

class OpenAICompatibleAdapter(BaseLLMAdapter):
    def __init__(self, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None, provider_id: str = "openai"):
        self.provider_id = provider_id
        super().__init__(api_key=api_key, model=model, base_url=base_url)

    def default_base_url(self) -> str:
        defaults = {
            "openai": "https://api.openai.com/v1",
            "deepseek": "https://api.deepseek.com",
            "groq": "https://api.groq.com/openai/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "xai": "https://api.x.ai/v1",
            "mistral": "https://api.mistral.ai/v1",
            "together": "https://api.together.xyz/v1",
            "fireworks": "https://api.fireworks.ai/inference/v1",
            "ollama": "http://localhost:11434/v1",
            "lmstudio": "http://localhost:1234/v1",
            "custom": "http://localhost:11434/v1",
        }
        return defaults.get(self.provider_id, "https://api.openai.com/v1")

    def default_model(self) -> str:
        defaults = {
            "openai": "gpt-4o",
            "deepseek": "deepseek-chat",
            "groq": "llama-3.3-70b-versatile",
            "openrouter": "deepseek/deepseek-r1",
            "xai": "grok-2-latest",
            "mistral": "mistral-large-latest",
            "together": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
            "fireworks": "accounts/fireworks/models/deepseek-r1",
            "ollama": "llama3.3",
            "lmstudio": "local-model",
            "custom": "default-model",
        }
        return defaults.get(self.provider_id, "gpt-4o")

    def _get_chat_url(self) -> str:
        base = self.base_url.rstrip("/")
        if base.endswith("/chat/completions"):
            return base
        return f"{base}/chat/completions"

    def validate_key(self) -> Tuple[bool, Optional[str]]:
        url = self._get_chat_url()
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if "openrouter.ai" in url:
            headers["HTTP-Referer"] = "https://itsp-platform.iitb.ac.in"
            headers["X-Title"] = "ITSP Academic Platform"

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": "Ping"}],
            "max_tokens": 5
        }
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=15)
            if res.status_code == 200:
                return True, None
            else:
                try:
                    data = res.json()
                    msg = data.get("error", {}).get("message", res.text)
                except Exception:
                    msg = res.text
                return False, f"Provider error ({res.status_code}): {msg}"
        except Exception as e:
            return False, f"Connection to {self.provider_id.capitalize()} endpoint failed: {str(e)}"

    def generate(self, prompt: str, system_prompt: Optional[str] = None, response_json: bool = False) -> str:
        url = self._get_chat_url()
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if "openrouter.ai" in url:
            headers["HTTP-Referer"] = "https://itsp-platform.iitb.ac.in"
            headers["X-Title"] = "ITSP Academic Platform"

        messages = []
        # For OpenAI o1/o3-mini reasoning models, system prompt is passed as developer message or prepended
        is_o_series = self.model.startswith("o1") or self.model.startswith("o3")
        
        if system_prompt:
            if is_o_series:
                messages.append({"role": "developer", "content": system_prompt})
            else:
                messages.append({"role": "system", "content": system_prompt})

        user_content = prompt
        if response_json and (self.provider_id in ("anthropic", "deepseek", "groq") or is_o_series):
            user_content += "\n\nCRITICAL: Return ONLY valid JSON format."

        messages.append({"role": "user", "content": user_content})

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
        }

        # Some reasoning models don't support temperature
        if not is_o_series:
            payload["temperature"] = 0.7

        if response_json and not is_o_series and self.provider_id in ("openai", "groq", "openrouter", "mistral", "xai"):
            payload["response_format"] = {"type": "json_object"}

        try:
            res = requests.post(url, json=payload, headers=headers, timeout=60)
            if res.status_code == 200:
                data = res.json()
                choice = data["choices"][0]
                message = choice.get("message", {})
                
                # Check for standard content
                content = message.get("content")
                if content:
                    return content
                
                # Check for reasoning_content (DeepSeek-R1 / thinking models)
                reasoning = message.get("reasoning_content")
                if reasoning:
                    return reasoning

                # Fallback to direct text if present
                text_content = choice.get("text")
                if text_content:
                    return text_content
                
                return ""
            else:
                try:
                    data = res.json()
                    msg = data.get("error", {}).get("message", res.text)
                except Exception:
                    msg = res.text
                raise LLMServiceError(f"{self.provider_id.capitalize()} error ({res.status_code}): {msg}")
        except Exception as e:
            raise LLMServiceError(f"{self.provider_id.capitalize()} call failed: {str(e)}")


# ─────────────────────────────────────────────────────────────────────────────
# Factory & Router Configuration
# ─────────────────────────────────────────────────────────────────────────────

SUPPORTED_PROVIDERS = [
    {
        "id": "gemini",
        "name": "Google Gemini",
        "default_model": "gemini-2.5-flash",
        "recommended_models": [
            "gemini-2.5-flash",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro",
            "gemini-3.1-flash-lite",
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.6-flash",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-2.0-flash-thinking-exp",
            "gemini-2.0-pro-exp-02-05",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ],
        "free_tier_available": True,
        "key_help_url": "https://aistudio.google.com/app/apikey",
        "supports_custom_url": False,
        "default_base_url": "",
    },

    {
        "id": "deepseek",
        "name": "DeepSeek API",
        "default_model": "deepseek-chat",
        "recommended_models": [
            "deepseek-chat",
            "deepseek-reasoner",
        ],
        "free_tier_available": True,
        "key_help_url": "https://platform.deepseek.com/api_keys",
        "supports_custom_url": True,
        "default_base_url": "https://api.deepseek.com",
    },
    {
        "id": "groq",
        "name": "Groq (Ultra-Fast Open Source)",
        "default_model": "llama-3.3-70b-versatile",
        "recommended_models": [
            "llama-3.3-70b-versatile",
            "deepseek-r1-distill-llama-70b",
            "llama-3.1-8b-instant",
            "mixtral-8x7b-32768",
            "gemma2-9b-it",
        ],
        "free_tier_available": True,
        "key_help_url": "https://console.groq.com/keys",
        "supports_custom_url": True,
        "default_base_url": "https://api.groq.com/openai/v1",
    },
    {
        "id": "openrouter",
        "name": "OpenRouter (300+ AI Models)",
        "default_model": "deepseek/deepseek-r1",
        "recommended_models": [
            "deepseek/deepseek-r1",
            "deepseek/deepseek-chat",
            "anthropic/claude-3.7-sonnet",
            "meta-llama/llama-3.3-70b-instruct",
            "google/gemini-2.0-flash-001",
            "qwen/qwen-2.5-72b-instruct",
            "mistralai/mistral-large-2411",
        ],
        "free_tier_available": True,
        "key_help_url": "https://openrouter.ai/keys",
        "supports_custom_url": True,
        "default_base_url": "https://openrouter.ai/api/v1",
    },
    {
        "id": "openai",
        "name": "OpenAI (ChatGPT)",
        "default_model": "gpt-4o",
        "recommended_models": [
            "gpt-4.5-preview",
            "gpt-4o",
            "gpt-4o-mini",
            "o1",
            "o3-mini",
            "gpt-4-turbo",
        ],
        "free_tier_available": False,
        "key_help_url": "https://platform.openai.com/api-keys",
        "supports_custom_url": True,
        "default_base_url": "https://api.openai.com/v1",
    },
    {
        "id": "anthropic",
        "name": "Anthropic (Claude)",
        "default_model": "claude-3-7-sonnet-20250219",
        "recommended_models": [
            "claude-3-7-sonnet-20250219",
            "claude-3-5-sonnet-latest",
            "claude-3-5-haiku-latest",
            "claude-3-opus-latest",
        ],
        "free_tier_available": False,
        "key_help_url": "https://console.anthropic.com/settings/keys",
        "supports_custom_url": False,
        "default_base_url": "https://api.anthropic.com/v1",
    },
    {
        "id": "xai",
        "name": "xAI (Grok)",
        "default_model": "grok-2-latest",
        "recommended_models": [
            "grok-3",
            "grok-2-latest",
            "grok-2-vision-1212",
            "grok-beta",
        ],
        "free_tier_available": False,
        "key_help_url": "https://console.x.ai/",
        "supports_custom_url": True,
        "default_base_url": "https://api.x.ai/v1",
    },
    {
        "id": "mistral",
        "name": "Mistral AI",
        "default_model": "mistral-large-latest",
        "recommended_models": [
            "mistral-large-latest",
            "codestral-latest",
            "mistral-small-latest",
            "pixtral-large-latest",
        ],
        "free_tier_available": False,
        "key_help_url": "https://console.mistral.ai/api-keys/",
        "supports_custom_url": True,
        "default_base_url": "https://api.mistral.ai/v1",
    },
    {
        "id": "custom",
        "name": "Custom / Self-Hosted / Ollama / LM Studio (OpenAI Compatible)",
        "default_model": "llama3.3",
        "recommended_models": [
            "llama3.3",
            "deepseek-r1:14b",
            "qwen2.5-coder:32b",
            "mistral",
            "custom-model",
        ],
        "free_tier_available": True,
        "key_help_url": "https://ollama.com/",
        "supports_custom_url": True,
        "default_base_url": "http://localhost:11434/v1",
    },
]


def create_adapter(provider: str, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None) -> BaseLLMAdapter:
    prov = provider.strip().lower()
    if prov == "gemini":
        return GeminiAdapter(api_key=api_key, model=model)
    elif prov == "anthropic":
        return AnthropicAdapter(api_key=api_key, model=model)
    else:
        # OpenAI, DeepSeek, Groq, OpenRouter, Mistral, xAI, Together, Ollama, Custom
        return OpenAICompatibleAdapter(
            api_key=api_key,
            model=model,
            base_url=base_url,
            provider_id=prov
        )


def validate_raw_key(provider: str, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Test an API key or custom endpoint against the live provider."""
    try:
        adapter = create_adapter(provider=provider, api_key=api_key, model=model, base_url=base_url)
        return adapter.validate_key()
    except Exception as e:
        return False, f"Validation failed: {str(e)}"


def get_user_llm(student_id: int, db: Session) -> Optional[BaseLLMAdapter]:
    """
    Look up the student's active API key from the database, decrypt it, and return
    an initialized LLM adapter.
    """
    key_record = db.query(UserAPIKey).filter(
        UserAPIKey.student_id == student_id,
        UserAPIKey.is_active == True
    ).order_by(UserAPIKey.updated_at.desc()).first()

    if not key_record:
        return None

    try:
        raw_key = decrypt_secret(key_record.encrypted_key) if key_record.encrypted_key else ""
        return create_adapter(
            provider=key_record.provider,
            api_key=raw_key,
            model=key_record.model_name,
            base_url=getattr(key_record, "base_url", None)
        )
    except Exception as e:
        logger.error(f"Failed to decrypt/initialize key for student {student_id}: {e}")
        return None


# ─────────────────────────────────────────────────────────────────────────────
# High-Level Feature Runners (Gated by User Key)
# ─────────────────────────────────────────────────────────────────────────────

def run_chat_with_mentor(student: Student, history: List[AIMessage], resource_context: str, user_llm: BaseLLMAdapter) -> str:
    conversation = ""
    for message in history:
        role = "User" if message.role == "user" else "Assistant"
        conversation += f"{role}: {message.content}\n\n"

    system_prompt = f"""You are the ITSP AI Academic Mentor for {student.name}, an IIT Bombay student in {student.branch} (Year {student.year}).
Goals: {student.goals or 'Academic Excellence'}
Weak Subjects: {student.weak_subjects or 'None specified'}
CPI: {student.cpi or 'N/A'}
Study Hours: {student.study_hours_per_week or 0} hrs/week

Provide actionable, empathetic, high-yield academic and career advice. Use realistic timelines.
When recommending resources, only cite relevant items from the provided Resource Catalogue using their exact titles and URLs. Never invent fictional links."""

    user_prompt = f"""Relevant ITSP Resource Library entries:
{resource_context}

Conversation History:
{conversation}

Reply as the Assistant with personalized advice for {student.name}."""

    return user_llm.generate(user_prompt, system_prompt=system_prompt)


def run_generate_roadmap(
    branch: str,
    year: int,
    goals: str,
    weak_subjects: str,
    cpi: float,
    sleep_hours: float,
    screen_time_hours: float,
    resource_context: str,
    user_llm: BaseLLMAdapter
) -> str:
    prompt = f"""You are an elite academic planning advisor for an IIT Bombay student.

Student Profile:
- Branch: {branch}
- Year: {year}
- Primary Goals: {goals}
- Weak / Challenging Subjects: {weak_subjects}
- Current CPI: {cpi}
- Average Sleep: {sleep_hours} hrs/day
- Average Screen Time: {screen_time_hours} hrs/day

Resource Library Entries:
{resource_context}

Create a rigorous, personalized weekly study roadmap with:
1. Phase-wise breakdown (Weeks 1 to 12) with actionable milestone checklists
2. Core concepts & IIT Bombay course alignment
3. Weak subject remediation strategy
4. Realistic weekly hour commitment & Pomodoro study block schedule
5. Recommended projects & interview prep milestones

Format cleanly in GitHub Markdown with tables and check-off lists."""

    return user_llm.generate(prompt)


def run_generate_smart_suggestions(
    student: Student,
    resources: List[Resource],
    history: List[AIMessage],
    user_llm: BaseLLMAdapter
) -> List[Dict[str, Any]]:
    catalogue = "\n".join(
        f"{r.id}: {r.title} | {r.domain} | {r.url or 'no URL'}"
        for r in resources
    ) or "No entries available."
    
    conversation = "\n".join(
        f"{m.role}: {m.content[:400]}" for m in reversed(history)
    )

    prompt = f"""You create a short, practical 'Focus Now' list of 2-3 items for an IIT Bombay student.
Return ONLY a valid JSON array of objects with:
- "title": concise action title (string)
- "reason": 1 sentence why this is urgent/helpful (string)
- "action_steps": list of 1-3 specific steps (strings)
- "priority": integer 1 (highest) to 3 (lowest)
- "resource_id": integer ID from catalogue or null

Profile: branch={student.branch}; year={student.year}; goals={student.goals}; weak={student.weak_subjects}
Resource catalogue:
{catalogue}

Recent conversation:
{conversation}"""

    raw = user_llm.generate(prompt, response_json=True)
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    try:
        data = json.loads(cleaned)
        if isinstance(data, list):
            return data
    except Exception as e:
        logger.warning(f"Failed to parse smart suggestions JSON: {e}")
    return []
