from datetime import datetime, timezone

from app.core.database import Base
from sqlalchemy import TIMESTAMP, Column, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import relationship


class UserRoom(Base):
    __tablename__ = "user_room"

    # Columns
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    room_id = Column(
        Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    last_read_at = Column(TIMESTAMP, nullable=True)
    joined_at = Column(
        TIMESTAMP, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="user_rooms")
    room = relationship("Room", back_populates="user_rooms")

    __table_args__ = (UniqueConstraint("user_id", "room_id", name="uq_user_room"),)
