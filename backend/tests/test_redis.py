from app.core.redis import _redact_redis_url_for_logs


def test_redact_redis_url_hides_password_only_credentials():
    redacted = _redact_redis_url_for_logs("redis://:secret@localhost:6379/0")

    assert redacted == "redis://:***@localhost:6379/0"
    assert "secret" not in redacted


def test_redact_redis_url_hides_username_password_credentials():
    redacted = _redact_redis_url_for_logs("redis://chatuser:secret@localhost:6379/0")

    assert redacted == "redis://chatuser:***@localhost:6379/0"
    assert "secret" not in redacted


def test_redact_redis_url_leaves_non_auth_url_unchanged():
    url = "redis://localhost:6379/0"

    assert _redact_redis_url_for_logs(url) == url
