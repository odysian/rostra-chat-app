from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.crud import room as room_crud
from app.crud import user_room as user_room_crud
from app.models.user import User
from app.schemas.room import RoomCreate, RoomResponse
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("", response_model=List[RoomResponse])
def get_rooms(
    include_unread: bool = Query(
        False, description="Include unread message counts per room"
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all available rooms.

    Requires authentication.

    Query params:
        include_unread: If true, include unread_count per room.

    Returns:
        List of rooms. If include_unread=true, includes unread_count field.
    """
    rooms = room_crud.get_all_rooms(db)

    if not include_unread:
        return rooms

    result = []
    for room in rooms:
        unread_count = user_room_crud.get_unread_count(
            db, current_user.id, room.id  # type: ignore[arg-type]
        )
        room_dict = RoomResponse(
            id=room.id,  # type: ignore[arg-type]
            name=room.name,  # type: ignore[arg-type]
            created_by=room.created_by,  # type: ignore[arg-type]
            created_at=room.created_at,  # type: ignore[arg-type]
            unread_count=unread_count,
        )
        result.append(room_dict)
    return result


@router.post("", response_model=RoomResponse, status_code=status.HTTP_201_CREATED)
def create_room(
    room: RoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Create a new room.

    Requires authentication. Room creator is set from JWT token.
    """
    # Check if room name already exists
    existing_room = room_crud.get_room_by_name(db, room.name)
    if existing_room:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Room name already exists"
        )

    # Create room with authenticated user as creator
    return room_crud.create_room(db, room, current_user.id)  # type:ignore


@router.get("/{room_id}", response_model=RoomResponse)
def get_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get a specific room by ID.

    Requires authentication.
    """
    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )
    return room


@router.patch("/{room_id}/read", status_code=status.HTTP_200_OK)
def mark_room_read(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Mark a room as read for the current user.

    Updates last_read_at to current timestamp.
    Creates user_room record if it doesn't exist (first time viewing room).

    Requires authentication.

    Returns:
        200: Success with last_read_at timestamp
        404: Room not found
    """
    # Verify room exists (fail fast with better error message)
    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Mark room as read (creates or updates user_room record)
    user_room = user_room_crud.mark_room_read(
        db, current_user.id, room_id  # type: ignore[arg-type]
    )

    # Extract last_read_at to avoid type checker issues with SQLAlchemy Column types
    last_read_at = user_room.last_read_at  # type: ignore[assignment]

    return {
        "status": "read",
        "room_id": room_id,
        "last_read_at": last_read_at.isoformat() if last_read_at else None,  # type: ignore
    }


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Delete a room by ID.

    Requires auth and room ownership.
    """

    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    if room.created_by != current_user.id:  # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only room creator can delete this room",
        )

    room_crud.delete_room(db, room_id)

    return None
