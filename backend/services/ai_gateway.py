import base64
import json
import time
from abc import ABC, abstractmethod
from typing import Any, Dict
import requests


class AIGatewayDriver(ABC):
    @abstractmethod
    def parse_timetable_image(self, file_content: bytes, mime_type: str) -> Dict[str, Any]:
        """
        Parses a timetable image and returns a structured dictionary matching:
        { "timetable": [{ "day": int, "startTime": "HH:MM", "endTime": "HH:MM", "subject": string }] }
        """
        pass


class GeminiGatewayDriver(AIGatewayDriver):
    def __init__(self, api_key: str):
        self.api_key = api_key

    def parse_timetable_image(self, file_content: bytes, mime_type: str) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY is not configured on the server")
            
        base64_image = base64.b64encode(file_content).decode("utf-8")
        
        system_prompt = (
            "You are an expert OCR timetable parser. Analyze the visual 2D space of the timetable image.\n"
            "Read the schedule rows and columns, interpret complex academic matrix codes (such as course slot blocks "
            "like '4A', '4B', '5A', 'Slot 1', etc.), map them accurately to absolute time slots, and extract them "
            "into clean text formats.\n"
            "You MUST return a JSON object containing a 'timetable' array of items. Each item must have:\n"
            "- 'day': integer (0 for Sunday, 1 for Monday, 2 for Tuesday, 3 for Wednesday, 4 for Thursday, 5 for Friday, 6 for Saturday)\n"
            "- 'startTime': clock time string (24-hour HH:MM format)\n"
            "- 'endTime': clock time string (24-hour HH:MM format)\n"
            "- 'subject': course/subject title string. If a slot or division code is present (such as '4A', '4B', '5A', '3B', etc.), append it to the subject title using ' | ' (e.g. 'CS101 | 4A' or 'HS109 | 5A').\n"
            "Follow the schema strictly."
        )
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": system_prompt
                        },
                        {
                            "inlineData": {
                                "mimeType": mime_type,
                                "data": base64_image
                            }
                        }
                    ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "OBJECT",
                    "properties": {
                        "timetable": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "day": {
                                        "type": "INTEGER",
                                        "description": "0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday"
                                    },
                                    "startTime": {
                                        "type": "STRING",
                                        "description": "HH:MM format"
                                    },
                                    "endTime": {
                                        "type": "STRING",
                                        "description": "HH:MM format"
                                    },
                                    "subject": {
                                        "type": "STRING"
                                    }
                                },
                                "required": ["day", "startTime", "endTime", "subject"]
                            }
                        }
                    },
                    "required": ["timetable"]
                }
            }
        }
        
        headers = {"Content-Type": "application/json"}
        candidate_models = ["gemini-3.1-flash-lite", "gemini-3.6-flash", "gemini-2.0-flash", "gemini-1.5-flash"]
        last_error = None

        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
            for attempt in range(3):
                try:
                    response = requests.post(url, json=payload, headers=headers, timeout=30)
                    if response.status_code == 200:
                        result = response.json()
                        text = result["candidates"][0]["content"]["parts"][0]["text"]
                        return json.loads(text.strip())
                    elif response.status_code in (503, 429):
                        last_error = f"Gemini API error (status code {response.status_code}): {response.text}"
                        time.sleep(1.5 * (attempt + 1))
                    elif response.status_code == 404:
                        # Model not available in this region/key, try next model
                        break
                    else:
                        raise Exception(f"Gemini API error (status code {response.status_code}): {response.text}")
                except requests.RequestException as e:
                    last_error = str(e)
                    time.sleep(1.5 * (attempt + 1))

        if last_error:
            raise Exception(last_error)
        raise Exception("Failed to contact Gemini API after retries.")
