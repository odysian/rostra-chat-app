from app.models.message import Message
from app.models.room import Room
from app.models.user_room import UserRoom
from app.schemas.room import RoomCreate
from sqlalchemy import case, func
from sqlalchemy.orm import Session


def get_room_by_id(db: Session, room_id: int):
    """Get a room by id"""
    return db.query(Room).filter(Room.id == room_id).first()


def get_room_by_name(db: Session, name: str):
    """Get a room by name"""
    return db.query(Room).filter(Room.name == name).first()


def get_all_rooms(db: Session):
    """Gets all rooms"""
    return db.query(Room).all()


def get_all_rooms_with_unread(db: Session, user_id: int):
    """
    Get all rooms with unread message counts in a single optimized query.

    Uses LEFT JOINs and CASE to calculate unread count per room without N+1 queries.

    Args:
        db: Database session
        user_id: Current user's ID

    Returns:
        List of tuples: (Room, unread_count)
    """

    # Build the query
    query = (
        db.query(
            Room,
            func.count(
                case(
                    # If user never read this room (last_read_at IS NULL), count all messages
                    (UserRoom.last_read_at.is_(None), Message.id),
                    # If message created after last_read_at, it's unread
                    (Message.created_at > UserRoom.last_read_at, Message.id),
                    # Otherwise, message is read (don't count)
                    else_=None,
                )
            ).label("unread_count"),
        )
        # LEFT JOIN user_room to get user's read state per room
        .outerjoin(
            UserRoom, (Room.id == UserRoom.room_id) & (UserRoom.user_id == user_id)
        )
        # LEFT JOIN messages to count unread messages
        .outerjoin(Message, Message.room_id == Room.id)
        # Group by room to aggregate unread counts
        .group_by(Room.id, Room.name, Room.created_by, Room.created_at)
    )

    return query.all()


def create_room(db: Session, room: RoomCreate, user_id: int):
    """
    Create a new room.

    Args:
        db: Database session
        room: RoomCreate schema with room name
        user_id: ID of the user creating the room (from JWT token)

    Returns:
        Created Room model instance
    """

    db_room = Room(name=room.name, created_by=user_id)

    db.add(db_room)
    db.commit()
    db.refresh(db_room)
    return db_room


def delete_room(db: Session, room_id: int):
    """
    Delete room by ID

    SQLAlchemy will cascade delete associated messages
    based on foreign key relationship.
    """

    room = db.query(Room).filter(Room.id == room_id).first()
    if room:
        db.delete(room)
        db.commit()
