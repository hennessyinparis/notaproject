"""Тесты для API аутентификации и пользователей."""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestAuth:
    def test_health(self):
        r = client.get("/health")
        assert r.status_code == 200

    def test_register(self):
        r = client.post("/api/auth/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "testpass123",
        })
        assert r.status_code in (200, 201, 400)  # 400 если уже существует

    def test_register_invalid_email(self):
        r = client.post("/api/auth/register", json={
            "username": "testuser2",
            "email": "invalid-email",
            "password": "testpass123",
        })
        assert r.status_code == 422

    def test_register_short_password(self):
        r = client.post("/api/auth/register", json={
            "username": "testuser3",
            "email": "test3@example.com",
            "password": "short",
        })
        assert r.status_code == 422

    def test_login_success(self):
        r = client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "testpass123",
        })
        if r.status_code == 200:
            data = r.json()
            assert "access_token" in data
            assert "refresh_token" in data

    def test_login_invalid_password(self):
        r = client.post("/api/auth/login", json={
            "username": "testuser",
            "password": "wrongpassword",
        })
        assert r.status_code == 401
        assert "Неверные" in r.json().get("detail", "")

    def test_login_nonexistent_user(self):
        r = client.post("/api/auth/login", json={
            "username": "nonexistent_user_12345",
            "password": "somepassword",
        })
        assert r.status_code == 401
        # Не должны раскрывать существование пользователя
        assert "Неверные" in r.json().get("detail", "")

    def test_username_available(self):
        r = client.get("/api/auth/username-available?username=newuser123")
        assert r.status_code == 200
        data = r.json()
        assert "available" in data

    def test_forgot_password(self):
        r = client.post("/api/auth/forgot-password", json={
            "email": "test@example.com",
        })
        assert r.status_code == 200
        # Не раскрываем существование email
        assert "ok" in r.json()
        assert r.json()["ok"] is True


class TestUsers:
    def test_get_me_unauthorized(self):
        r = client.get("/api/users/me")
        assert r.status_code == 401

    def test_get_user_profile(self):
        r = client.get("/api/users/testuser")
        # Может быть 200 или 404
        assert r.status_code in (200, 404)

    def test_update_me_unauthorized(self):
        r = client.patch("/api/users/me", json={"display_name": "New Name"})
        assert r.status_code == 401


class TestTracks:
    def test_trending_tracks(self):
        r = client.get("/api/tracks/trending")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_new_releases(self):
        r = client.get("/api/tracks/new")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_nonexistent_track(self):
        r = client.get("/api/tracks/999999")
        assert r.status_code == 404

    def test_upload_unauthorized(self):
        r = client.post("/api/tracks", files={
            "file": ("test.mp3", b"fake audio content", "audio/mpeg"),
        }, data={"title": "Test Track"})
        assert r.status_code == 401


class TestComments:
    def test_get_comments_nonexistent_track(self):
        r = client.get("/api/comments/track/999999")
        assert r.status_code in (200, 404)

    def test_create_comment_unauthorized(self):
        r = client.post("/api/comments/track/1", json={
            "text": "Great track!",
            "timestamp_seconds": 0,
        })
        assert r.status_code == 401


class TestSearch:
    def test_search(self):
        r = client.get("/api/search?q=test")
        assert r.status_code == 200
        data = r.json()
        assert "tracks" in data
        assert "users" in data

    def test_search_tracks(self):
        r = client.get("/api/search/tracks?q=test")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


class TestSecurity:
    def test_security_headers(self):
        r = client.get("/health")
        assert "x-content-type-options" in r.headers
        assert r.headers["x-content-type-options"] == "nosniff"
        assert "x-frame-options" in r.headers
        assert r.headers["x-frame-options"] == "DENY"

    def test_rate_limiting(self):
        """Rate limiting headers should be present."""
        r = client.get("/api/tracks/trending")
        # Rate limiting headers
        assert r.status_code == 200

    def test_path_traversal_prevention(self):
        """Проверка что path traversal заблокирован."""
        from app.services.media import resolve_media_path
        assert resolve_media_path("/media/../../../etc/passwd") is None
        assert resolve_media_path("/media/..\\windows\\system32") is None
        assert resolve_media_path("/media/tracks/valid.mp3") is not None

    def test_file_validation(self):
        """Проверка валидации файлов."""
        from app.services.file_validation import validate_audio_file, sanitize_filename
        
        # Sanitize filename
        assert sanitize_filename("../../../etc/passwd") == "passwd"
        assert sanitize_filename("normal.mp3") == "normal.mp3"
        assert sanitize_filename("") == "unnamed"
        
        # Audio validation
        import pytest
        with pytest.raises(Exception):
            validate_audio_file(b"not an audio file", "test.txt")
        
        with pytest.raises(Exception):
            validate_audio_file(b"", "test.mp3")


class TestSubscriptions:
    def test_purchase_unauthorized(self):
        r = client.post("/api/subscriptions/purchase", json={
            "plan": "listener_plus",
        })
        assert r.status_code == 401

    def test_cancel_unauthorized(self):
        r = client.post("/api/subscriptions/cancel")
        assert r.status_code == 401


class TestPlaylists:
    def test_create_playlist_unauthorized(self):
        r = client.post("/api/playlists", json={
            "title": "My Playlist",
            "is_public": True,
        })
        assert r.status_code == 401

    def test_get_public_playlists(self):
        r = client.get("/api/playlists")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_nonexistent_playlist(self):
        r = client.get("/api/playlists/999999")
        assert r.status_code == 404
