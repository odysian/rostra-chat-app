import time

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class ConnectionManager:
    MAX_SUBSCRIPTIONS_PER_CONNECTION = 50

    """
    Manages WebSocket connections and room subscriptions.

    Tracks:
    - Active WebSocket connections and their associated user IDs
    - Room subscriptions (which connections are in which rooms)

    Provides:
    - Connection/disconnection handling
    - Room subscription management
    - Message broadcasting to room subscribers
    """

    def __init__(self):
        # WebSocket -> User ID mapping
        self.active_connections: dict[WebSocket, int] = {}
        # Room ID -> Set of WebSockets mapping
        self.room_subscriptions: dict[int, set[WebSocket]] = {}
        # Per-user message rate tracking: user_id -> (window_start, count)
        self._message_counts: dict[int, tuple[float, int]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """
        Register a new WebSocket connection.

        Args:
            websocket: The WebSocket connection object
            user_id: ID of the authenticated user
        """

        await websocket.accept()
        self.active_connections[websocket] = user_id

    def disconnect(self, websocket: WebSocket) -> list[int]:
        """
        Remove a WebSocket connection and clean up all its subscriptions.

        Args:
            websocket: The WebSocket connection to remove
        """

        rooms_user_was_in = []

        # Remove active connection; rate limit state is intentionally kept —
        # it expires naturally after 60s, preventing bypass via reconnect.
        self.active_connections.pop(websocket, None)

        # Remove from all room subscriptions
        rooms_to_cleanup = []
        for room_id, subscribers in self.room_subscriptions.items():
            if websocket in subscribers:
                rooms_user_was_in.append(room_id)
                subscribers.remove(websocket)
                # Mark empty rooms for cleanup
                if len(subscribers) == 0:
                    rooms_to_cleanup.append(room_id)

        # Clean up empty room sets
        for room_id in rooms_to_cleanup:
            del self.room_subscriptions[room_id]

        return rooms_user_was_in

    def check_message_rate(self, user_id: int, max_per_minute: int = 30) -> bool:
        """
        Fixed-window rate limit for WebSocket message sends.

        Returns True if the message is allowed, False if rate limit exceeded.
        Tracks per-user message count within a 60-second window.
        """
        now = time.monotonic()
        window_start, count = self._message_counts.get(user_id, (now, 0))

        # Reset window if 60s have passed
        if now - window_start >= 60.0:
            self._message_counts[user_id] = (now, 1)
            return True

        if count >= max_per_minute:
            return False

        self._message_counts[user_id] = (window_start, count + 1)
        return True

    def subscribe_to_room(self, websocket: WebSocket, room_id: int) -> bool:
        """
        Subscribe a WebSocket connection to a room.

        Args:
            websocket: The WebSocket connection
            room_id: ID of the room to subscribe to

        Returns:
            True if subscription is active, False if per-connection limit would be exceeded.
        """
        if room_id in self.room_subscriptions and websocket in self.room_subscriptions[room_id]:
            return True

        subscription_count = sum(
            1 for subscribers in self.room_subscriptions.values() if websocket in subscribers
        )
        if subscription_count >= self.MAX_SUBSCRIPTIONS_PER_CONNECTION:
            return False

        if room_id not in self.room_subscriptions:
            self.room_subscriptions[room_id] = set()

        self.room_subscriptions[room_id].add(websocket)
        return True

    def unsubscribe_from_room(self, websocket: WebSocket, room_id: int):
        """
        Unsubscribe a WebSocket connection from a room.

        Args:
            websocket: The WebSocket connection
            room_id: ID of the room to unsubscribe from
        """

        if room_id in self.room_subscriptions:
            self.room_subscriptions[room_id].discard(websocket)

            if len(self.room_subscriptions[room_id]) == 0:
                del self.room_subscriptions[room_id]

    async def broadcast_to_room(
        self, room_id: int, message: dict, exclude: WebSocket | None = None
    ):
        """
        Send a message to all subscribers of a room.

        Args:
            room_id: ID of the room to broadcast to
            message: Dictionary to send as JSON
            exclude: Optional WebSocket to skip (e.g. the sender)
        """

        if room_id not in self.room_subscriptions:
            return  # Nobody subscribed, do nothing

        # Send to all subscribers. A single stale socket must not block delivery
        # to the rest of the room.
        dead_connections: list[WebSocket] = []
        for connection in self.room_subscriptions[room_id]:
            if connection != exclude:
                try:
                    await connection.send_json(message)
                except Exception:
                    dead_connections.append(connection)

        if not dead_connections:
            return

        subscribers = self.room_subscriptions.get(room_id)
        if subscribers is None:
            return

        for connection in dead_connections:
            subscribers.discard(connection)

        if len(subscribers) == 0:
            del self.room_subscriptions[room_id]

    async def get_room_users(self, room_id: int, db: AsyncSession) -> list[User]:
        """
        Get list of users currently subscribed to a room.

        Now async — uses select() + await db.execute() instead of db.query().

        Args:
            room_id: ID of the room
            db: Async database session

        Returns:
            List of User objects currently in the room
        """

        if room_id not in self.room_subscriptions:
            return []

        # Get user IDs from websockets
        user_ids = []
        for websocket in self.room_subscriptions[room_id]:
            if websocket in self.active_connections:
                user_ids.append(self.active_connections[websocket])

        if not user_ids:
            return []

        # Fetch User objects from database
        result = await db.execute(select(User).where(User.id.in_(user_ids)))
        return list(result.scalars().all())


manager = ConnectionManager()
