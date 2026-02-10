"""
Pytest configuration and shared fixtures for tests.

Sets up an async test database with savepoint-based transaction rollback,
an httpx.AsyncClient for making requests, and rate limiter helpers.

If TEST_DATABASE_URL points to a separate PostgreSQL database (e.g. chatdb_test),
that database is created automatically when missing (e.g. after docker-compose
volume wipe), so pytest can run without manual CREATE DATABASE.
"""

import os
import re
from pathlib import Path
from urllib.parse import urlparse

import pytest
from dotenv import load_dotenv
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# Ensure factory fixtures module is imported so its @pytest.fixture
# definitions (create_user, create_room, create_message) are registered.
from .factories import create_message, create_room, create_user  # noqa: F401

# Load .env file BEFORE importing settings to get TEST_DATABASE_URL
# Look for .env in backend directory (where tests run from)
# Also check current working directory in case pytest is run from root
backend_dir = Path(__file__).parent.parent
env_paths = [
    backend_dir / ".env",  # backend/.env
    Path.cwd() / "backend" / ".env",  # backend/.env when run from root
    Path.cwd() / ".env",  # .env in current dir
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path, override=False)  # Don't override existing env vars
        break

# Extract TEST_DATABASE_URL before Settings loads (Settings doesn't allow extra fields)
TEST_DATABASE_URL_ENV = os.environ.pop("TEST_DATABASE_URL", None)

# Import app creation components
from app.api import auth, messages, rooms
from app.core.config import settings
from app.core.database import Base, get_db
from app.core.rate_limit import limiter

# Import all models so SQLAlchemy can discover them for table creation
from app.models import message, room, user, user_room  # noqa: F401
from app.websocket.handlers import websocket_endpoint
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


def create_test_app(include_rate_limiting: bool = False) -> FastAPI:
    """
    Create a FastAPI app instance for testing.

    Args:
        include_rate_limiting: If True, include SlowAPIMiddleware. If False, exclude it.
    """
    test_app = FastAPI(
        title=settings.PROJECT_NAME,
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        swagger_ui_parameters={"persistAuthorization": True},
    )

    # Rate limiting (slowapi) - only if requested
    if include_rate_limiting:
        test_app.state.limiter = limiter
        test_app.add_middleware(SlowAPIMiddleware)

        async def rate_limit_exceeded_handler(
            request: Request, exc: Exception
        ) -> Response:
            assert isinstance(exc, RateLimitExceeded)
            return _rate_limit_exceeded_handler(request, exc)

        test_app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

    # CORS
    test_app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Security headers middleware
    @test_app.middleware("http")
    async def add_security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        return response

    # Routers
    test_app.include_router(
        auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"]
    )
    test_app.include_router(
        rooms.router, prefix=f"{settings.API_V1_STR}/rooms", tags=["rooms"]
    )
    test_app.include_router(
        messages.router, prefix=settings.API_V1_STR, tags=["messages"]
    )

    @test_app.get("/")
    def root():
        """Health check endpoint"""
        return {"message": "Chat API is running"}

    # Updated: WebSocket route no longer takes a db parameter (Phase 4 change)
    @test_app.websocket("/ws/connect")
    async def websocket_route(websocket: WebSocket, token: str):
        await websocket_endpoint(websocket, token)

    return test_app


# Create default test app without rate limiting
app = create_test_app(include_rate_limiting=False)

# Use TEST_DATABASE_URL from env if provided, otherwise use main DATABASE_URL
TEST_DATABASE_URL = TEST_DATABASE_URL_ENV or settings.DATABASE_URL


def _ensure_test_database_exists() -> None:
    """
    If TEST_DATABASE_URL points to a separate PostgreSQL DB that does not exist,
    create it by connecting to the main DATABASE_URL (e.g. chatdb) and running
    CREATE DATABASE. This allows pytest to work after a fresh docker-compose up
    without manually creating chatdb_test.
    """
    url_lower = TEST_DATABASE_URL.lower()
    if "postgresql" not in url_lower:
        return
    test_db_name = (urlparse(TEST_DATABASE_URL).path or "").strip("/")
    main_db_name = (urlparse(settings.DATABASE_URL).path or "").strip("/")
    if not test_db_name or test_db_name == main_db_name:
        return
    # Only allow safe identifiers to avoid injection (DB name comes from env/URL)
    if not re.fullmatch(r"[a-zA-Z0-9_]+", test_db_name):
        return
    bootstrap_engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        isolation_level="AUTOCOMMIT",
    )
    try:
        with bootstrap_engine.connect() as conn:
            row = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"),
                {"name": test_db_name},
            ).first()
            if row is None:
                conn.execute(text(f'CREATE DATABASE "{test_db_name}"'))
    finally:
        bootstrap_engine.dispose()


