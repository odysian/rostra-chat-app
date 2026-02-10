from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import Message
from app.schemas.message import MessageCreate


async def get_messages_by_room(db: AsyncSession, room_id: int, limit: int = 50):
    """
    Get recent messages for a room with username included.

    Uses selectinload (not joinedload) for the user relationship.
    In async SQLAlchemy, joinedload can trigger implicit lazy-loading
    which raises errors. selectinload issues a separate SELECT instead.

    Args:
        db: Async database session
        room_id: Room ID to get messages from
        limit: Maximum number of messages to return (default 50)

    Returns:
        List of Message objects (with user relationship loaded)
    """
    result = await db.execute(
        select(Message)
        .options(selectinload(Message.user))
        .where(Message.room_id == room_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def create_message(db: AsyncSession, message: MessageCreate, user_id: int):
    """
    Create a new message.

    Args:
        db: Async database session
        message: MessageCreate schema with room_id and content
        user_id: ID of the user sending the message (from JWT)

    Returns:
        Created Message model instance
    """
    db_message = Message(
        room_id=message.room_id, user_id=user_id, content=message.content
    )
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    return db_message
