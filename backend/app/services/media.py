import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, Tuple

from app.core.config import get_settings


def ensure_media_dirs() -> None:
    settings = get_settings()
    for sub in ("tracks", "covers", "avatars"):
        (settings.MEDIA_DIR / sub).mkdir(parents=True, exist_ok=True)


def save_uploaded_track(file_content: bytes, original_name: str) -> Tuple[str, Path]:
    """Сохраняет файл трека, возвращает относительный URL и путь на диске."""
    settings = get_settings()
    ensure_media_dirs()
    ext = Path(original_name).suffix.lower() or ".mp3"
    name = f"{uuid.uuid4().hex}{ext}"
    rel = f"/media/tracks/{name}"
    dest = settings.MEDIA_DIR / "tracks" / name
    dest.write_bytes(file_content)
    return rel, dest


def save_cover(file_content: bytes, ext: str = ".jpg") -> str:
    settings = get_settings()
    ensure_media_dirs()
    name = f"{uuid.uuid4().hex}{ext}"
    rel = f"/media/covers/{name}"
    dest = settings.MEDIA_DIR / "covers" / name
    dest.write_bytes(file_content)
    return rel


def resolve_media_path(file_url: str) -> Optional[Path]:
    """file_url вида /media/tracks/xxx.mp3 -> абсолютный путь."""
    if not file_url.startswith("/media/"):
        return None
    settings = get_settings()
    sub = file_url.removeprefix("/media/")
    return (settings.MEDIA_DIR / sub).resolve()
