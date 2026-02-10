from datetime import datetime, timezone

from app.core.database import Base
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    # Columns
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    messages = relationship("Message", back_populates="user")
    rooms = relationship("Room", back_populates="creator")
    user_rooms = relationship(
        "UserRoom", back_populates="user", cascade="all, delete-orphan"
    )
