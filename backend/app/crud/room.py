from app.models.room import Room
from app.schemas.room import RoomCreate
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
