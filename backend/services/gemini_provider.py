from dotenv import load_dotenv
load_dotenv()

import google.genai as genai
import os
import time

from .llm_provider import LLMProvider

class GeminiProvider(LLMProvider):
    def __init__(self, model="gemini-3.1-flash-lite"):
        # GEMINI_API_KEY is krish-api //krish-api (GEMINI_API_KEY_ATHARVA is atharv-api)
        api_key = os.environ.get("GEMINI_API_KEY_ATHARVA") or os.environ.get("GEMINI_API_KEY", "")  # //krish-api
        self.client = genai.Client(api_key=api_key) if api_key else None
        self.model = model

    def process_batch(self, email_batch, prompt_builder, max_retries=2):
        prompt = prompt_builder(email_batch)
        for attempt in range(max_retries + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config={
                        "response_mime_type": "application/json"
                    }
                )
                return response.text
        
            except Exception as e:

                print(f"[Gemini Error] Attempt {attempt + 1}: {e}")
                if attempt < max_retries:
                    time.sleep(5*(attempt+1))
                else:
                    return None

       
       
