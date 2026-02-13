from collections.abc import MutableMapping
from logging.config import fileConfig
from typing import Literal

from sqlalchemy import create_engine, text

from alembic import context
from app.core.config import settings
from app.core.database import Base

# Import all models so Alembic can discover them
from app.models import message, room, user, user_room  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def _create_alembic_engine():
    """Create sync engine for Alembic migrations.

    Attempts to override search_path to 'public' so Alembic discovers 'rostra'
    as a named schema (needed for clean autogenerate). If the connection fails
    — e.g. a transaction pooler like PgBouncer rejects the 'options' startup
    parameter — falls back to a plain engine. Autogenerate may produce phantom
    diffs with the fallback, but upgrade/downgrade still works correctly since
    all migration operations use explicit schema="rostra".
    """
    engine_with_override = create_engine(
        settings.DATABASE_URL,
        connect_args={"options": "-csearch_path=public"},
    )
    try:
        with engine_with_override.connect():
            pass
        return engine_with_override
    except Exception:
        engine_with_override.dispose()
        return create_engine(settings.DATABASE_URL)


sync_engine = _create_alembic_engine()


_NameType = Literal[
    "schema", "table", "column", "index", "unique_constraint", "foreign_key_constraint"
]
_ParentKey = Literal["schema_name", "table_name", "schema_qualified_table_name"]


def include_name(
    name: str | None, type_: _NameType, parent_names: MutableMapping[_ParentKey, str | None]
) -> bool:
    """Control which schemas/objects Alembic considers during autogenerate.

    Only process the 'rostra' schema so autogenerate compares objects within
    the correct namespace. Without this filter, Alembic would also reflect
    the 'public' schema and produce unwanted operations.
    """
    if type_ == "schema":
        return name == "rostra"
    return True


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = settings.DATABASE_URL

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema=target_metadata.schema,
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = sync_engine

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=target_metadata.schema,
            include_schemas=True,
            include_name=include_name,
        )

        with context.begin_transaction():
            connection.execute(
                text(f"CREATE SCHEMA IF NOT EXISTS {target_metadata.schema}")
            )

            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
