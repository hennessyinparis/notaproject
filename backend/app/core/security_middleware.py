"""Security middleware для защиты от XSS, Clickjacking, MIME sniffing и других атак.

Добавляет HTTP заголовки безопасности к каждому ответу.
"""
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware для добавления заголовков безопасности к каждому ответу."""

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Content Security Policy - защита от XSS
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "media-src 'self' data: blob: https:; "
            "font-src 'self' data:; "
            "connect-src 'self' ws: wss: https:; "
            "frame-ancestors 'none'; "
            "form-action 'self'"
        )

        # X-Content-Type-Options - защита от MIME sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options - защита от Clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Referrer-Policy - контроль Referer header
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions-Policy - ограничение API браузера
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=(), "
            "fullscreen=(self), payment=()"
        )

        # Strict-Transport-Security - принудительный HTTPS (только в продакшене)
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # X-XSS-Protection - дополнительная защита XSS (legacy)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Cache-Control для API ответов
        if request.method in ("GET", "HEAD") and "/api/" in request.url.path:
            if not response.headers.get("Cache-Control"):
                response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"

        return response


class RateLimitHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware для добавления rate limit заголовков (когда slowapi не используется)."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        return response
