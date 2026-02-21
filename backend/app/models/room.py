from datetime import UTC, datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Room(Base):
    __tablename__ = "rooms"

    # Columns
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, index=True, unique=True, nullable=False)
    created_by: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Relationships
    creator = relationship("User", back_populates="rooms")
    messages = relationship(
        "Message", back_populates="room", cascade="all, delete-orphan"
    )
    user_rooms = relationship(
        "UserRoom", back_populates="room", cascade="all, delete-orphan"
    )
