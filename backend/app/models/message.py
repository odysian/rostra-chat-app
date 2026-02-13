from datetime import UTC, datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    # Columns
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    # Relationships
    user = relationship("User", back_populates="messages")
    room = relationship("Room", back_populates="messages")

    __table_args__ = (
        # Composite index for cursor-based pagination (room_id, created_at DESC, id DESC)
        Index("ix_messages_room_created_id", "room_id", created_at.desc(), id.desc()),
    )
