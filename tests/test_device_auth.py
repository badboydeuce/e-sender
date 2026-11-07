import hashlib
import hmac

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import _token_digest
from app.main import app
from app.db.session import SessionLocal
from app.models.device import Device


def test_device_token_digest_is_keyed_and_stable():
    token = "test-device-token-that-is-long-enough"
    expected = hmac.new(
        settings.device_token_secret.encode(),
        token.encode(),
        hashlib.sha256,
    ).hexdigest()
    assert _token_digest(token) == expected
    assert _token_digest(token) != hashlib.sha256(token.encode()).hexdigest()


def test_unknown_device_token_is_rejected():
    client = TestClient(app)
    response = client.post(
        "/api/device/heartbeat",
        headers={"X-Device-Token": "x" * 48},
        json={"app_version": "test"},
    )
    assert response.status_code == 401
