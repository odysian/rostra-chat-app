from datetime import datetime
from typing import List, cast

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.logging import logger
from app.core.rate_limit import limiter
from app.crud import room as room_crud
from app.crud import user_room as user_room_crud
from app.models.user import User
from app.schemas.room import RoomCreate, RoomResponse
from app.services.cache_service import UnreadCountCache
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/discover", response_model=List[RoomResponse])
@limiter.limit("30/minute")
async def discover_rooms(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all available public rooms for discovery/browsing.

    Returns all rooms regardless of membership status.
    Use this endpoint for a "Browse Rooms" or "Discover Rooms" feature
    where users can see all public rooms and choose which to join.

    Rate limited to 30 requests per minute to prevent abuse.

    Returns:
        List of all rooms in the system
    """
    rooms = await room_crud.get_all_rooms(db)
    return rooms


@router.get("", response_model=List[RoomResponse])
async def get_rooms(
    include_unread: bool = Query(
        False, description="Include unread message counts per room"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get rooms the current user is a member of.

    If include_unread=true, returns rooms with unread_count (uses Redis cache).
    Both paths filter by membership - only returns rooms user has joined.
    """

    if include_unread:
        unread_counts = await UnreadCountCache.get_unread_counts(
            current_user.id, db  # type: ignore[arg-type]
        )
        rooms = await room_crud.get_rooms_for_user(db, current_user.id)  # type: ignore
        return [
            RoomResponse(
                id=cast(int, room.id),
                name=cast(str, room.name),
                created_by=cast(int, room.created_by),
                created_at=cast(datetime, room.created_at),
                unread_count=unread_counts.get(cast(int, room.id), 0),
            )
            for room in rooms
        ]

    rooms = await room_crud.get_rooms_for_user(db, current_user.id)  # type: ignore
    return [
        RoomResponse(
            id=cast(int, room.id),
            name=cast(str, room.name),
            created_by=cast(int, room.created_by),
            created_at=cast(datetime, room.created_at),
        )
        for room in rooms
    ]


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
async def create_room(
    room: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new room.

    Requires authentication. Room creator is set from JWT token.
    """
    existing_room = await room_crud.get_room_by_name(db, room.name)
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Room name already exists"
        )

    return await room_crud.create_room(db, room, current_user.id)  # type:ignore


@router.get("/{room_id}", response_model=RoomResponse)
async def get_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific room by ID.

    Requires authentication and room membership.
    """
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    membership = await user_room_crud.get_user_room(db, current_user.id, room_id)  # type: ignore
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
        )

    return room


@router.patch("/{room_id}/read", status_code=status.HTTP_200_OK)
async def mark_room_read(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a room as read for the current user.

    Updates last_read_at to current timestamp.
    Requires user to be a member of the room.

    Requires authentication.

    Returns:
        200: Success with last_read_at timestamp
        403: User is not a member of this room
        404: Room not found
    """
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    try:
        user_room = await user_room_crud.mark_room_read(
            db, current_user.id, room_id  # type: ignore[arg-type]
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room. Join the room first.",
        )

    await UnreadCountCache.reset_unread(current_user.id, room_id)  # type: ignore[arg-type]

    last_read_at = user_room.last_read_at  # type: ignore[assignment]

    return {
        "status": "read",
        "room_id": room_id,
        "last_read_at": last_read_at.isoformat() if last_read_at else None,  # type: ignore
    }


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a room by ID.

    Requires auth and room ownership.
    """

    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if room.created_by != current_user.id:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can delete this room",
        )

    await room_crud.delete_room(db, room_id)

    return None


@router.post("/{room_id}/join", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def join_room(
    request: Request,
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Join a room (add user to room membership).

    - Anyone can join any room (public rooms)
    - Returns 404 if room doesn't exist
    - Returns 409 if user is already a member
    - Rate limited to 10 joins per minute to prevent spam
    """
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    existing_membership = await user_room_crud.get_user_room(
        db, current_user.id, room_id  # type: ignore
    )

    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already a member of this room"
        )

    from datetime import timezone

    from app.models.user_room import UserRoom

    membership = UserRoom(
        user_id=current_user.id,  # type: ignore
        room_id=room_id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(membership)
    await db.commit()

    logger.info(
        f"User {current_user.username} (ID: {current_user.id}) joined room {room_id} '{room.name}'",
        extra={
            "user_id": current_user.id,
            "room_id": room_id,
            "action": "room_join",
        },
    )

    return {"message": "Successfully joined room", "room_id": room_id}


@router.post("/{room_id}/leave", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def leave_room(
    request: Request,
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Leave a room (remove user from room membership).

    - Returns 404 if room doesn't exist
    - Returns 400 if user is not a member
    - Returns 403 if user is the room creator (creators cannot leave their own rooms)
    - Rate limited to 10 leaves per minute
    """
    room = await room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    membership = await user_room_crud.get_user_room(db, current_user.id, room_id)  # type: ignore
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Not a member of this room",
        )

    if room.created_by == current_user.id:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Room creators cannot leave their own rooms. Delete the room instead.",
        )

    await db.delete(membership)
    await db.commit()

    logger.info(
        f"User {current_user.username} (ID: {current_user.id}) left room {room_id} '{room.name}'",
        extra={
            "user_id": current_user.id,
            "room_id": room_id,
            "action": "room_leave",
        },
    )

    return {"message": "Successfully left room", "room_id": room_id}
