from typing import Dict, List, Set

from app.crud import user as user_crud
from app.models.user import User
from fastapi import WebSocket
from sqlalchemy.orm import Session


class ConnectionManager:
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
        self.active_connections: Dict[WebSocket, int] = {}
        # Room ID -> Set of WebSockets mapping
        self.room_subscriptions: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        """
        Register a new WebSocket connection.

        Args:
            websocket: The WebSocket connection object
            user_id: ID of the authenticated user
        """

        await websocket.accept()
        self.active_connections[websocket] = user_id

    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection and clean up all its subscriptions.

        Args:
            websocket: The WebSocket connection to remove
        """
        # Remove active connections
        if websocket in self.active_connections:
            del self.active_connections[websocket]

        # Remove from all room subscriptions
        rooms_to_cleanup = []
        for room_id, subscribers in self.room_subscriptions.items():
            if websocket in subscribers:
                subscribers.remove(websocket)
                # Mark empty rooms for cleanup
                if len(subscribers) == 0:
                    rooms_to_cleanup.append(room_id)

        # Clean up empty room sets
        for room_id in rooms_to_cleanup:
            del self.room_subscriptions[room_id]

    def subscribe_to_room(self, websocket: WebSocket, room_id: int):
        """
        Subscribe a WebSocket connection to a room.

        Args:
            websocket: The WebSocket connection
            room_id: ID of the room to subscribe to
        """
        if room_id not in self.room_subscriptions:
            self.room_subscriptions[room_id] = set()

        self.room_subscriptions[room_id].add(websocket)

    def unsubscribe_from_room(self, websocket: WebSocket, room_id: int):
        """
        Unsubscribe a WebSocket connection from a room.

        Args:
            websocket: The WebSocket connection
            room_id: ID of the room to subscribe to
        """

        if room_id in self.room_subscriptions:
            self.room_subscriptions[room_id].discard(websocket)

            if len(self.room_subscriptions[room_id]) == 0:
                del self.room_subscriptions[room_id]

    async def broadcast_to_room(self, room_id: int, message: dict):
        """
        Send a message to all subscribers of a room.

        Args:
            room_id: ID of the room to broadcast to
            message: Dictionary to send as JSON
        """

        if room_id not in self.room_subscriptions:
            return  # Nobody subscribed, do nothing

        # Send to all subscribers
        for websocket in self.room_subscriptions[room_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                # Connection might have died, cleaned up on next disconnect
                print(f"Error sending to websocket: {e}")

    def get_room_users(self, room_id: int, db: Session) -> List[User]:
        """
        Get list of users currently subscribed to a room.

        Args:
            room_id: ID of the room
            db: Database session

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
        users = db.query(User).filter(User.id.in_(user_ids)).all()
        return users


manager = ConnectionManager()
