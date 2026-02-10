# type: ignore

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user_room as user_room_crud
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse

router = APIRouter()


@router.get("/rooms/{room_id}/messages", response_model=list[MessageResponse])
async def get_room_messages(
    room_id: int,
    limit: int = 50,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get recent messages for a room.

    Requires authentication and room membership. Returns up to 'limit' most recent messages (default 50).
    """
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

    messages = await message_crud.get_messages_by_room(db, room_id, limit)

    return [
        MessageResponse(
            id=msg.id,
            room_id=msg.room_id,
            user_id=msg.user_id,
            username=msg.user.username,  # loaded via selectinload
            content=msg.content,
            created_at=msg.created_at,
        )
        for msg in messages
    ]


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
