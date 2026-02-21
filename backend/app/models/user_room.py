from datetime import UTC, datetime

from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class UserRoom(Base):
    __tablename__ = "user_room"

    # Columns with proper type hints for mypy
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    room_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    last_read_at: Mapped[datetime | None] = mapped_column(TIMESTAMP(timezone=True), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="user_rooms")
    room = relationship("Room", back_populates="user_rooms")

    __table_args__ = (
        UniqueConstraint("user_id", "room_id", name="uq_user_room"),
        # Explicit index names match existing migrations (not auto-generated names)
        Index("ix_user_room_user", "user_id"),
        Index("ix_user_room_room", "room_id"),
    )
