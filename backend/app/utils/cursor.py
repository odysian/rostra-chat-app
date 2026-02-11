"""Cursor encoding/decoding utilities for pagination.

Cursors are opaque tokens that encode a position in a result set.
For message pagination, we use (created_at, id) as the cursor pair.
"""

import base64
import json
from datetime import datetime


def encode_cursor(created_at: datetime, message_id: int) -> str:
    """Encode a cursor for pagination.

    Args:
        created_at: The timestamp of the message
        message_id: The ID of the message

    Returns:
        Base64-encoded cursor string

    Note:
        The cursor is not a security boundary — it's a pagination token.
        We use base64 encoding to make it opaque (clients shouldn't parse it),
        not for security.
    """
    cursor_data = {
        "created_at": created_at.isoformat(),
        "id": message_id,
    }
    json_str = json.dumps(cursor_data)
    encoded = base64.urlsafe_b64encode(json_str.encode("utf-8"))
    return encoded.decode("utf-8")


def decode_cursor(cursor: str) -> tuple[datetime, int]:
    """Decode a cursor to extract (created_at, id) pair.

    Args:
        cursor: Base64-encoded cursor string

    Returns:
        Tuple of (created_at, message_id)

    Raises:
        ValueError: If cursor is malformed, has missing fields, or invalid values
    """
    try:
        # Decode base64
        decoded = base64.urlsafe_b64decode(cursor.encode("utf-8"))
        cursor_data = json.loads(decoded.decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ValueError(f"Invalid cursor format: {e}") from e

    # Validate required fields exist
    if "created_at" not in cursor_data or "id" not in cursor_data:
        raise ValueError("Cursor missing required fields (created_at, id)")

    # Parse and validate timestamp
    try:
        created_at = datetime.fromisoformat(cursor_data["created_at"])
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid timestamp in cursor: {e}") from e

    # Validate ID is a positive integer
    try:
        message_id = int(cursor_data["id"])
        if message_id <= 0:
            raise ValueError("Message ID must be positive")
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid message ID in cursor: {e}") from e

    return created_at, message_id
