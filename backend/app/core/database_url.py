import ssl
from typing import Any

from sqlalchemy.engine import URL, make_url


def build_async_database_config(raw_database_url: str) -> tuple[URL, dict[str, Any]]:
    """Build asyncpg runtime config from a raw libpq-style DATABASE_URL.

    Neon's standard URLs include libpq query params like ``sslmode`` and
    ``channel_binding``. Alembic's psycopg2 path can consume those directly,
    but SQLAlchemy's asyncpg dialect forwards URL query params as keyword args
    to ``asyncpg.connect()``, where those libpq-only names are not accepted.
    """

    parsed_url = make_url(raw_database_url)
    connect_args: dict[str, Any] = {}

    sslmode = parsed_url.query.get("sslmode")
    if isinstance(sslmode, tuple):
        sslmode = sslmode[0]
    if sslmode and sslmode.lower() != "disable":
        # asyncpg expects TLS via its ``ssl`` argument, not libpq's ``sslmode``.
        connect_args["ssl"] = ssl.create_default_context()

    async_url = (
        parsed_url.set(drivername="postgresql+asyncpg")
        .difference_update_query(["sslmode", "channel_binding"])
    )

    return async_url, connect_args
