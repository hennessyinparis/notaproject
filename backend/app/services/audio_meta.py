"""Извлечение длительности и заглушка waveform через FFmpeg (если доступен)."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any, List


def get_duration_seconds(path: Path) -> float:
    try:
        r = subprocess.run(
            [
                "ffprobe",
                "-v",
                "quiet",
                "-show_entries",
                "format=duration",
                "-of",
                "json",
                str(path),
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
        if r.returncode == 0 and r.stdout:
            data = json.loads(r.stdout)
            return float(data.get("format", {}).get("duration") or 0)
    except (FileNotFoundError, subprocess.SubprocessError, json.JSONDecodeError, ValueError, KeyError):
        pass
    return 0.0


def generate_waveform_peaks(path: Path, peaks: int = 1000) -> List[float]:
    """Генерирует массив пиков [0..1] через ffmpeg showwavespic."""
    out: List[float] = [0.05] * min(peaks, 1000)
    try:
        r = subprocess.run(
            [
                "ffmpeg",
                "-i",
                str(path),
                "-af",
                f"showwavespic=s={peaks}x1:colors=gray",
                "-frames:v",
                "1",
                "-f",
                "image2pipe",
                "-vcodec",
                "rawvideo",
                "-pix_fmt",
                "gray",
                "-",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=120,
        )
        if r.returncode != 0 or len(r.stdout) < peaks:
            return _synthetic_peaks(path, peaks)
        # stdout содержит peaks серых пикселей (1 байт каждый)
        values = [b / 255.0 for b in r.stdout[:peaks]]
        return values
    except (FileNotFoundError, subprocess.SubprocessError):
        return _synthetic_peaks(path, peaks)
    return _synthetic_peaks(path, peaks)


def _synthetic_peaks(path: Path, n: int) -> List[float]:
    """Детерминированные «псевдо-пики» если полный анализ недоступен."""
    size = path.stat().st_size if path.exists() else 1
    result: List[float] = []
    for i in range(n):
        v = ((size >> (i % 16)) & 0xFF) / 512.0 + 0.1
        result.append(min(1.0, max(0.02, v)))
    return result


def waveform_for_db(path: Path) -> Any:
    peaks = generate_waveform_peaks(path, 1000)
    return {"peaks": peaks, "version": 1}
