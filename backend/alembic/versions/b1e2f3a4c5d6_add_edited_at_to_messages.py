"""add edited_at to messages for message editing

Revision ID: b1e2f3a4c5d6
Revises: 9c1d2e3f4a5b
Create Date: 2026-02-24 00:00:01.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1e2f3a4c5d6"
down_revision: str | Sequence[str] | None = "9c1d2e3f4a5b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "messages",
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        schema="rostra",
    )


def downgrade() -> None:
    op.drop_column("messages", "edited_at", schema="rostra")
