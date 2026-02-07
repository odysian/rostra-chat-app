"""
Redis client for caching unread counts.

This module provides a singleton Redis connection used throughout the application.
Falls back gracefully if Redis is unavailable.
"""

import logging
import os
from typing import Optional

import redis

logger = logging.getLogger(__name__)

# Redis configuration from environment
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# Global Redis client (singleton pattern)
redis_client: Optional[redis.Redis] = None


def init_redis() -> Optional[redis.Redis]:
    """
    Initialize Redis connection.

    Returns:
        Redis client if successful, None if connection fails
    """
    global redis_client

    try:
        client = redis.Redis.from_url(
            REDIS_URL,
            decode_responses=True,  # Auto-decode bytes to str
            socket_connect_timeout=5,  # Timeout after 5 seconds
        )
        # Test connection (client is always Redis here; type stub may suggest optional)
        if client is not None:
            client.ping()
        redis_client = client
        logger.info("✓ Redis connected: %s", REDIS_URL)
        return redis_client
    except (redis.ConnectionError, redis.TimeoutError) as e:
        logger.warning("✗ Redis unavailable: %s. App will fall back to PostgreSQL.", e)
        redis_client = None
        return None


def get_redis() -> Optional[redis.Redis]:
    """
    Get the global Redis client.

    Returns:
        Redis client if available, None otherwise
    """
    return redis_client
