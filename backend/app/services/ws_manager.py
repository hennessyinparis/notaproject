"""In-memory WebSocket connection registry (single-process)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from starlette.websockets import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.setdefault(user_id, set()).add(websocket)

    async def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            conns = self._connections.get(user_id)
            if not conns:
                return
            conns.discard(websocket)
            if not conns:
                self._connections.pop(user_id, None)

    async def send_json(self, user_id: int, data: dict[str, Any]) -> None:
        async with self._lock:
            targets = list(self._connections.get(user_id, set()))
        dead: list[WebSocket] = []
        for ws in targets:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(user_id, ws)

    def online_count(self, user_id: int) -> int:
        return len(self._connections.get(user_id, set()))


ws_manager = ConnectionManager()
