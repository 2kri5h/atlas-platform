from dotenv import load_dotenv
load_dotenv()

import os

_client = None

def get_client():
    global _client
    if _client is None:
        supabase_url = os.environ.get("supabase_url") or os.environ.get("SUPABASE_URL", "")
        supabase_api = os.environ.get("supabase_api") or os.environ.get("SUPABASE_API", "")
        if not supabase_url or not supabase_api:
            return None
        from supabase import create_client
        _client = create_client(supabase_url, supabase_api)
    return _client


