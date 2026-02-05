"""add user_room table

Revision ID: a1b2c3d4e5f6
Revises: 496375a3af34
Create Date: 2026-02-05

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "496375a3af34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create user_room table in rostra schema
    op.create_table(
        "user_room",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("last_read_at", sa.TIMESTAMP(), nullable=True),
        sa.Column(
            "joined_at", sa.TIMESTAMP(), server_default=sa.text("NOW()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["rostra.users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["rostra.rooms.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "room_id", name="uq_user_room"),
        schema="rostra",
    )
    op.create_index(
        op.f("ix_user_room_user"), "user_room", ["user_id"], schema="rostra"
    )
    op.create_index(
        op.f("ix_user_room_room"), "user_room", ["room_id"], schema="rostra"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_user_room_room"), table_name="user_room", schema="rostra")
    op.drop_index(op.f("ix_user_room_user"), table_name="user_room", schema="rostra")
    op.drop_table("user_room", schema="rostra")
