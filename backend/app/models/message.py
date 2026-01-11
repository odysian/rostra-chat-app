from datetime import datetime, timezone

from app.core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship


class Message(Base):
    __tablename__ = "messages"

    # Columns
    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey="rooms.id", nullable=False)
    user_id = Column(Integer, ForeignKey="users.id", nullable=False)
    content = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="messages")
