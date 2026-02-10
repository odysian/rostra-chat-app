"""
Factory fixtures for creating test data.

Provides convenient fixtures to create users, rooms, and messages
with proper relationships and authentication tokens.

These factories deliberately bypass the HTTP auth/room/message endpoints
where it would cause rate limiting to interfere with unrelated tests.
We still test the HTTP endpoints directly in the dedicated tests.
"""

import pytest
from app.core.security import create_access_token
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user as user_crud
from app.schemas.message import MessageCreate
from app.schemas.room import RoomCreate
from app.schemas.user import UserCreate
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.fixture
def create_user(db_session: AsyncSession):
    """
    Factory fixture to create a user directly in the database.

    This avoids hitting the /api/auth/register and /api/auth/login endpoints,
    so tests using this fixture are not affected by SlowAPI rate limits.

    Returns a callable that creates a user and returns:
        dict with keys: user (dict), access_token (str), db_user (User model)
    """

    async def _create_user(
        email: str = "test@example.com",
        username: str = "testuser",
        password: str = "testpass123",
    ):
        # Create user via async CRUD (handles hashing, uniqueness, etc.)
        user_in = UserCreate(email=email, username=username, password=password)
        db_user = await user_crud.create_user(db_session, user_in)

        # Issue an access token for this user
        access_token = create_access_token({"sub": str(db_user.id)})

        # Shape user dict similar to API response
        user_data = {
            "id": db_user.id,
            "email": db_user.email,
            "username": db_user.username,
            "created_at": (
                db_user.created_at.isoformat()
                if getattr(db_user, "created_at", None)
                else None
            ),
        }

        return {
            "user": user_data,
            "access_token": access_token,
            "db_user": db_user,
        }

    return _create_user


@pytest.fixture
def create_room(db_session: AsyncSession):
    """
    Factory fixture to create a room directly in the database.

    Returns a callable that creates a room and returns a RoomResponse-like dict.
    """

    async def _create_room(creator_token: str, name: str = "Test Room"):
        # Decode user id from token
        from app.core.security import decode_access_token

        user_id_str = decode_access_token(creator_token)
        assert user_id_str is not None
        user_id = int(user_id_str)

        room_in = RoomCreate(name=name)
        db_room = await room_crud.create_room(db_session, room_in, user_id)

        return {
            "id": db_room.id,
            "name": db_room.name,
            "created_by": db_room.created_by,
            "created_at": (
                db_room.created_at.isoformat()
                if getattr(db_room, "created_at", None)
                else None
            ),
        }

    return _create_room


@pytest.fixture
def create_message(db_session: AsyncSession):
    """
    Factory fixture to create a message directly in the database.

    Returns a callable that creates a message and returns a MessageResponse-like dict.
    """

    async def _create_message(user_token: str, room_id: int, content: str = "Test message"):
        from app.core.security import decode_access_token

        user_id_str = decode_access_token(user_token)
        assert user_id_str is not None
        user_id = int(user_id_str)

        msg_in = MessageCreate(room_id=room_id, content=content)
        db_message = await message_crud.create_message(db_session, msg_in, user_id)

        return {
            "id": db_message.id,
            "room_id": db_message.room_id,
            "user_id": db_message.user_id,
            "content": db_message.content,
            "created_at": (
                db_message.created_at.isoformat()
                if getattr(db_message, "created_at", None)
                else None
            ),
        }

    return _create_message
