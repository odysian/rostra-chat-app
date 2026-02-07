"""
Pytest configuration and shared fixtures for tests.

Sets up test database with transactions that rollback after each test,
and disables rate limiting for tests (except specific rate limit tests).

If TEST_DATABASE_URL points to a separate PostgreSQL database (e.g. chatdb_test),
that database is created automatically when missing (e.g. after docker-compose
volume wipe), so pytest can run without manual CREATE DATABASE.
"""

import os
import re
from pathlib import Path
from typing import Generator
from urllib.parse import urlparse

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

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
from app.core.logging import logger
from app.core.rate_limit import limiter

# Import all models so SQLAlchemy can discover them for table creation
from app.models import message, room, user, user_room  # noqa: F401
from app.websocket.handlers import websocket_endpoint
from fastapi import Depends, FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy.orm import Session


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

    @test_app.websocket("/ws/connect")
    async def websocket_route(
        websocket: WebSocket, token: str, db: Session = Depends(get_db)
    ):
        await websocket_endpoint(websocket, token, db)

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

# Create test engine
test_engine = create_engine(
    TEST_DATABASE_URL,
    echo=False,
)

# Create test session factory
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """
    Create all tables in test database once per test session.

    This runs before all tests and creates the schema.
    Creates tables directly from models (faster than Alembic for tests).
    """
    # Create schema if using PostgreSQL
    if "postgresql" in TEST_DATABASE_URL.lower():
        with test_engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS rostra"))
            conn.commit()

    # Create all tables from models
    Base.metadata.create_all(bind=test_engine)

    yield

    # Cleanup: drop all tables after tests (but keep schema)
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session() -> Generator[Session, None, None]:
    """
    Create a database session with transaction rollback.

    Each test gets a fresh transaction that rolls back after the test,
    ensuring test isolation.
    """
    # Start a transaction
    connection = test_engine.connect()
    transaction = connection.begin()

    # Create session bound to this connection
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        # Rollback transaction to undo all changes
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session, request) -> Generator[TestClient, None, None]:
    """
    Create a test client with database dependency override.

    Overrides get_db to use the test session with rollback transactions.

    By default, uses an app without rate limiting middleware. Tests that need rate limiting
    should use the `enable_rate_limiting` fixture, which creates an app with middleware.
    """

    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # Don't close - handled by db_session fixture

    # Check if this test needs rate limiting (via enable_rate_limiting fixture)
    has_rate_limiting = "enable_rate_limiting" in request.fixturenames

    # Create appropriate app instance
    if has_rate_limiting:
        test_app = create_test_app(include_rate_limiting=True)
    else:
        test_app = app  # Use default app without rate limiting

    # Override DB dependency
    test_app.dependency_overrides[get_db] = override_get_db

    try:
        yield TestClient(test_app)
    finally:
        # Cleanup: remove overrides
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
        def test_rate_limit(enable_rate_limiting, client):
            # Rate limiting is now active
            ...

    Note: This fixture clears the limiter storage to ensure a clean state for each test.
    """
    # Clear limiter storage to start fresh for this test
    # SlowAPI's MemoryStorage.reset() clears all stored rate limit data
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()

    yield

    # Clear storage after test to prevent interference with other tests
    if hasattr(limiter, "_storage") and hasattr(limiter._storage, "reset"):
        limiter._storage.reset()
