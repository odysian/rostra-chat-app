from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import Message
from app.schemas.message import MessageCreate


async def get_messages_by_room(
    db: AsyncSession,
    room_id: int,
    limit: int = 50,
    before_created_at: datetime | None = None,
    before_id: int | None = None,
) -> list[Message]:
    """
    Get recent messages for a room with username included.

    Supports cursor-based pagination for infinite scroll. When cursor
    parameters are provided, fetches messages strictly older than the
    cursor position.

    Uses selectinload (not joinedload) for the user relationship.
    In async SQLAlchemy, joinedload can trigger implicit lazy-loading
    which raises errors. selectinload issues a separate SELECT instead.

    Args:
        db: Async database session
        room_id: Room ID to get messages from
        limit: Maximum number of messages to return (default 50)
        before_created_at: Cursor timestamp - fetch messages before this time
        before_id: Cursor ID - tiebreaker for messages with same timestamp

    Returns:
        List of Message objects (with user relationship loaded), ordered
        by created_at DESC, id DESC. May return up to limit messages.

    Note:
        Both cursor parameters must be provided together or not at all.
        The cursor pair (created_at, id) implements keyset pagination,
        which remains stable even as new messages are inserted.
    """
    # Build base query
    query = (
        select(Message)
        .options(selectinload(Message.user))
        .where(Message.room_id == room_id)
    )

    # Apply cursor filter if provided
    # This implements keyset pagination: fetch messages older than the cursor
    # The OR condition handles the composite key (created_at, id):
    #   - Messages with earlier timestamps, OR
    #   - Messages with same timestamp but lower ID (tiebreaker)
    if before_created_at is not None and before_id is not None:
        query = query.where(
            or_(
                Message.created_at < before_created_at,
                and_(
                    Message.created_at == before_created_at,
                    Message.id < before_id,
                ),
            )
        )

    # Order by both created_at and id for stable sorting
    # The composite index (room_id, created_at DESC, id DESC) makes this efficient
    query = query.order_by(Message.created_at.desc(), Message.id.desc()).limit(limit)

    result = await db.execute(query)
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
