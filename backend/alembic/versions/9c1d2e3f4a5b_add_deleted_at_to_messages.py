"""add deleted_at to messages for soft deletion

Revision ID: 9c1d2e3f4a5b
Revises: 7b8c9d0e1f2a
Create Date: 2026-02-24 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9c1d2e3f4a5b"
down_revision: str | Sequence[str] | None = "7b8c9d0e1f2a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        schema="rostra",
    )


def downgrade() -> None:
    op.drop_column("messages", "deleted_at", schema="rostra")
