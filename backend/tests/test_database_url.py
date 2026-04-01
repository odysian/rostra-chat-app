import ssl

from app.core.database_url import build_async_database_config


def test_build_async_database_config_strips_neon_libpq_only_params():
    raw_url = (
        "postgresql://neondb_owner:secret@ep-example.us-east-1.aws.neon.tech/"
        "neondb?sslmode=require&channel_binding=require"
    )

    async_url, connect_args = build_async_database_config(raw_url)

    assert async_url.drivername == "postgresql+asyncpg"
    assert "sslmode" not in async_url.query
    assert "channel_binding" not in async_url.query
    assert connect_args["ssl"]
    assert isinstance(connect_args["ssl"], ssl.SSLContext)
    assert connect_args["ssl"].check_hostname is True
    assert connect_args["ssl"].verify_mode == ssl.CERT_REQUIRED

    raw_query = str(raw_url)
    assert "sslmode=require" in raw_query
    assert "channel_binding=require" in raw_query
