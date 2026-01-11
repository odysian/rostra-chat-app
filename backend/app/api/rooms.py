from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.crud import room as room_crud
from app.models.user import User
from app.schemas.room import RoomCreate, RoomResponse
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

router = APIRouter()


@router.get("", response_model=List[RoomResponse])
def get_rooms(db: Session = Depends(get_db)):
    """
    Get all available rooms.

    Public endpoint - no authentication required.
    """
    return room_crud.get_all_rooms(db)


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
def get_room(room_id: int, db: Session = Depends(get_db)):
    """
    Get a specific room by ID.

    Public endpoint - no authentication required.
    """
    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )
    return room
