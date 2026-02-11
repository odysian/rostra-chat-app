"""add_message_pagination_index

Revision ID: a08a24f5c734
Revises: c52c2a178a54
Create Date: 2026-02-11 16:07:09.390585

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a08a24f5c734'
down_revision: Union[str, Sequence[str], None] = 'c52c2a178a54'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create composite index for cursor-based pagination on messages table
    # This index optimizes queries that filter by room_id and order by (created_at, id)
    # Using raw SQL to ensure proper DESC ordering in PostgreSQL
    op.execute(
        """
        CREATE INDEX ix_messages_room_created_id
        ON rostra.messages (room_id, created_at DESC, id DESC)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop the composite pagination index
    op.execute("DROP INDEX rostra.ix_messages_room_created_id")
