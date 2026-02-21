"""migrate primary and foreign keys to bigint

Revision ID: 7b8c9d0e1f2a
Revises: 2f3a4b5c6d7e
Create Date: 2026-02-21 21:25:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7b8c9d0e1f2a"
down_revision: str | Sequence[str] | None = "2f3a4b5c6d7e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _drop_fk_by_columns(table_name: str, constrained_columns: list[str]) -> None:
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
    _drop_fk_by_columns("user_room", ["user_id"])
    _drop_fk_by_columns("user_room", ["room_id"])

    op.execute("ALTER TABLE rostra.users ALTER COLUMN id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.rooms ALTER COLUMN id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.messages ALTER COLUMN id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.user_room ALTER COLUMN id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.rooms ALTER COLUMN created_by TYPE BIGINT")
    op.execute("ALTER TABLE rostra.messages ALTER COLUMN room_id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.messages ALTER COLUMN user_id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.user_room ALTER COLUMN user_id TYPE BIGINT")
    op.execute("ALTER TABLE rostra.user_room ALTER COLUMN room_id TYPE BIGINT")

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
    op.create_foreign_key(
        "fk_user_room_user_id_users",
        "user_room",
        "users",
        ["user_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_user_room_room_id_rooms",
        "user_room",
        "rooms",
        ["room_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_user_room_room_id_rooms",
        "user_room",
        schema="rostra",
        type_="foreignkey",
    )
    op.drop_constraint(
        "fk_user_room_user_id_users",
        "user_room",
        schema="rostra",
        type_="foreignkey",
    )
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

    op.execute("ALTER TABLE rostra.user_room ALTER COLUMN room_id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.user_room ALTER COLUMN user_id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.messages ALTER COLUMN user_id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.messages ALTER COLUMN room_id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.rooms ALTER COLUMN created_by TYPE INTEGER")
    op.execute("ALTER TABLE rostra.user_room ALTER COLUMN id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.messages ALTER COLUMN id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.rooms ALTER COLUMN id TYPE INTEGER")
    op.execute("ALTER TABLE rostra.users ALTER COLUMN id TYPE INTEGER")

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
    op.create_foreign_key(
        "user_room_user_id_fkey",
        "user_room",
        "users",
        ["user_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "user_room_room_id_fkey",
        "user_room",
        "rooms",
        ["room_id"],
        ["id"],
        source_schema="rostra",
        referent_schema="rostra",
        ondelete="CASCADE",
    )
