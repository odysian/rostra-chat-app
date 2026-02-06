from datetime import datetime, timezone

from app.models.user_room import UserRoom
from sqlalchemy.orm import Session


def get_user_room(db: Session, user_id: int, room_id: int):
    """Get user_room record for a specific user and room."""
    return (
        db.query(UserRoom)
        .filter(UserRoom.user_id == user_id, UserRoom.room_id == room_id)
        .first()
    )


def mark_room_read(db: Session, user_id: int, room_id: int):
    """
    Mark a room as read for a user.

    IMPORTANT: Only updates existing memberships. Does NOT create membership
    if it doesn't exist. User must join room first via POST /api/rooms/:id/join.

    Args:
        db: Database session
        user_id: ID of the user
        room_id: ID of the room

    Returns:
        UserRoom model instance (updated)

    Raises:
        ValueError: If user is not a member of the room
    """
    now = datetime.now(timezone.utc)

    # Get existing record
    user_room = get_user_room(db, user_id, room_id)

    if user_room:
        # Update existing record
        user_room.last_read_at = now  # type: ignore[assignment]
        db.commit()
        db.refresh(user_room)
        return user_room
    else:
        # No membership found - user must join first
        raise ValueError(
            f"User {user_id} is not a member of room {room_id}. Join the room first."
        )


def get_unread_count(db: Session, user_id: int, room_id: int) -> int:
    """
    Calculate unread message count for a user in a room.

    Logic:
    - If user_room.last_read_at is NULL: count ALL messages in room
    - Otherwise: count messages where created_at > last_read_at

    Args:
        db: Database session
        user_id: ID of the user
        room_id: ID of the room

    Returns:
        Number of unread messages
    """
    from app.models.message import Message

    user_room = get_user_room(db, user_id, room_id)

    if user_room and user_room.last_read_at:  # type: ignore[truthy-bool]
        # User has read before - count messages after last_read_at
        unread_count = (
            db.query(Message)
            .filter(
                Message.room_id == room_id,
                Message.created_at > user_room.last_read_at,
            )
            .count()
        )
    else:
        # User never read OR no user_room record - count ALL messages
        unread_count = db.query(Message).filter(Message.room_id == room_id).count()

    return unread_count
