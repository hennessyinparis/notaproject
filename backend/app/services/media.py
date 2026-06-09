import os
import shutil
import uuid
from pathlib import Path
from typing import Optional, Tuple

from app.core.config import get_settings


def ensure_media_dirs() -> None:
    settings = get_settings()
    for sub in ("tracks", "covers", "avatars", "ads"):
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


def save_ad_audio(file_content: bytes, original_name: str) -> Tuple[str, Path]:
    settings = get_settings()
    ensure_media_dirs()
    ext = Path(original_name).suffix.lower() or ".mp3"
    if ext not in (".mp3", ".mpeg", ".wav", ".ogg", ".m4a", ".aac"):
        ext = ".mp3"
    name = f"{uuid.uuid4().hex}{ext}"
    rel = f"/media/ads/{name}"
    dest = settings.MEDIA_DIR / "ads" / name
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
    """file_url вида /media/tracks/xxx.mp3 -> абсолютный путь.
    
    Защита от Path Traversal атак:
    - Проверяет префикс /media/
    - Блокирует .. и абсолютные пути
    - Проверяет что resolved путь внутри MEDIA_DIR
    """
    if not file_url.startswith("/media/"):
        return None
    
    settings = get_settings()
    sub = file_url.removeprefix("/media/")
    
    # Защита от path traversal
    if ".." in sub or sub.startswith("/") or sub.startswith("\\"):
        return None
    
    # Проверяем что путь содержит только безопасные символы
    if any(char in sub for char in ["\0", "\r", "\n"]):
        return None
    
    resolved = (settings.MEDIA_DIR / sub).resolve()
    media_dir_resolved = settings.MEDIA_DIR.resolve()
    
    # Убеждаемся что путь внутри MEDIA_DIR
    try:
        resolved.relative_to(media_dir_resolved)
    except ValueError:
        # Путь за пределами MEDIA_DIR
        return None
    
    return resolved
