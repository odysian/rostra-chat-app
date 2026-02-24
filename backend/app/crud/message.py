from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import and_, case, delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.message import Message
from app.models.message_reaction import MessageReaction
from app.schemas.message import (
    REACTION_EMOJI_ALLOWLIST,
    MessageCreate,
    MessageReactionSummary,
)


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


async def get_message_by_id(db: AsyncSession, message_id: int) -> Message | None:
    """Get a single message by ID."""
    stmt = select(Message).where(Message.id == message_id)
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


async def soft_delete_message(db: AsyncSession, message: Message) -> Message:
    """Soft-delete a message by scrubbing content and setting deleted_at."""
    message.content = ""
    message.deleted_at = datetime.now(UTC)
    # Deleting reactions on soft-delete enforces non-reactable tombstones.
    await db.execute(delete(MessageReaction).where(MessageReaction.message_id == message.id))
    await db.commit()
    await db.refresh(message)
    return message


async def edit_message_content(
    db: AsyncSession,
    message: Message,
    content: str,
) -> Message:
    """Update message content and stamp edited_at."""
    message.content = content
    message.edited_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(message)
    return message


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
            Message.deleted_at.is_(None),
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


async def get_reaction_summaries_for_message_ids(
    db: AsyncSession,
    message_ids: list[int],
    current_user_id: int,
) -> dict[int, list[MessageReactionSummary]]:
    """Return aggregated reaction summaries keyed by message id."""
    if not message_ids:
        return {}

    stmt = (
        select(
            MessageReaction.message_id,
            MessageReaction.emoji,
            func.count(MessageReaction.id).label("count"),
            func.max(
                case((MessageReaction.user_id == current_user_id, 1), else_=0)
            ).label("reacted_by_me"),
        )
        .where(MessageReaction.message_id.in_(message_ids))
        .group_by(MessageReaction.message_id, MessageReaction.emoji)
    )
    result = await db.execute(stmt)

    emoji_order = {
        emoji: index for index, emoji in enumerate(REACTION_EMOJI_ALLOWLIST)
    }
    summaries_by_message: dict[int, list[MessageReactionSummary]] = defaultdict(list)
    for message_id, emoji, count, reacted_by_me in result.all():
        emoji_value = str(emoji)
        if emoji_value not in emoji_order:
            continue
        summaries_by_message[int(message_id)].append(
            MessageReactionSummary(
                emoji=emoji_value,  # type: ignore[arg-type]
                count=int(count),
                reacted_by_me=bool(reacted_by_me),
            )
        )

    for message_summary in summaries_by_message.values():
        message_summary.sort(
            key=lambda summary: (
                -summary.count,
                emoji_order.get(summary.emoji, len(emoji_order)),
            )
        )

    return dict(summaries_by_message)


async def add_message_reaction(
    db: AsyncSession,
    message_id: int,
    user_id: int,
    emoji: str,
) -> bool:
    """Add reaction row if missing. Returns True when a new row was created."""
    existing_stmt = select(MessageReaction).where(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == user_id,
        MessageReaction.emoji == emoji,
    )
    existing = await db.execute(existing_stmt)
    if existing.scalar_one_or_none():
        return False

    db.add(
        MessageReaction(
            message_id=message_id,
            user_id=user_id,
            emoji=emoji,
        )
    )
    await db.commit()
    return True


async def remove_message_reaction(
    db: AsyncSession,
    message_id: int,
    user_id: int,
    emoji: str,
) -> bool:
    """Remove caller-owned reaction row. Returns True when deleted."""
    stmt = select(MessageReaction).where(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == user_id,
        MessageReaction.emoji == emoji,
    )
    result = await db.execute(stmt)
    reaction = result.scalar_one_or_none()
    if reaction is None:
        return False

    await db.delete(reaction)
    await db.commit()
    return True


async def get_reaction_count_for_emoji(
    db: AsyncSession,
    message_id: int,
    emoji: str,
) -> int:
    """Get current aggregate count for one emoji on a message."""
    stmt = select(func.count(MessageReaction.id)).where(
        MessageReaction.message_id == message_id,
        MessageReaction.emoji == emoji,
    )
    result = await db.execute(stmt)
    return int(result.scalar_one())
