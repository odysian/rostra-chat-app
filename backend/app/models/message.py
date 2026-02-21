from datetime import UTC, datetime

from sqlalchemy import BigInteger, Computed, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Message(Base):
    __tablename__ = "messages"

    # Columns
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, index=True)
    room_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Postgres generated column: auto-maintained tsvector for full-text search.
    # Computed(..., persisted=True) tells SQLAlchemy this is a STORED generated column,
    # so it won't try to set it on INSERT/UPDATE — Postgres handles that.
    search_vector: Mapped[str | None] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('english', content)", persisted=True),
        nullable=True,
    )

    # Relationships
    user = relationship("User", back_populates="messages")
    room = relationship("Room", back_populates="messages")

    __table_args__ = (
        # Composite index for cursor-based pagination (room_id, created_at DESC, id DESC)
        Index("ix_messages_room_created_id", "room_id", created_at.desc(), id.desc()),
        # GIN index for full-text search on the generated tsvector column
        Index("ix_messages_search_vector", search_vector, postgresql_using="gin"),
    )
