"""
Tests for cursor encoding/decoding utility.

All tests follow the TESTPLAN.md specification exactly.
"""

import base64
import json
from datetime import UTC, datetime

import pytest

from app.utils.cursor import decode_cursor, encode_cursor


def test_encode_decode_roundtrip_preserves_values():
    """Encoding and decoding a cursor preserves timestamp and ID."""
    # Create a timestamp with microsecond precision
    original_timestamp = datetime(2024, 1, 15, 12, 30, 45, 123456, tzinfo=UTC)
    original_id = 42

    # Encode then decode
    cursor = encode_cursor(original_timestamp, original_id)
    decoded_timestamp, decoded_id = decode_cursor(cursor)

    # Verify values are preserved
    assert decoded_timestamp == original_timestamp
    assert decoded_id == original_id


def test_decode_invalid_base64_raises_value_error():
    """Decoding invalid base64 raises ValueError."""
    invalid_cursor = "not-valid-base64!!!"

    with pytest.raises(ValueError) as exc_info:
        decode_cursor(invalid_cursor)

    assert "invalid cursor format" in str(exc_info.value).lower()


def test_decode_invalid_json_raises_value_error():
    """Decoding malformed JSON raises ValueError."""
    # Valid base64 but not valid JSON
    malformed_json = base64.urlsafe_b64encode(b"not json at all").decode("utf-8")

    with pytest.raises(ValueError) as exc_info:
        decode_cursor(malformed_json)

    assert "invalid cursor format" in str(exc_info.value).lower()


def test_decode_missing_fields_raises_value_error():
    """Decoding JSON missing required fields raises ValueError."""
    # Valid JSON but missing 'id' field
    incomplete_data = {"created_at": "2024-01-15T12:30:45.123456+00:00"}
    incomplete_cursor = base64.urlsafe_b64encode(
        json.dumps(incomplete_data).encode("utf-8")
    ).decode("utf-8")

    with pytest.raises(ValueError) as exc_info:
        decode_cursor(incomplete_cursor)

    assert "missing required field" in str(exc_info.value).lower()

    # Valid JSON but missing 'created_at' field
    incomplete_data_2 = {"id": 42}
    incomplete_cursor_2 = base64.urlsafe_b64encode(
        json.dumps(incomplete_data_2).encode("utf-8")
    ).decode("utf-8")

    with pytest.raises(ValueError) as exc_info:
        decode_cursor(incomplete_cursor_2)

    assert "missing required field" in str(exc_info.value).lower()


def test_decode_invalid_timestamp_format_raises_value_error():
    """Decoding invalid ISO timestamp raises ValueError."""
    # Valid JSON with invalid timestamp format
    invalid_timestamp_data = {
        "created_at": "not-a-valid-timestamp",
        "id": 42,
    }
    invalid_cursor = base64.urlsafe_b64encode(
        json.dumps(invalid_timestamp_data).encode("utf-8")
    ).decode("utf-8")

    with pytest.raises(ValueError) as exc_info:
        decode_cursor(invalid_cursor)

    assert "invalid timestamp" in str(exc_info.value).lower()


def test_encode_with_microseconds_precision():
    """Encoding preserves microsecond precision in timestamp."""
    # Timestamp with specific microsecond value
    timestamp_with_microseconds = datetime(2024, 1, 15, 12, 30, 45, 987654, tzinfo=UTC)
    message_id = 100

    cursor = encode_cursor(timestamp_with_microseconds, message_id)

    # Decode the cursor manually to inspect the raw data
    decoded_bytes = base64.urlsafe_b64decode(cursor)
    decoded_json = json.loads(decoded_bytes)

    # Verify microseconds are present in the ISO format string
    assert "987654" in decoded_json["created_at"]

    # Verify roundtrip preserves microseconds
    decoded_timestamp, decoded_id = decode_cursor(cursor)
    assert decoded_timestamp.microsecond == 987654
