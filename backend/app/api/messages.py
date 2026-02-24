from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user_room as user_room_crud
from app.models.user import User
from app.schemas.message import (
    MessageContextResponse,
    MessageCreate,
    MessageResponse,
    MessageUpdate,
    PaginatedMessages,
)
from app.utils.cursor import decode_cursor, encode_cursor
from app.websocket.connection_manager import manager
from app.websocket.schemas import (
    WSDeletedMessage,
    WSEditedMessage,
    WSMessageDeleted,
    WSMessageEdited,
)

router = APIRouter()


@router.get("/rooms/{room_id}/messages/search", response_model=PaginatedMessages)
@limiter.limit("120/minute")
async def search_room_messages(
    request: Request,
    room_id: int,
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(default=20, ge=1, le=50),
    cursor: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search messages in a room using full-text search.

    Requires authentication and room membership. Uses Postgres tsvector
    matching with stemming (e.g. "running" matches "run").

    Args:
        room_id: Room to search within
        q: Search query (1-200 chars, plain text)
        limit: Number of results to return (1-50, default 20)
        cursor: Optional cursor for pagination

    Raises:
        400: Invalid cursor format
        403: Not a member of the room
        404: Room not found
        422: Invalid query parameter (empty or too long)
    """
    # Validate room exists
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Validate user is a member of the room
    membership = await user_room_crud.get_user_room(db, current_user.id, room_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    # Decode cursor if provided
    before_created_at = None
    before_id = None
    if cursor:
        try:
            before_created_at, before_id = decode_cursor(cursor)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid cursor: {str(e)}",
            ) from e

    # Trim the query — whitespace-only input shouldn't produce results
    search_query = q.strip()
    if not search_query:
        return PaginatedMessages(messages=[], next_cursor=None)

    # Fetch limit + 1 to detect if there are more results
    messages = await message_crud.search_messages(
        db, room_id, search_query, limit + 1, before_created_at, before_id
    )

    # Determine if there are more results
    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    # Build response — same pattern as get_room_messages
    response_messages = []
    for msg in messages:
        msg_id: int = msg.id  # type: ignore[assignment]
        msg_room_id: int = msg.room_id  # type: ignore[assignment]
        msg_user_id: int = msg.user_id  # type: ignore[assignment]
        msg_content: str = msg.content  # type: ignore[assignment]
        msg_created_at: datetime = msg.created_at  # type: ignore[assignment]
        msg_edited_at: datetime | None = msg.edited_at  # type: ignore[assignment]
        msg_deleted_at: datetime | None = msg.deleted_at  # type: ignore[assignment]
        msg_username: str = msg.user.username  # type: ignore[union-attr]

        response_messages.append(
            MessageResponse(
                id=msg_id,
                room_id=msg_room_id,
                user_id=msg_user_id,
                username=msg_username,
                content=msg_content,
                created_at=msg_created_at,
                edited_at=msg_edited_at,
                deleted_at=msg_deleted_at,
            )
        )

    # Create next_cursor if there are more results
    next_cursor = None
    if has_more and messages:
        last_message = messages[-1]
        cursor_created_at: datetime = last_message.created_at  # type: ignore[assignment]
        cursor_id: int = last_message.id  # type: ignore[assignment]
        next_cursor = encode_cursor(cursor_created_at, cursor_id)

    return PaginatedMessages(messages=response_messages, next_cursor=next_cursor)


@router.get("/rooms/{room_id}/messages", response_model=PaginatedMessages)
async def get_room_messages(
    room_id: int,
    limit: int = Query(default=50, ge=1, le=100),
    cursor: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get recent messages for a room with cursor-based pagination.

    Requires authentication and room membership. Returns paginated messages
    with a cursor for fetching older messages.

    Args:
        room_id: Room to fetch messages from
        limit: Number of messages to return (1-100, default 50)
        cursor: Optional cursor for pagination (fetches messages before this cursor)

    Returns:
        PaginatedMessages with messages and next_cursor (null if no more messages)

    Raises:
        400: Invalid cursor format
        403: Not a member of the room
        404: Room not found
    """
    # Validate room exists
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Validate user is a member of the room
    membership = await user_room_crud.get_user_room(db, current_user.id, room_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    # Decode cursor if provided
    before_created_at = None
    before_id = None
    if cursor:
        try:
            before_created_at, before_id = decode_cursor(cursor)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid cursor: {str(e)}",
            ) from e

    # Fetch limit + 1 to detect if there are more messages
    # The extra message tells us whether to include next_cursor
    messages = await message_crud.get_messages_by_room(
        db, room_id, limit + 1, before_created_at, before_id
    )

    # Determine if there are more messages (has_more)
    has_more = len(messages) > limit
    if has_more:
        # Trim to the requested limit
        messages = messages[:limit]

    # Build response messages
    # We need to manually construct MessageResponse to include username from the relationship
    # Cannot use model_validate(msg) directly because username isn't a Message column
    response_messages = []
    for msg in messages:
        # Access attributes and assign to variables to help mypy infer correct types
        msg_id: int = msg.id  # type: ignore[assignment]
        msg_room_id: int = msg.room_id  # type: ignore[assignment]
        msg_user_id: int = msg.user_id  # type: ignore[assignment]
        msg_content: str = msg.content  # type: ignore[assignment]
        msg_created_at: datetime = msg.created_at  # type: ignore[assignment]
        msg_edited_at: datetime | None = msg.edited_at  # type: ignore[assignment]
        msg_deleted_at: datetime | None = msg.deleted_at  # type: ignore[assignment]
        msg_username: str = msg.user.username  # type: ignore[union-attr]

        response_messages.append(
            MessageResponse(
                id=msg_id,
                room_id=msg_room_id,
                user_id=msg_user_id,
                username=msg_username,
                content=msg_content,
                created_at=msg_created_at,
                edited_at=msg_edited_at,
                deleted_at=msg_deleted_at,
            )
        )

    # Create next_cursor if there are more messages
    # The cursor points to the last message we're returning, so the next
    # fetch will get messages strictly older than this one
    next_cursor = None
    if has_more and messages:
        last_message = messages[-1]
        # Extract values for cursor encoding (type: ignore for SQLAlchemy Column types)
        cursor_created_at: datetime = last_message.created_at  # type: ignore[assignment]
        cursor_id: int = last_message.id  # type: ignore[assignment]
        next_cursor = encode_cursor(cursor_created_at, cursor_id)

    return PaginatedMessages(messages=response_messages, next_cursor=next_cursor)


@router.get("/rooms/{room_id}/messages/newer", response_model=PaginatedMessages)
async def get_room_messages_newer(
    room_id: int,
    cursor: str,
    limit: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages newer than a cursor (ascending order) for context mode."""
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    membership = await user_room_crud.get_user_room(db, current_user.id, room_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    try:
        after_created_at, after_id = decode_cursor(cursor)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid cursor: {str(e)}",
        ) from e

    messages = await message_crud.get_messages_newer_than(
        db,
        room_id,
        limit + 1,
        after_created_at,
        after_id,
    )

    has_more = len(messages) > limit
    if has_more:
        messages = messages[:limit]

    response_messages = []
    for msg in messages:
        msg_id: int = msg.id  # type: ignore[assignment]
        msg_room_id: int = msg.room_id  # type: ignore[assignment]
        msg_user_id: int = msg.user_id  # type: ignore[assignment]
        msg_content: str = msg.content  # type: ignore[assignment]
        msg_created_at: datetime = msg.created_at  # type: ignore[assignment]
        msg_edited_at: datetime | None = msg.edited_at  # type: ignore[assignment]
        msg_deleted_at: datetime | None = msg.deleted_at  # type: ignore[assignment]
        msg_username: str = msg.user.username  # type: ignore[union-attr]

        response_messages.append(
            MessageResponse(
                id=msg_id,
                room_id=msg_room_id,
                user_id=msg_user_id,
                username=msg_username,
                content=msg_content,
                created_at=msg_created_at,
                edited_at=msg_edited_at,
                deleted_at=msg_deleted_at,
            )
        )

    next_cursor = None
    if has_more and messages:
        last_message = messages[-1]
        cursor_created_at: datetime = last_message.created_at  # type: ignore[assignment]
        cursor_id: int = last_message.id  # type: ignore[assignment]
        next_cursor = encode_cursor(cursor_created_at, cursor_id)

    return PaginatedMessages(messages=response_messages, next_cursor=next_cursor)


@router.get(
    "/rooms/{room_id}/messages/{message_id}/context",
    response_model=MessageContextResponse,
)
async def get_room_message_context(
    room_id: int,
    message_id: int,
    before: int = Query(default=25, ge=0, le=100),
    after: int = Query(default=25, ge=0, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Load a context window around a target message for jump-to-message UX."""
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    membership = await user_room_crud.get_user_room(db, current_user.id, room_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    target = await message_crud.get_message_in_room(db, room_id, message_id)
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found in room"
        )

    target_created_at: datetime = target.created_at  # type: ignore[assignment]
    target_id: int = target.id  # type: ignore[assignment]

    older_desc = await message_crud.get_messages_by_room(
        db,
        room_id,
        before + 1,
        target_created_at,
        target_id,
    )
    has_more_older = len(older_desc) > before
    if has_more_older:
        older_desc = older_desc[:before]
    older_asc = list(reversed(older_desc))

    newer_asc = await message_crud.get_messages_newer_than(
        db,
        room_id,
        after + 1,
        target_created_at,
        target_id,
    )
    has_more_newer = len(newer_asc) > after
    if has_more_newer:
        newer_asc = newer_asc[:after]

    window_messages = [*older_asc, target, *newer_asc]

    response_messages = []
    for msg in window_messages:
        msg_id: int = msg.id  # type: ignore[assignment]
        msg_room_id: int = msg.room_id  # type: ignore[assignment]
        msg_user_id: int = msg.user_id  # type: ignore[assignment]
        msg_content: str = msg.content  # type: ignore[assignment]
        msg_created_at: datetime = msg.created_at  # type: ignore[assignment]
        msg_edited_at: datetime | None = msg.edited_at  # type: ignore[assignment]
        msg_deleted_at: datetime | None = msg.deleted_at  # type: ignore[assignment]
        msg_username: str = msg.user.username  # type: ignore[union-attr]

        response_messages.append(
            MessageResponse(
                id=msg_id,
                room_id=msg_room_id,
                user_id=msg_user_id,
                username=msg_username,
                content=msg_content,
                created_at=msg_created_at,
                edited_at=msg_edited_at,
                deleted_at=msg_deleted_at,
            )
        )

    older_cursor = None
    if has_more_older and window_messages:
        oldest_loaded = window_messages[0]
        oldest_created_at: datetime = oldest_loaded.created_at  # type: ignore[assignment]
        oldest_id: int = oldest_loaded.id  # type: ignore[assignment]
        older_cursor = encode_cursor(oldest_created_at, oldest_id)

    newer_cursor = None
    if has_more_newer and window_messages:
        newest_loaded = window_messages[-1]
        newest_created_at: datetime = newest_loaded.created_at  # type: ignore[assignment]
        newest_id: int = newest_loaded.id  # type: ignore[assignment]
        newer_cursor = encode_cursor(newest_created_at, newest_id)

    return MessageContextResponse(
        messages=response_messages,
        target_message_id=target_id,
        older_cursor=older_cursor,
        newer_cursor=newer_cursor,
    )


@router.post(
    "/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
@limiter.limit("30/minute")
async def create_message(
    request: Request,
    message: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message to a room.

    Requires authentication and room membership. User ID is set from JWT token.
    """
    room = await room_crud.get_room_by_id(db, message.room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    membership = await user_room_crud.get_user_room(
        db, current_user.id, message.room_id
    )
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    db_message = await message_crud.create_message(db, message, current_user.id)

    return MessageResponse(
        id=db_message.id,
        room_id=db_message.room_id,
        user_id=db_message.user_id,
        username=current_user.username,
        content=db_message.content,
        created_at=db_message.created_at,
        edited_at=db_message.edited_at,
        deleted_at=db_message.deleted_at,
    )


@router.patch("/messages/{message_id}", response_model=MessageResponse)
@limiter.limit("20/minute")
async def edit_message(
    request: Request,
    message_id: int,
    message: MessageUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit message content when caller is the message owner."""
    db_message = await message_crud.get_message_by_id(db, message_id)
    if not db_message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found",
        )

    message_room_id: int = db_message.room_id  # type: ignore[assignment]
    message_owner_id: int = db_message.user_id  # type: ignore[assignment]
    message_deleted_at: datetime | None = db_message.deleted_at  # type: ignore[assignment]
    current_user_id: int = current_user.id

    membership = await user_room_crud.get_user_room(db, current_user_id, message_room_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room",
        )

    if current_user_id != message_owner_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to edit this message",
        )

    if message_deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot edit a deleted message",
        )

    message_content: str = db_message.content  # type: ignore[assignment]
    if message.content == message_content:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Edited content must be different",
        )

    updated_message = await message_crud.edit_message_content(
        db,
        db_message,
        message.content,
    )

    updated_message_id: int = updated_message.id  # type: ignore[assignment]
    updated_room_id: int = updated_message.room_id  # type: ignore[assignment]
    updated_content: str = updated_message.content  # type: ignore[assignment]
    updated_created_at: datetime = updated_message.created_at  # type: ignore[assignment]
    updated_edited_at: datetime = updated_message.edited_at  # type: ignore[assignment]
    updated_deleted_at: datetime | None = updated_message.deleted_at  # type: ignore[assignment]
    updated_user_id: int = updated_message.user_id  # type: ignore[assignment]

    payload = WSMessageEdited(
        type="message_edited",
        message=WSEditedMessage(
            id=updated_message_id,
            room_id=updated_room_id,
            content=updated_content,
            edited_at=updated_edited_at,
        ),
    )
    await manager.broadcast_to_room(
        updated_room_id,
        payload.model_dump(mode="json"),
    )

    return MessageResponse(
        id=updated_message_id,
        room_id=updated_room_id,
        user_id=updated_user_id,
        username=current_user.username,
        content=updated_content,
        created_at=updated_created_at,
        edited_at=updated_edited_at,
        deleted_at=updated_deleted_at,
    )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/minute")
