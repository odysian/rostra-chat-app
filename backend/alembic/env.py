from logging.config import fileConfig

from alembic import context
from app.core.config import settings
from app.core.database import Base, sync_engine

# Import all models so Alembic can discover them
from app.models import message, room, user, user_room  # noqa: F401
from sqlalchemy import text

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """
    Filter out phantom schema changes during autogenerate.

    Supabase/managed databases often use schema prefixes (e.g., 'rostra.users'),
    which causes Alembic to detect false positives when models don't specify
    the schema. This function filters those out while allowing real new objects.

    Args:
        object: The object being compared
        name: Name of the object
        type_: Type of object ("table", "column", "index", "foreign_key_constraint", etc.)
        reflected: True if from database, False if from metadata
        compare_to: The object being compared against (None if new)

    Returns:
        True to include the change, False to ignore it.
    """
    # Ignore Alembic's own version table
    if type_ == "table" and name == "alembic_version":
        return False

    # Filter all index operations
    # Schema prefix causes false positives (ix_users_* vs ix_rostra_users_*)
    # TODO: Manually add new indexes to migrations when needed
    if type_ == "index":
        return False

    # Filter all foreign key constraint operations
    # Schema prefix causes false positives (users.id vs rostra.users.id)
    # TODO: Manually add new FKs to migrations when needed
    if type_ == "foreign_key_constraint":
        return False

    # Include all other changes (tables, columns, etc.)
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
        include_object=include_object,  # Filter phantom changes
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
            include_object=include_object,  # Filter phantom changes
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
