"""Celery tasks for audio processing.

This module defines background tasks that handle heavy audio operations,
such as generating waveform data for a track. The tasks are executed by
the Celery worker defined in ``backend/app/tasks/celery_app.py``.
"""

from pathlib import Path

from app.core.database import AsyncSessionLocal
from app.models.track import Track
from app.services.audio_meta import waveform_for_db
from app.tasks.celery_app import celery_app


async def _update_track_waveform(track_id: int, waveform: dict) -> None:
    """Utility to update the ``waveform_data`` column of a Track."""
    async with AsyncSessionLocal() as session:
        async with session.begin():
            result = await session.execute(
                # ``select`` is imported lazily to avoid circular imports
                __import__("sqlalchemy").select(Track).where(Track.id == track_id)
            )
            track = result.scalar_one_or_none()
            if track is None:
                return
            track.waveform_data = waveform
            await session.flush()


@celery_app.task(name="nota.generate_waveform")
def generate_waveform_task(track_id: int, file_path: str) -> None:
    """Generate waveform data for a track in a background worker.

    The task runs in a separate Celery worker process, so it does not block
    the FastAPI request that uploads the track.

    Args:
        track_id: Primary key of the ``Track`` record that needs the waveform.
        file_path: Absolute path to the uploaded audio file on disk.
    """
    try:
        path = Path(file_path)
        waveform = waveform_for_db(path)
        # ``_update_track_waveform`` is an async function; we need to run it
        # in an event loop because Celery tasks are synchronous.
        import asyncio

        asyncio.run(_update_track_waveform(track_id, waveform))
    except Exception as e:
        # In production you would log the exception; for now we simply
        # re‑raise so Celery marks the task as failed.
        raise e