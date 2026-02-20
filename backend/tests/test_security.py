from app.core.security import create_access_token, decode_access_token


def test_create_and_decode_access_token_roundtrip():
    token = create_access_token({"sub": "123"})

    assert decode_access_token(token) == "123"


def test_decode_access_token_returns_none_for_invalid_token():
    assert decode_access_token("not-a-jwt") is None
