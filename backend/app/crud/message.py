from datetime import datetime

from sqlalchemy import and_, func, or_, select
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


async def get_message_in_room(
    db: AsyncSession,
    room_id: int,
    message_id: int,
) -> Message | None:
    """Get a single message by ID, scoped to a room."""
    stmt = (
        select(Message)
        .options(selectinload(Message.user))
        .where(
            Message.room_id == room_id,
            Message.id == message_id,
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


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


async def search_messages(
    db: AsyncSession,
    room_id: int,
    query: str,
    limit: int = 20,
    before_created_at: datetime | None = None,
    before_id: int | None = None,
) -> list[Message]:
    """Search messages in a room using Postgres full-text search.

    Uses plainto_tsquery to safely parse user input (no special syntax required).
    Results are ordered by recency (most recent first), matching the UX
    expectation for chat apps where users typically want "what was said recently
    about X". This also allows Postgres to use the existing composite index
    on (room_id, created_at DESC, id DESC) instead of sorting in memory.

    Args:
        db: Async database session
        room_id: Room to search within
        query: User's search text (plain English, not tsquery syntax)
        limit: Maximum results to return (default 20)
        before_created_at: Cursor timestamp for pagination
        before_id: Cursor ID for pagination

    Returns:
        List of Message objects with user relationship loaded, ordered by
        created_at DESC, id DESC.
    """
    ts_query = func.plainto_tsquery("english", query)

    stmt = (
        select(Message)
        .options(selectinload(Message.user))
        .where(
            Message.room_id == room_id,
            Message.search_vector.op("@@")(ts_query),
        )
    )

    # Cursor pagination — same pattern as get_messages_by_room
    if before_created_at is not None and before_id is not None:
        stmt = stmt.where(
            or_(
                Message.created_at < before_created_at,
                and_(
                    Message.created_at == before_created_at,
                    Message.id < before_id,
                ),
            )
        )

    # Order by recency — most recent matching messages first.
    # Chat search is temporal: "what did someone say about X recently?"
    # This also uses the existing (room_id, created_at DESC, id DESC) index.
    stmt = stmt.order_by(
        Message.created_at.desc(),
        Message.id.desc(),
    ).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_messages_newer_than(
    db: AsyncSession,
    room_id: int,
    limit: int = 50,
    after_created_at: datetime | None = None,
    after_id: int | None = None,
) -> list[Message]:
    """Get messages newer than a keyset cursor in ascending order.

    Ascending order is intentional for context-mode pagination:
    appending older->newer avoids reordering on the frontend.
    """
    stmt = (
        select(Message)
        .options(selectinload(Message.user))
        .where(Message.room_id == room_id)
    )

    if after_created_at is not None and after_id is not None:
        stmt = stmt.where(
            or_(
                Message.created_at > after_created_at,
                and_(
                    Message.created_at == after_created_at,
                    Message.id > after_id,
                ),
            )
        )

    stmt = stmt.order_by(Message.created_at.asc(), Message.id.asc()).limit(limit)

    result = await db.execute(stmt)
    return list(result.scalars().all())
