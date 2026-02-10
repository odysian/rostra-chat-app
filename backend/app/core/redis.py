"""
Async Redis client for caching unread counts.

Singleton pattern — initialized once at startup, closed at shutdown.
Falls back gracefully if Redis is unavailable.
"""

import logging
import os

from redis.asyncio import Redis

logger = logging.getLogger(__name__)

# Redis configuration from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Global async Redis client (singleton)
redis_client: Redis | None = None


async def init_redis() -> Redis | None:
    """
    Initialize async Redis connection.

    Called during app startup (lifespan). Returns the client if
    successful, None if Redis is unavailable.
    """
    global redis_client

    try:
        client = Redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,  # Read timeout — prevents hanging on slow responses
        )
        await client.ping()
        redis_client = client
        logger.info("Redis connected: %s", REDIS_URL)
        return redis_client
    except Exception as e:
        logger.warning("Redis unavailable: %s. App will fall back to PostgreSQL.", e)
        redis_client = None
        return None


async def get_redis() -> Redis | None:
    """Get the global async Redis client (None if unavailable)."""
    return redis_client


async def close_redis() -> None:
    """Close Redis connection on shutdown."""
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None