_ensure_test_database_exists()

# Sync test engine — used for DDL (table create/drop) which runs once per session.
# Same reason Alembic uses a sync engine: DDL is a one-off operation.
sync_test_engine = create_engine(TEST_DATABASE_URL, echo=False)

# Build async test URL from TEST_DATABASE_URL (swap driver to asyncpg)
_parsed_test_url = make_url(TEST_DATABASE_URL)
_async_test_url = _parsed_test_url.set(drivername="postgresql+asyncpg")

# Async test engine — used for per-test sessions (db_session fixture).
# NullPool ensures each test gets a fresh connection, avoiding stale
# connections from previous tests' event loops in the pool.
async_test_engine = create_async_engine(
    _async_test_url, echo=False, poolclass=NullPool
)

# Async test session factory
TestAsyncSessionLocal = async_sessionmaker(
    async_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Create all tables in test database once per test session.

    Uses a sync engine for DDL to avoid event loop scope issues with
    session-scoped async fixtures. Table creation is a one-off operation
    that doesn't need to be async.
    """
    with sync_test_engine.connect() as conn:
        conn.execute(text("CREATE SCHEMA IF NOT EXISTS rostra"))
        conn.commit()

    Base.metadata.create_all(bind=sync_test_engine)

    yield

    # Cleanup: drop all tables after tests (but keep schema)
    Base.metadata.drop_all(bind=sync_test_engine)


@pytest.fixture(scope="function")
async def db_session():
    """
    Async test session with savepoint-based transaction rollback.

    How the savepoint pattern works:
    1. We open a real database connection and start a transaction.
    2. We create a SAVEPOINT (begin_nested) inside that transaction.
    3. The test's application code calls await db.commit() — but that
       only commits to the SAVEPOINT, not the outer transaction.
    4. The event listener re-opens a new savepoint after each commit,
       so multiple commits within one test all stay inside the outer tx.
    5. After the test, we rollback the outer transaction, undoing
       ALL changes — even the ones the app "committed".

    This gives us test isolation without actually persisting anything.
    """
    async with async_test_engine.connect() as connection:
        # Start the outer transaction (this is what we'll rollback)
        transaction = await connection.begin()

        # Bind a session to this specific connection
        session = TestAsyncSessionLocal(bind=connection)

        # Create a savepoint so app-level commit() doesn't escape
        nested = await connection.begin_nested()

        # Re-open savepoint after each app-level commit
        @event.listens_for(session.sync_session, "after_transaction_end")
        def restart_savepoint(session_inner, transaction_inner):
            nonlocal nested
            if transaction_inner.nested and not transaction_inner._parent.nested:
                nested = connection.sync_connection.begin_nested()

        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


@pytest.fixture(scope="function")
async def client(db_session, request):
    """
    Async test client with database dependency override.

    Uses httpx.AsyncClient with ASGITransport to send requests directly
    to the FastAPI app (no HTTP server needed). Overrides get_db to use
    the test session with savepoint rollback.
    """

    async def override_get_db():
        yield db_session

    # Check if this test needs rate limiting (via enable_rate_limiting fixture)
    has_rate_limiting = "enable_rate_limiting" in request.fixturenames

    # Create appropriate app instance
    if has_rate_limiting:
        test_app = create_test_app(include_rate_limiting=True)
    else:
        test_app = app  # Use default app without rate limiting

    # Override DB dependency so all endpoints use the test session
    test_app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    test_app.dependency_overrides.clear()


@pytest.fixture(scope="function", autouse=True)
def clear_rate_limiter_storage():
    """
    Clear rate limiter storage before each test to ensure isolation.

    Even though most tests don't use rate limiting middleware, the limiter storage
    is a module-level singleton that persists across tests. Clearing it ensures
    that tests don't interfere with each other.
    """
    # Clear limiter storage before each test
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()

    yield

    # Clear again after test for good measure
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()


@pytest.fixture
def enable_rate_limiting():
    """
    Temporarily re-enable rate limiting for a specific test.

    Use this fixture in rate limit tests that need to verify rate limiting behavior.
    The client fixture will detect this fixture and create an app with rate limiting middleware.

    Example:
        async def test_rate_limit(enable_rate_limiting, client):
            # Rate limiting is now active
            ...

    Note: This fixture clears the limiter storage to ensure a clean state for each test.
    """
    # Clear limiter storage to start fresh for this test
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()

    yield

    # Clear storage after test to prevent interference with other tests
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()
