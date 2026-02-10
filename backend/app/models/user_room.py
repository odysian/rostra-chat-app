from datetime import UTC, datetime

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRoom(Base):
    __tablename__ = "user_room"

    # Columns with proper type hints for mypy
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    room_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    last_read_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="user_rooms")
    room = relationship("Room", back_populates="user_rooms")

    __table_args__ = (UniqueConstraint("user_id", "room_id", name="uq_user_room"),)
