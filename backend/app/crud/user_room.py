from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_room import UserRoom


async def get_user_room(db: AsyncSession, user_id: int, room_id: int):
    """Get user_room record for a specific user and room."""
    result = await db.execute(
        select(UserRoom).where(
            UserRoom.user_id == user_id, UserRoom.room_id == room_id
        )
    )
    return result.scalar_one_or_none()


async def mark_room_read(db: AsyncSession, user_id: int, room_id: int):
    """
    Mark a room as read for a user.

    IMPORTANT: Only updates existing memberships. Does NOT create membership
    if it doesn't exist. User must join room first via POST /api/rooms/:id/join.

    Returns:
        UserRoom model instance (updated)

    Raises:
        ValueError: If user is not a member of the room
    """
    now = datetime.now(timezone.utc)

    user_room = await get_user_room(db, user_id, room_id)

    if user_room:
        user_room.last_read_at = now  # type: ignore[assignment]
        await db.commit()
        await db.refresh(user_room)
        return user_room
    else:
        raise ValueError(
            f"User {user_id} is not a member of room {room_id}. Join the room first."
        )


async def get_unread_count(db: AsyncSession, user_id: int, room_id: int) -> int:
    """
    Calculate unread message count for a user in a room.

    Logic:
    - If user_room.last_read_at is NULL: count ALL messages in room
    - Otherwise: count messages where created_at > last_read_at
    """
    from app.models.message import Message

    user_room = await get_user_room(db, user_id, room_id)

    if user_room and user_room.last_read_at:  # type: ignore[truthy-bool]
        # User has read before — count messages after last_read_at
        result = await db.execute(
            select(func.count(Message.id)).where(
                Message.room_id == room_id,
                Message.created_at > user_room.last_read_at,
            )
        )
    else:
        # User never read OR no user_room record — count ALL messages
        result = await db.execute(
            select(func.count(Message.id)).where(Message.room_id == room_id)
        )

    return result.scalar_one()
