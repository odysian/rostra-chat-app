"""add search_vector generated column and GIN index to messages

Revision ID: 15f4e6c7be71
Revises: a08a24f5c734
Create Date: 2026-02-13 13:11:49.262458

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '15f4e6c7be71'
down_revision: str | Sequence[str] | None = 'a08a24f5c734'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add a stored generated column that Postgres maintains automatically.
    # On every INSERT/UPDATE to 'content', Postgres recalculates the tsvector.
    # 'english' config applies stemming (running→run) and removes stop words (the, is).
    op.execute("""
        ALTER TABLE rostra.messages
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
    """)

    # GIN (Generalized Inverted Index) maps each lexeme → set of row IDs.
    # This is what makes full-text search fast: instead of scanning every row,
    # Postgres looks up the lexeme in the index and gets matching row IDs directly.
    op.execute("""
        CREATE INDEX ix_messages_search_vector
        ON rostra.messages
        USING GIN (search_vector)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS rostra.ix_messages_search_vector")
    op.execute("ALTER TABLE rostra.messages DROP COLUMN IF EXISTS search_vector")
