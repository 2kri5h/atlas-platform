import os
import uuid
import io
from PIL import Image, ImageOps
from typing import Optional

MEDIA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "anonymous_media"))
MAX_EDGE = 2048
MAX_PIXELS = 40_000_000  # Avoid decompression bomb attacks
MAX_BYTES = 5 * 1024 * 1024  # 5 MB upload limit


def ensure_media_dir():
    os.makedirs(MEDIA_DIR, exist_ok=True)


def sanitize_and_save_image(file_bytes: bytes) -> Optional[str]:
    """Sanitize uploaded image: strip all EXIF/GPS/device metadata, scale, re-encode as WebP.

    Returns the filename (e.g., 'a8d9f...webp') or None if invalid.
    """
    if not file_bytes or len(file_bytes) > MAX_BYTES:
        return None
    try:
        ensure_media_dir()
        Image.MAX_IMAGE_PIXELS = MAX_PIXELS
        img = Image.open(io.BytesIO(file_bytes))

        # Respect orientation before stripping EXIF tags
        img = ImageOps.exif_transpose(img)

        # Convert to RGB (or RGBA if transparent)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode else "RGB")

        # Resize if dimensions exceed MAX_EDGE
        w, h = img.size
        if max(w, h) > MAX_EDGE:
            scale = MAX_EDGE / max(w, h)
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        # Generate unique filename
        filename = f"{uuid.uuid4().hex}.webp"
        filepath = os.path.join(MEDIA_DIR, filename)

        # Save as WebP with no EXIF / metadata
        img.save(filepath, format="WEBP", quality=82, method=6)
        return filename
    except Exception as e:
        print(f"[Image Sanitize Error] {e}")
        return None
