"""add message_reactions table for message reaction feature

Revision ID: c2d3e4f5a6b7
Revises: b1e2f3a4c5d6
Create Date: 2026-02-24 11:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: str | Sequence[str] | None = "b1e2f3a4c5d6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "message_reactions",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("message_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.Column("emoji", sa.String(length=8), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["rostra.messages.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["rostra.users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "message_id",
            "user_id",
            "emoji",
            name="uq_message_reactions_message_user_emoji",
        ),
        schema="rostra",
    )
    op.create_index(
        "ix_message_reactions_message_id",
        "message_reactions",
        ["message_id"],
        unique=False,
        schema="rostra",
    )
    op.create_index(
        "ix_message_reactions_user_id",
        "message_reactions",
        ["user_id"],
        unique=False,
        schema="rostra",
    )


def downgrade() -> None:
    op.drop_index(
        "ix_message_reactions_user_id",
        table_name="message_reactions",
        schema="rostra",
    )
    op.drop_index(
        "ix_message_reactions_message_id",
        table_name="message_reactions",
        schema="rostra",
    )
    op.drop_table("message_reactions", schema="rostra")
