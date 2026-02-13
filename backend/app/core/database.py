from sqlalchemy import MetaData
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

# Build async URL safely (handles any existing driver suffix like +psycopg2)
_parsed_url = make_url(settings.DATABASE_URL)
_async_url = _parsed_url.set(drivername="postgresql+asyncpg")

# Async engine for the application
async_engine = create_async_engine(
    _async_url,
    echo=False,
    pool_size=10,  # Default connections in pool
    max_overflow=20,  # Extra connections allowed under load
    pool_recycle=3600,  # Recycle connections after 1 hour (prevents stale connections)
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Prevents DetachedInstanceError after commit in async context
)

# Schema metadata — tells SQLAlchemy all tables belong to 'rostra' schema.
# The naming convention for indexes uses table_name + column_name instead of
# the default column_label (which includes the schema prefix). This keeps
# auto-generated index names like 'ix_users_id' rather than 'ix_rostra_users_id',
# matching the names already in existing migrations.
meta = MetaData(
    schema="rostra",
    naming_convention={"ix": "ix_%(table_name)s_%(column_0_name)s"},
)
Base = declarative_base(metadata=meta)


async def get_db():
    """Async dependency for database sessions.

    Used via FastAPI's Depends(get_db). The 'async with' ensures
    the session is closed even if the endpoint raises an exception.
    """
    async with AsyncSessionLocal() as session:
        yield session
