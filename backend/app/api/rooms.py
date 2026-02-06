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


@router.get("/discover", response_model=List[RoomResponse])
def discover_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all available public rooms for discovery/browsing.

    Returns all rooms regardless of membership status.
    Use this endpoint for a "Browse Rooms" or "Discover Rooms" feature
    where users can see all public rooms and choose which to join.

    Returns:
        List of all rooms in the system
    """
    rooms = room_crud.get_all_rooms(db)
    return rooms


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

    If include_unread=true, returns rooms with unread_count field.
    Uses optimized single-query approach (no N+1 problem).
    """

    if not include_unread:
        # Simple case: just return rooms
        rooms = room_crud.get_all_rooms(db)
        return rooms

    # Optimized case: single query for rooms + unread counts
    rooms_with_unread = room_crud.get_all_rooms_with_unread(db, current_user.id)  # type: ignore

    # Format response
    result = []
    for room, unread_count in rooms_with_unread:
        room_dict = RoomResponse(
            id=room.id,
            name=room.name,
            created_by=room.created_by,
            created_at=room.created_at,
            unread_count=unread_count or 0,  # Ensure 0, not None
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

    Requires authentication and room membership.
    """
    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Check if user is a member (SECURITY CHECK)
    membership = user_room_crud.get_user_room(db, current_user.id, room_id)  # type: ignore
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of this room"
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
    Requires user to be a member of the room.

    Requires authentication.

    Returns:
        200: Success with last_read_at timestamp
        403: User is not a member of this room
        404: Room not found
    """
    # Verify room exists (fail fast with better error message)
    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Mark room as read (only updates existing membership)
    try:
        user_room = user_room_crud.mark_room_read(
            db, current_user.id, room_id  # type: ignore[arg-type]
        )
    except ValueError as e:
        # User is not a member
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this room. Join the room first."
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


@router.post("/{room_id}/join", status_code=status.HTTP_200_OK)
def join_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Join a room (add user to room membership).

    - Anyone can join any room (public rooms)
    - Returns 404 if room doesn't exist
    - Returns 409 if user is already a member
    """
    # Check if room exists
    room = room_crud.get_room_by_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Room not found"
        )

    # Check if already a member
    existing_membership = user_room_crud.get_user_room(
        db, current_user.id, room_id  # type: ignore
    )

    if existing_membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Already a member of this room"
        )

    # Add membership
    from datetime import datetime, timezone

    from app.models.user_room import UserRoom

    membership = UserRoom(
        user_id=current_user.id,  # type: ignore
        room_id=room_id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(membership)
    db.commit()

    return {"message": "Successfully joined room", "room_id": room_id}
