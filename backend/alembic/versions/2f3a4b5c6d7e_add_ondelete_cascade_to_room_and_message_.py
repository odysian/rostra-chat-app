"""add ondelete cascade to room and message foreign keys

Revision ID: 2f3a4b5c6d7e
Revises: 15f4e6c7be71
Create Date: 2026-02-21 21:05:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f3a4b5c6d7e"
down_revision: str | Sequence[str] | None = "15f4e6c7be71"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _drop_fk_by_columns(table_name: str, constrained_columns: list[str]) -> None:
    """Drop a foreign key on the given columns without relying on auto-generated names."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for fk in inspector.get_foreign_keys(table_name, schema="rostra"):
        name = fk.get("name")
        if fk.get("constrained_columns") == constrained_columns and isinstance(name, str):
            op.drop_constraint(
                name,
                table_name,
                schema="rostra",
                type_="foreignkey",
            )
            return
    raise RuntimeError(
        f"Unable to find foreign key on rostra.{table_name} columns {constrained_columns}"
    )


def upgrade() -> None:
    _drop_fk_by_columns("rooms", ["created_by"])
    _drop_fk_by_columns("messages", ["room_id"])
    _drop_fk_by_columns("messages", ["user_id"])

    op.create_foreign_key(
        "fk_rooms_created_by_users",
        "rooms",
        "users",
        ["created_by"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_messages_room_id_rooms",
        "messages",
        "rooms",
        ["room_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_messages_user_id_users",
        "messages",
        "users",
        ["user_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_messages_user_id_users",
        "messages",
        schema="rostra",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_messages_room_id_rooms",
        "messages",
        schema="rostra",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_rooms_created_by_users",
        "rooms",
        schema="rostra",
        type_="foreignkey",
    )

    op.create_foreign_key(
        "messages_room_id_fkey",
        "messages",
        "rooms",
        ["room_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
    )
    op.create_foreign_key(
        "messages_user_id_fkey",
        "messages",
        "users",
        ["user_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
    )
    op.create_foreign_key(
        "rooms_created_by_fkey",
        "rooms",
        "users",
        ["created_by"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
    )
