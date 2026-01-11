from app.models.message import Message
from app.models.user import User
from app.schemas.message import MessageCreate
from sqlalchemy.orm import Session, joinedload


def get_messages_by_room(db: Session, room_id: int, limit: int = 50):
    """
    Get recent messages for a room with username included.

    Args:
        db: Database session
        room_id: Room ID to get messages from
        limit: Maximum number of messages to return (default 50)

    Returns:
        List of Message objects (with user relationship loaded)
    """
    return (
        db.query(Message)
        .options(joinedload(Message.user))
        .filter(Message.room_id == room_id)
        .order_by(Message.created_at.desc())
        .limit(limit)
        .all()
    )


def create_message(db: Session, message: MessageCreate, user_id: int):
    """
    Create a new message.

    Args:
        db: Database session
        message: MessageCreate schema with room_id and content
        user_id: ID of the user sending the message (from JWT)

    Returns:
        Created Message model instance
    """
    db_message = Message(
        room_id=message.room_id, user_id=user_id, content=message.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message