async def delete_message(
    request: Request,
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Soft-delete a message when caller is owner or room creator."""
    db_message = await message_crud.get_message_by_id(db, message_id)
    if not db_message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Message not found"
        )

    message_room_id: int = db_message.room_id  # type: ignore[assignment]
    message_owner_id: int = db_message.user_id  # type: ignore[assignment]

    room = await room_crud.get_room_by_id(db, message_room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    membership = await user_room_crud.get_user_room(db, current_user.id, message_room_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    room_creator_id: int = room.created_by  # type: ignore[assignment]
    current_user_id: int = current_user.id
    can_delete = (
        current_user_id == message_owner_id or current_user_id == room_creator_id
    )
    if not can_delete:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this message",
        )

    message_deleted_at: datetime | None = db_message.deleted_at  # type: ignore[assignment]
    if message_deleted_at is None:
        deleted_message = await message_crud.soft_delete_message(db, db_message)
        deleted_message_id: int = deleted_message.id  # type: ignore[assignment]
        deleted_message_room_id: int = deleted_message.room_id  # type: ignore[assignment]
        deleted_message_deleted_at: datetime = deleted_message.deleted_at  # type: ignore[assignment]

        payload = WSMessageDeleted(
            type="message_deleted",
            message=WSDeletedMessage(
                id=deleted_message_id,
                room_id=deleted_message_room_id,
                deleted_at=deleted_message_deleted_at,
            ),
        )
        await manager.broadcast_to_room(
            deleted_message_room_id,
            payload.model_dump(mode="json"),
        )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
