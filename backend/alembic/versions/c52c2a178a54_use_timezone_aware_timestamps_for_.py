"""use timezone-aware timestamps for asyncpg compat

asyncpg is stricter than psycopg2: it refuses to mix timezone-aware
Python datetimes with TIMESTAMP WITHOUT TIME ZONE columns. This migration
converts all timestamp columns to TIMESTAMP WITH TIME ZONE (TIMESTAMPTZ).

PostgreSQL interprets existing naive timestamps as UTC during conversion.

Revision ID: c52c2a178a54
Revises: a1b2c3d4e5f6
Create Date: 2026-02-10 17:38:27.861753

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c52c2a178a54'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Convert timestamp columns to timezone-aware."""
    op.alter_column('messages', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=True,
               schema='rostra')
    op.alter_column('rooms', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=True,
               schema='rostra')
    op.alter_column('user_room', 'last_read_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.TIMESTAMP(timezone=True),
               existing_nullable=True,
               schema='rostra')
    op.alter_column('user_room', 'joined_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.TIMESTAMP(timezone=True),
               existing_nullable=False,
               schema='rostra')
    op.alter_column('users', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               type_=sa.DateTime(timezone=True),
               existing_nullable=True,
               schema='rostra')


def downgrade() -> None:
    """Revert timestamp columns to timezone-naive."""
    op.alter_column('users', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=True,
               schema='rostra')
    op.alter_column('user_room', 'joined_at',
               existing_type=sa.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=False,
               schema='rostra')
    op.alter_column('user_room', 'last_read_at',
               existing_type=sa.TIMESTAMP(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=True,
               schema='rostra')
    op.alter_column('rooms', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=True,
               schema='rostra')
    op.alter_column('messages', 'created_at',
               existing_type=sa.DateTime(timezone=True),
               type_=postgresql.TIMESTAMP(),
               existing_nullable=True,
               schema='rostra')
