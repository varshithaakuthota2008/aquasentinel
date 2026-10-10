import re
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from ..dependencies import get_current_user

router = APIRouter(prefix="/uploads", tags=["uploads"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB
SAFE_FILENAME_RE = re.compile(r"^[a-f0-9]{32}\.[a-z]{3,4}$")


@router.post("/photo")
async def upload_photo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Only JPEG, PNG, WebP, and GIF images are accepted.")
    contents = await file.read()
    if len(contents) > MAX_SIZE_BYTES:
        raise HTTPException(400, "File exceeds the 5 MB size limit.")
    ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
    ext = ext_map[file.content_type]
    filename = f"{uuid.uuid4().hex}.{ext}"
    dest = UPLOAD_DIR / filename
    dest.write_bytes(contents)
    return {"filename": filename}


@router.get("/{filename}")
def serve_photo(filename: str):
    # Strict validation — only hex UUID filenames allowed
    if not SAFE_FILENAME_RE.match(filename):
        raise HTTPException(400, "Invalid filename.")
    path = UPLOAD_DIR / filename
    # Ensure we stay inside UPLOAD_DIR (path traversal prevention)
    try:
        path.resolve().relative_to(UPLOAD_DIR.resolve())
    except ValueError:
        raise HTTPException(400, "Invalid path.")
    if not path.exists() or not path.is_file():
        raise HTTPException(404, "File not found.")
    return FileResponse(str(path))
