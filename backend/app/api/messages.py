from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user_room as user_room_crud
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse, PaginatedMessages
from app.utils.cursor import decode_cursor, encode_cursor

router = APIRouter()


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
        msg_username: str = msg.user.username  # type: ignore[union-attr]

        response_messages.append(
            MessageResponse(
                id=msg_id,
                room_id=msg_room_id,
                user_id=msg_user_id,
                username=msg_username,
                content=msg_content,
                created_at=msg_created_at,
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


@router.post(
    "/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED
)
async def create_message(
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
    )
