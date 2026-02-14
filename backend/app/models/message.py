from datetime import UTC, datetime

from sqlalchemy import Column, Computed, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import TSVECTOR
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

    # Postgres generated column: auto-maintained tsvector for full-text search.
    # Computed(..., persisted=True) tells SQLAlchemy this is a STORED generated column,
    # so it won't try to set it on INSERT/UPDATE — Postgres handles that.
    search_vector = Column(
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
