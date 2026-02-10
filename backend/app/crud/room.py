from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.room import Room
from app.models.user_room import UserRoom
from app.schemas.room import RoomCreate


async def get_room_by_id(db: AsyncSession, room_id: int):
    """Get a room by id"""
    result = await db.execute(select(Room).where(Room.id == room_id))
    return result.scalar_one_or_none()


async def get_room_by_name(db: AsyncSession, name: str):
    """Get a room by name"""
    result = await db.execute(select(Room).where(Room.name == name))
    return result.scalar_one_or_none()


async def get_all_rooms(db: AsyncSession):
    """Gets all rooms"""
    result = await db.execute(select(Room))
    return list(result.scalars().all())


async def get_rooms_for_user(db: AsyncSession, user_id: int):
    """
    Get rooms the user is a member of (without unread counts).

    Returns only rooms where the user has an active membership.
    This is used by GET /api/rooms when include_unread=false.
    """
    result = await db.execute(
        select(Room)
        .join(UserRoom, Room.id == UserRoom.room_id)
        .where(UserRoom.user_id == user_id)
    )
    return list(result.scalars().all())


async def get_all_rooms_with_unread(db: AsyncSession, user_id: int):
    """
    Get rooms the user is a MEMBER of, with unread message counts.

    Uses INNER JOIN on UserRoom to only return rooms the user has joined.
    Uses LEFT JOIN on Message to calculate unread counts without N+1 queries.

    Returns:
        List of Row tuples: (Room, unread_count) for rooms user is a member of
    """
    stmt = (
        select(
            Room,
            func.count(
                case(
                    (UserRoom.last_read_at.is_(None), Message.id),
                    (Message.created_at > UserRoom.last_read_at, Message.id),
                    else_=None,
                )
            ).label("unread_count"),
        )
        .join(UserRoom, (Room.id == UserRoom.room_id) & (UserRoom.user_id == user_id))
        .outerjoin(Message, Message.room_id == Room.id)
        .group_by(Room.id, Room.name, Room.created_by, Room.created_at)
    )

    result = await db.execute(stmt)
    return result.all()


async def create_room(db: AsyncSession, room: RoomCreate, user_id: int):
    """
    Create a new room.

    Automatically adds the creator as a member of the room (creates UserRoom record).
    Uses a single transaction to ensure atomicity - both room and membership are
    created together or not at all.
    """
    from datetime import datetime, timezone

    db_room = Room(name=room.name, created_by=user_id)
    db.add(db_room)

    # Flush sends the INSERT to the DB (inside the transaction) so we get room.id,
    # but does NOT commit — the transaction stays open for the next add()
    await db.flush()

    user_room = UserRoom(
        user_id=user_id,
        room_id=db_room.id,
        joined_at=datetime.now(timezone.utc),
    )
    db.add(user_room)

    await db.commit()
    await db.refresh(db_room)

    return db_room


async def delete_room(db: AsyncSession, room_id: int):
    """
    Delete room by ID.

    SQLAlchemy will cascade delete associated messages
    based on foreign key relationship.
    """
    result = await db.execute(select(Room).where(Room.id == room_id))
    room = result.scalar_one_or_none()
    if room:
        await db.delete(room)
        await db.commit()
