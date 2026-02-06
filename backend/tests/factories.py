"""
Factory fixtures for creating test data.

Provides convenient fixtures to create users, rooms, and messages
with proper relationships and authentication tokens.

These factories deliberately bypass the HTTP auth/room/message endpoints
where it would cause rate limiting to interfere with unrelated tests.
We still test the HTTP endpoints directly in the dedicated tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user as user_crud
from app.schemas.message import MessageCreate
from app.schemas.room import RoomCreate
from app.schemas.user import UserCreate


@pytest.fixture
def create_user(db_session: Session):
    """
    Factory fixture to create a user directly in the database.

    This avoids hitting the /api/auth/register and /api/auth/login endpoints,
    so tests using this fixture are not affected by SlowAPI rate limits.

    Args:
        email: User email (default: "test@example.com")
        username: Username (default: "testuser")
        password: Password (default: "testpass123")

    Returns:
        dict with keys: user (dict), access_token (str), db_user (User model)
    """

    def _create_user(
        email: str = "test@example.com",
        username: str = "testuser",
        password: str = "testpass123",
    ):
        # Create user via CRUD (handles hashing, uniqueness, etc.)
        user_in = UserCreate(email=email, username=username, password=password)
        db_user = user_crud.create_user(db_session, user_in)

        # Issue an access token for this user
        access_token = create_access_token({"sub": str(db_user.id)})

        # Shape user dict similar to API response
        user_data = {
            "id": db_user.id,
            "email": db_user.email,
            "username": db_user.username,
            "created_at": db_user.created_at.isoformat()
            if getattr(db_user, "created_at", None)
            else None,
        }

        return {
            "user": user_data,
            "access_token": access_token,
            "db_user": db_user,
        }

    return _create_user


@pytest.fixture
def create_room(db_session: Session):
    """
    Factory fixture to create a room directly in the database.

    Args:
        creator_token: Access token of the user creating the room (not used here)
        name: Room name (default: "Test Room")

    Returns:
        RoomResponse-like dict with room data
    """

    def _create_room(creator_token: str, name: str = "Test Room"):
        # Decode user id from token
        # We only need the user id for created_by; HTTP auth is not involved.
        from app.core.security import decode_access_token

        user_id_str = decode_access_token(creator_token)
        assert user_id_str is not None
        user_id = int(user_id_str)

        room_in = RoomCreate(name=name)
        db_room = room_crud.create_room(db_session, room_in, user_id)

        return {
            "id": db_room.id,
            "name": db_room.name,
            "created_by": db_room.created_by,
            "created_at": db_room.created_at.isoformat()
            if getattr(db_room, "created_at", None)
            else None,
        }

    return _create_room


@pytest.fixture
def create_message(db_session: Session):
    """
    Factory fixture to create a message directly in the database.

    Args:
        user_token: Access token of the user sending the message
        room_id: ID of the room
        content: Message content (default: "Test message")

    Returns:
        MessageResponse-like dict with message data
    """

    def _create_message(user_token: str, room_id: int, content: str = "Test message"):
        from app.core.security import decode_access_token

        user_id_str = decode_access_token(user_token)
        assert user_id_str is not None
        user_id = int(user_id_str)

        msg_in = MessageCreate(room_id=room_id, content=content)
        db_message = message_crud.create_message(db_session, msg_in, user_id)

        return {
            "id": db_message.id,
            "room_id": db_message.room_id,
            "user_id": db_message.user_id,
            "content": db_message.content,
            "created_at": db_message.created_at.isoformat()
            if getattr(db_message, "created_at", None)
            else None,
        }

    return _create_message
