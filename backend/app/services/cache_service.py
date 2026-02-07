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

from app.core.redis import get_redis
from app.crud import user_room as user_room_crud
from app.models.user_room import UserRoom
from sqlalchemy.orm import Session

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
    def get_unread_counts(user_id: int, db: Session) -> Dict[int, int]:
        """
        Get unread counts for all user's rooms.

        Tries Redis first (fast). Falls back to PostgreSQL on cache miss.

        Args:
            user_id: User ID
            db: Database session

        Returns:
            Dict mapping room_id → unread_count
        """
        redis_client = get_redis()

        if not redis_client:
            # Redis unavailable - query database
            logger.debug("Redis unavailable, querying DB for user %s", user_id)
            return UnreadCountCache._populate_from_db(user_id, db)

        try:
            key = UnreadCountCache._get_key(user_id)
            # Sync redis client returns dict when decode_responses=True; cast for type checker
            cached_data = cast(Dict[str, str], redis_client.hgetall(key))

            if cached_data:
                # Cache hit! Convert string keys to int
                logger.debug("✓ Cache hit for user %s", user_id)
                return {
                    int(room_id): int(count) for room_id, count in cached_data.items()
                }
            # Cache miss - populate from database
            logger.debug("✗ Cache miss for user %s, populating...", user_id)
            return UnreadCountCache._populate_from_db(user_id, db, redis_client)

        except Exception as e:
            logger.error("Redis error for user %s: %s", user_id, e)
            # Fall back to database
            return UnreadCountCache._populate_from_db(user_id, db)

    @staticmethod
    def _populate_from_db(
        user_id: int,
        db: Session,
        redis_client: Optional[Any] = None,
    ) -> Dict[int, int]:
        """
        Query database for unread counts and populate Redis.

        Args:
            user_id: User ID
            db: Database session
            redis_client: Optional Redis client (if available)

        Returns:
            Dict mapping room_id → unread_count
        """
        # Get all rooms user is a member of
        memberships = db.query(UserRoom).filter(UserRoom.user_id == user_id).all()

        unread_counts: Dict[int, int] = {}
        for membership in memberships:
            # Calculate unread count (cast for SQLAlchemy Column type)
            rid = cast(int, membership.room_id)
            count = user_room_crud.get_unread_count(db, user_id, rid)
            unread_counts[rid] = count

        # Store in Redis if available
        if redis_client and unread_counts:
            try:
                key = UnreadCountCache._get_key(user_id)
                # Convert to string keys/values for Redis
                redis_data = {
                    str(room_id): str(count) for room_id, count in unread_counts.items()
                }
                redis_client.hset(key, mapping=redis_data)
                redis_client.expire(key, CACHE_TTL)
                logger.debug(
                    "✓ Populated cache for user %s with %s rooms",
                    user_id,
                    len(unread_counts),
                )
            except Exception as e:
                logger.error("Failed to populate cache for user %s: %s", user_id, e)

        return unread_counts

    @staticmethod
    def increment_unread(user_id: int, room_id: int) -> None:
        """
        Increment unread count for a room.

        Called when a new message arrives for the user.
        Uses atomic HINCRBY operation (no race conditions).

        Args:
            user_id: User who should see increased unread count
            room_id: Room where message was sent
        """
        redis_client = get_redis()
        if not redis_client:
            return  # Redis unavailable, no caching

        try:
            key = UnreadCountCache._get_key(user_id)
            redis_client.hincrby(key, str(room_id), 1)  # Atomic increment
            redis_client.expire(key, CACHE_TTL)  # Refresh TTL
            logger.debug("✓ Incremented unread for user %s, room %s", user_id, room_id)
        except Exception as e:
            logger.error(
                "Failed to increment unread for user %s, room %s: %s",
                user_id,
                room_id,
                e,
            )

    @staticmethod
    def reset_unread(user_id: int, room_id: int) -> None:
        """
        Reset unread count to 0 for a room.

        Called when user marks room as read or sends a message.

        Args:
            user_id: User who marked room as read
            room_id: Room that was marked as read
        """
        redis_client = get_redis()
        if not redis_client:
            return  # Redis unavailable, no caching

        try:
            key = UnreadCountCache._get_key(user_id)
            redis_client.hset(key, str(room_id), "0")  # Redis decode_responses expects str
            redis_client.expire(key, CACHE_TTL)  # Refresh TTL
            logger.debug("✓ Reset unread for user %s, room %s", user_id, room_id)
        except Exception as e:
            logger.error(
                "Failed to reset unread for user %s, room %s: %s",
                user_id,
                room_id,
                e,
            )
