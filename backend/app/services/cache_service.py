"""
Cache service for unread message counts.

Uses Redis hashes to store per-user unread counts:
- Key pattern: rostra:unread:user_{user_id}
- Hash structure: {room_id: count, room_id: count, ...}

Example:
    rostra:unread:user_123 → {"456": "5", "789": "2"}
"""

import logging
from typing import Any, Dict, Optional, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_redis
from app.crud import user_room as user_room_crud
from app.models.user_room import UserRoom

logger = logging.getLogger(__name__)

# Cache expiration: 24 hours (86400 seconds)
CACHE_TTL = 86400


class UnreadCountCache:
    """Manages unread count caching in Redis"""

    @staticmethod
    def _get_key(user_id: int) -> str:
        """Generate Redis key for user's unread counts"""
        return f"rostra:unread:user_{user_id}"

    @staticmethod
    async def get_unread_counts(user_id: int, db: AsyncSession) -> Dict[int, int]:
        """
        Get unread counts for all user's rooms.

        Tries Redis first (fast). Falls back to PostgreSQL on cache miss.

        Args:
            user_id: User ID
            db: Async database session

        Returns:
            Dict mapping room_id → unread_count
        """
        redis_client = await get_redis()

        if not redis_client:
            logger.debug("Redis unavailable, querying DB for user %s", user_id)
            return await UnreadCountCache._populate_from_db(user_id, db)

        try:
            key = UnreadCountCache._get_key(user_id)
            cached_data = await redis_client.hgetall(key)

            if cached_data:
                logger.debug("Cache hit for user %s", user_id)
                return {
                    int(room_id): int(count) for room_id, count in cached_data.items()
                }
            logger.debug("Cache miss for user %s, populating...", user_id)
            return await UnreadCountCache._populate_from_db(user_id, db, redis_client)

        except Exception as e:
            logger.error("Redis error for user %s: %s", user_id, e)
            return await UnreadCountCache._populate_from_db(user_id, db)

    @staticmethod
    async def _populate_from_db(
        user_id: int,
        db: AsyncSession,
        redis_client: Optional[Any] = None,
    ) -> Dict[int, int]:
        """
        Query database for unread counts and populate Redis.

        Args:
            user_id: User ID
            db: Async database session
            redis_client: Optional async Redis client (if available)

        Returns:
            Dict mapping room_id → unread_count
        """
        # Get all rooms user is a member of
        result = await db.execute(
            select(UserRoom).where(UserRoom.user_id == user_id)
        )
        memberships = result.scalars().all()

        unread_counts: Dict[int, int] = {}
        for membership in memberships:
            rid = cast(int, membership.room_id)
            count = await user_room_crud.get_unread_count(db, user_id, rid)
            unread_counts[rid] = count

        # Store in Redis if available
        if redis_client and unread_counts:
            try:
                key = UnreadCountCache._get_key(user_id)
                redis_data = {
                    str(room_id): str(count) for room_id, count in unread_counts.items()
                }
                await redis_client.hset(key, mapping=redis_data)
                await redis_client.expire(key, CACHE_TTL)
                logger.debug(
                    "Populated cache for user %s with %s rooms",
                    user_id,
                    len(unread_counts),
                )
            except Exception as e:
                logger.error("Failed to populate cache for user %s: %s", user_id, e)

        return unread_counts

    @staticmethod
    async def increment_unread(user_id: int, room_id: int) -> None:
        """
        Increment unread count for a room.

        Called when a new message arrives for the user.
        Uses atomic HINCRBY operation (no race conditions).
        """
        redis_client = await get_redis()
        if not redis_client:
            return

        try:
            key = UnreadCountCache._get_key(user_id)
            await redis_client.hincrby(key, str(room_id), 1)
            await redis_client.expire(key, CACHE_TTL)
        except Exception as e:
            logger.error(
                "Failed to increment unread for user %s, room %s: %s",
                user_id,
                room_id,
                e,
            )

    @staticmethod
    async def reset_unread(user_id: int, room_id: int) -> None:
        """
        Reset unread count to 0 for a room.

        Called when user marks room as read or sends a message.
        """
        redis_client = await get_redis()
        if not redis_client:
            return

        try:
            key = UnreadCountCache._get_key(user_id)
            await redis_client.hset(key, str(room_id), "0")
            await redis_client.expire(key, CACHE_TTL)
        except Exception as e:
            logger.error(
                "Failed to reset unread for user %s, room %s: %s",
                user_id,
                room_id,
                e,
            )
