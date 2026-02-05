from datetime import datetime, timezone

from app.core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship


class Room(Base):
    __tablename__ = "rooms"

    # Columns
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    creator = relationship("User", back_populates="rooms")
    messages = relationship(
        "Message", back_populates="room", cascade="all, delete-orphan"
    )
    user_rooms = relationship(
        "UserRoom", back_populates="room", cascade="all, delete-orphan"
    )
