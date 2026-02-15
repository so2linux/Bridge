import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User

router = APIRouter()

# Папки относительно корня backend
BASE_DIR = Path(__file__).resolve().parent.parent.parent
STATIC_DIR = BASE_DIR / "static"
AVATARS_DIR = STATIC_DIR / "avatars"
STORIES_DIR = STATIC_DIR / "stories"

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO = {"video/mp4", "video/webm"}
ALLOWED_VOICE = {"audio/webm", "audio/mp3", "audio/mpeg", "audio/ogg"}
MAX_AVATAR_SIZE = 5 * 1024 * 1024   # 5 MB
MAX_STORY_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_STORY_VIDEO_SIZE = 25 * 1024 * 1024  # ~1 min 25 MB
MAX_VOICE_SIZE = 5 * 1024 * 1024  # 5 MB (~2–3 min)


VOICE_DIR = STATIC_DIR / "voice"


def _ensure_dirs():
    AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    STORIES_DIR.mkdir(parents=True, exist_ok=True)
    VOICE_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _ensure_dirs()
    if file.content_type not in ALLOWED_IMAGE:
        raise HTTPException(400, "Только JPEG, PNG, GIF, WebP")
    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(400, "Файл не более 5 МБ")
    ext = Path(file.filename or "img").suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        ext = ".jpg"
    name = f"{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    path = AVATARS_DIR / name
    path.write_bytes(content)
    url = f"/static/avatars/{name}"
    return {"url": url}


@router.post("/story")
async def upload_story_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    _ensure_dirs()
    content = await file.read()
    is_video = file.content_type in ALLOWED_VIDEO
    is_image = file.content_type in ALLOWED_IMAGE
    if not (is_video or is_image):
        raise HTTPException(400, "Только фото (JPEG, PNG, GIF, WebP) или видео (MP4, WebM)")
    if is_video and len(content) > MAX_STORY_VIDEO_SIZE:
        raise HTTPException(400, "Видео до 1 минуты (~25 МБ)")
    if is_image and len(content) > MAX_STORY_IMAGE_SIZE:
        raise HTTPException(400, "Фото не более 10 МБ")
    ext = Path(file.filename or "f").suffix.lower()
    if is_video and ext not in (".mp4", ".webm"):
        ext = ".mp4"
    if is_image and ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        ext = ".jpg"
    name = f"{uuid.uuid4().hex}{ext}"
    path = STORIES_DIR / name
    path.write_bytes(content)
    url = f"/static/stories/{name}"
    content_type = "video" if is_video else "photo"
    return {"url": url, "content_type": content_type}


@router.post("/voice")
async def upload_voice(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """Загрузка голосового сообщения (.webm, .mp3). Сохраняется в static/voice/."""
    _ensure_dirs()
    content = await file.read()
    if len(content) > MAX_VOICE_SIZE:
        raise HTTPException(400, "Файл не более 5 МБ")
    ct = (file.content_type or "").lower()
    if ct not in ALLOWED_VOICE and not (file.filename or "").lower().endswith((".webm", ".mp3", ".ogg")):
        raise HTTPException(400, "Только аудио: WebM, MP3, OGG")
    ext = Path(file.filename or "a").suffix.lower()
    if ext not in (".webm", ".mp3", ".ogg", ".mpeg"):
        ext = ".webm"
    name = f"{current_user.id}_{uuid.uuid4().hex[:12]}{ext}"
    path = VOICE_DIR / name
    path.write_bytes(content)
    url = f"/static/voice/{name}"
    return {"url": url}
