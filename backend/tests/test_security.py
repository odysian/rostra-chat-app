import pytest

from app.core import security
from app.core.security import (
    create_access_token,
    decode_access_token,
    get_password_hash,
)


def test_create_and_decode_access_token_roundtrip():
    token = create_access_token({"sub": "123"})

    assert decode_access_token(token) == "123"


def test_decode_access_token_returns_none_for_invalid_token():
    assert decode_access_token("not-a-jwt") is None


def test_verify_password_returns_false_for_mismatch():
    hashed = get_password_hash("correct-password")

    assert security.verify_password("wrong-password", hashed) is False


def test_verify_password_returns_false_for_invalid_hash():
    assert security.verify_password("any-password", "invalid-hash") is False


def test_verify_password_propagates_unexpected_errors(monkeypatch: pytest.MonkeyPatch):
    class BrokenHasher:
        def verify(self, hashed_password: str, plain_password: str) -> bool:
            raise RuntimeError("unexpected failure")

    monkeypatch.setattr(security, "_ph", BrokenHasher())

    with pytest.raises(RuntimeError, match="unexpected failure"):
        security.verify_password("password", "hash")
