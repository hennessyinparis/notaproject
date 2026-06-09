"""
Валидация загружаемых файлов для безопасности.
Защита от:
- Неправильных MIME types
- Вредоносных файлов
- Filename injection

Определение MIME производится через magic bytes (первые байты файла),
без использования внешних библиотек (libmagic/pyton-magic не требует).
"""
import mimetypes
from pathlib import Path
from typing import Optional, Tuple

from fastapi import HTTPException


# Допустимые MIME types для аудио файлов
ALLOWED_AUDIO_MIMES = {
    "audio/mpeg",       # MP3
    "audio/mp3",        # MP3 (альтернативный)
    "audio/wav",        # WAV
    "audio/wave",       # WAV (альтернативный)
    "audio/x-wav",      # WAV (альтернативный)
    "audio/ogg",        # OGG
    "audio/flac",       # FLAC
    "audio/x-flac",     # FLAC (альтернативный)
    "audio/aac",        # AAC
    "audio/mp4",        # M4A/MP4 audio
    "audio/x-m4a",      # M4A
}

# Допустимые расширения для аудио
ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3", ".mpeg", ".wav", ".wave", 
    ".ogg", ".flac", ".aac", ".m4a", ".mp4"
}

# Допустимые MIME types для изображений
ALLOWED_IMAGE_MIMES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

# Допустимые расширения для изображений
ALLOWED_IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".gif"
}

# Магические байты для распознавания форматов
MAGIC_BYTES = {
    b"\xff\xfb": "audio/mpeg",           # MP3
    b"\xff\xf3": "audio/mpeg",           # MP3
    b"\xff\xf2": "audio/mpeg",           # MP3
    b"ID3": "audio/mpeg",                # MP3 with ID3
    b"RIFF": "audio/wav",                # WAV (нужна доп. проверка)
    b"OggS": "audio/ogg",                # OGG
    b"fLaC": "audio/flac",               # FLAC
    b"\xff\xd8\xff": "image/jpeg",       # JPEG
    b"\x89PNG\r\n\x1a\n": "image/png",   # PNG
    b"GIF87a": "image/gif",              # GIF
    b"GIF89a": "image/gif",              # GIF
    b"RIFF": None,                       # RIFF контейнер (WAV, WEBP)
}


def sanitize_filename(filename: str) -> str:
    """
    Очищает имя файла от опасных символов.
    Возвращает только имя файла без пути.
    """
    if not filename:
        return "unnamed"
    
    # Берем только имя файла, без пути
    safe_name = Path(filename).name
    
    # Удаляем нулевые байты и другие опасные символы
    safe_name = safe_name.replace("\0", "").replace("\r", "").replace("\n", "")
    
    # Если имя пустое после очистки
    if not safe_name or safe_name in (".", ".."):
        return "unnamed"
    
    return safe_name


def detect_mime_from_magic(content: bytes) -> Optional[str]:
    """
    Определяет MIME type по magic bytes (первым байтам файла).
    """
    if len(content) < 16:
        return None
    
    # Проверка по магическим байтам
    for magic, mime in MAGIC_BYTES.items():
        if content.startswith(magic):
            # Дополнительная проверка для RIFF (может быть WAV или WEBP)
            if magic == b"RIFF" and len(content) > 12:
                if content[8:12] == b"WAVE":
                    return "audio/wav"
                elif content[8:12] == b"WEBP":
                    return "image/webp"
            return mime
    
    return None


def validate_audio_file(
    content: bytes, 
    filename: str,
    max_size_mb: int = 200
) -> Tuple[str, str]:
    """
    Валидирует аудио файл.
    
    Args:
        content: Содержимое файла
        filename: Имя файла
        max_size_mb: Максимальный размер в МБ
        
    Returns:
        Tuple[safe_filename, mime_type]
        
    Raises:
        HTTPException: Если файл не прошел валидацию
    """
    # Проверка размера
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Файл слишком большой. Максимум {max_size_mb}MB"
        )
    
    # Минимальный размер (защита от пустых файлов)
    if len(content) < 1024:  # Минимум 1KB
        raise HTTPException(
            status_code=400,
            detail="Файл слишком маленький или поврежден"
        )
    
    # Очистка имени файла
    safe_name = sanitize_filename(filename)
    
    # Проверка расширения
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимое расширение файла. Разрешены: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"
        )
    
    # Определение MIME через magic bytes
    detected_mime = detect_mime_from_magic(content)
    
    # Если не удалось определить или MIME не аудио
    if not detected_mime or not detected_mime.startswith("audio/"):
        # Пробуем определить по расширению
        guessed_mime, _ = mimetypes.guess_type(safe_name)
        if guessed_mime and guessed_mime in ALLOWED_AUDIO_MIMES:
            detected_mime = guessed_mime
        else:
            raise HTTPException(
                status_code=400,
                detail="Файл не является аудио файлом или формат не поддерживается"
            )
    
    # Финальная проверка MIME
    if detected_mime not in ALLOWED_AUDIO_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый формат аудио: {detected_mime}"
        )
    
    return safe_name, detected_mime


def validate_image_file(
    content: bytes,
    filename: str,
    max_size_mb: int = 10
) -> Tuple[str, str]:
    """
    Валидирует изображение.
    
    Args:
        content: Содержимое файла
        filename: Имя файла
        max_size_mb: Максимальный размер в МБ
        
    Returns:
        Tuple[safe_filename, mime_type]
        
    Raises:
        HTTPException: Если файл не прошел валидацию
    """
    # Проверка размера
    if len(content) > max_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=413,
            detail=f"Изображение слишком большое. Максимум {max_size_mb}MB"
        )
    
    # Минимальный размер
    if len(content) < 100:  # Минимум 100 байт
        raise HTTPException(
            status_code=400,
            detail="Файл слишком маленький или поврежден"
        )
    
    # Очистка имени
    safe_name = sanitize_filename(filename)
    
    # Проверка расширения
    ext = Path(safe_name).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимое расширение. Разрешены: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
        )
    
    # Определение MIME через magic bytes
    detected_mime = detect_mime_from_magic(content)
    
    # Если не удалось определить или MIME не изображение
    if not detected_mime or not detected_mime.startswith("image/"):
        guessed_mime, _ = mimetypes.guess_type(safe_name)
        if guessed_mime and guessed_mime in ALLOWED_IMAGE_MIMES:
            detected_mime = guessed_mime
        else:
            raise HTTPException(
                status_code=400,
                detail="Файл не является изображением"
            )
    
    # Финальная проверка MIME
    if detected_mime not in ALLOWED_IMAGE_MIMES:
        raise HTTPException(
            status_code=400,
            detail=f"Недопустимый формат изображения: {detected_mime}"
        )
    
    return safe_name, detected_mime
