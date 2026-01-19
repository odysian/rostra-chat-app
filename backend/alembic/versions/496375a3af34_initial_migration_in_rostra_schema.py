"""Initial migration in rostra schema

Revision ID: 496375a3af34
Revises:
Create Date: 2026-01-18 22:14:56.036211

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "496375a3af34"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create users table in rostra schema
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="rostra",
    )
    op.create_index(
        op.f("ix_users_email"), "users", ["email"], unique=True, schema="rostra"
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False, schema="rostra")
    op.create_index(
        op.f("ix_users_username"), "users", ["username"], unique=True, schema="rostra"
    )

    # Create rooms table in rostra schema
    op.create_table(
        "rooms",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["rostra.users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="rostra",
    )
    op.create_index(op.f("ix_rooms_id"), "rooms", ["id"], unique=False, schema="rostra")
    op.create_index(
        op.f("ix_rooms_name"), "rooms", ["name"], unique=True, schema="rostra"
    )

    # Create messages table in rostra schema
    op.create_table(
        "messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("room_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("content", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["room_id"],
            ["rostra.rooms.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["rostra.users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        schema="rostra",
    )
    op.create_index(
        op.f("ix_messages_id"), "messages", ["id"], unique=False, schema="rostra"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_messages_id"), table_name="messages", schema="rostra")
    op.drop_table("messages", schema="rostra")
    op.drop_index(op.f("ix_rooms_name"), table_name="rooms", schema="rostra")
    op.drop_index(op.f("ix_rooms_id"), table_name="rooms", schema="rostra")
    op.drop_table("rooms", schema="rostra")
    op.drop_index(op.f("ix_users_username"), table_name="users", schema="rostra")
    op.drop_index(op.f("ix_users_id"), table_name="users", schema="rostra")
    op.drop_index(op.f("ix_users_email"), table_name="users", schema="rostra")
    op.drop_table("users", schema="rostra")
