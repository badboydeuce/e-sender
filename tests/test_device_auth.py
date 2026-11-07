import hashlib
import hmac

from app.core.config import settings
from app.core.security import _token_digest


def test_device_token_digest_is_keyed_and_stable():
    token = "test-device-token-that-is-long-enough"
    expected = hmac.new(
        settings.device_token_secret.encode(),
        token.encode(),
        hashlib.sha256,
    ).hexdigest()
    assert _token_digest(token) == expected
    assert _token_digest(token) != hashlib.sha256(token.encode()).hexdigest()
