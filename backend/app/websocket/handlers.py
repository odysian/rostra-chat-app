from typing import Any

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.logging import logger
from app.core.security import decode_access_token
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user as user_crud
from app.crud import user_room as user_room_crud
from app.models.user_room import UserRoom
from app.schemas.message import MessageCreate
from app.services.cache_service import UnreadCountCache
from app.websocket.connection_manager import manager
from app.websocket.schemas import (
    WSError,
    WSMessage,
    WSNewMessage,
    WSSendMessage,
    WSSubscribe,
    WSSubscribed,
    WSTypingIndicator,
    WSUnsubscribe,
    WSUnsubscribed,
    WSUser,
    WSUserJoined,
    WSUserLeft,
    WSUserTyping,
)


async def websocket_endpoint(websocket: WebSocket, token: str) -> None:
    """
    Main WebSocket endpoint for real-time chat.

    Key architectural change from sync version:
    - No db parameter — sessions are created per-message, not per-connection.
    - Auth extracts plain values (user_id, username) so no ORM object
      crosses session boundaries.
    - Each message gets its own short-lived session, like a mini HTTP request.
    """

    # Authenticate before accepting connection
    user_id = decode_access_token(token)
    if not user_id:
        logger.warning("WebSocket connection rejected: Invalid token")
        await websocket.close(code=1008, reason="Invalid token")
        return

    # Short-lived session just for auth lookup
    async with AsyncSessionLocal() as db:
        user = await user_crud.get_user_by_id(db, int(user_id))
        if not user:
            logger.warning(f"WebSocket connection rejected: User {user_id} not found")
            await websocket.close(code=1008, reason="User not found")
            return
        # Extract plain values before session closes — no ORM object leak
        user_id_int: int = user.id
        username: str = user.username

    # Accept connection and register with manager
    await manager.connect(websocket, user_id_int)
    logger.info(f"User connected: {username} (ID: {user_id_int})")

    try:
        # Message handling loop
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            if action == "unsubscribe":
                # Unsubscribe has no DB operations — no session needed
                await handle_unsubscribe(websocket, data, user_id_int, username)

            elif action == "user_typing":
                # Typing indicator uses in-memory subscription check — no DB needed
                await handle_user_typing(websocket, data, user_id_int, username)

            elif action in ("subscribe", "send_message"):
                # Check rate limit before opening a DB session for send_message
                if action == "send_message":
                    if not manager.check_message_rate(user_id_int):
                        await send_error(
                            websocket, "Rate limit exceeded. Please slow down."
                        )
                        continue

                # New session per message — like a mini HTTP request.
                # Session opens, handler does its work, session closes.
                # Connection returned to pool immediately.
                async with AsyncSessionLocal() as db:
                    if action == "subscribe":
                        await handle_subscribe(
                            websocket, data, user_id_int, username, db
                        )
                    else:
                        await handle_send_message(
                            websocket, data, user_id_int, username, db
                        )

            else:
                logger.warning(f"Unknown action from {username}: {action}")
                await send_error(websocket, f"Unknown action: {action}")

    except WebSocketDisconnect:
        logger.info(f"User disconnected: {username} (ID: {user_id_int})")
        rooms_user_was_in = manager.disconnect(websocket)

        for room_id in rooms_user_was_in:
            await manager.broadcast_to_room(
                room_id,
                WSUserLeft(
                    type="user_left",
                    room_id=room_id,
                    user=WSUser(id=user_id_int, username=username),
                ).model_dump(mode="json"),
            )

    except Exception as e:
        logger.error(f"WebSocket error for {username}: {e}", exc_info=True)
        manager.disconnect(websocket)


async def handle_subscribe(
    websocket: WebSocket,
    data: dict[str, Any],
    user_id: int,
    username: str,
    db: AsyncSession,
) -> None:
    """
    Handle room subscription request.

    Validates request, checks room exists, subscribes user,
    sends confirmation with online users, and notifies room.
    """

    # Validate message with Pydantic
    try:
        msg = WSSubscribe(**data)
    except ValidationError as e:
        logger.warning(f"Invalid subscribe message from {username}: {e}")
        await send_error(websocket, "Invalid subscribe message format", e.errors())
        return

    # Verify room exists
    room = await room_crud.get_room_by_id(db, msg.room_id)
    if not room:
        logger.warning(
            f"User {username} tried to subscribe to non-existent room {msg.room_id}"
        )
        await send_error(websocket, "Room not found")
        return

    # Check if user is a member
    membership = await user_room_crud.get_user_room(db, user_id, msg.room_id)
    if not membership:
        logger.warning(
            f"User {username} tried to subscribe to room {msg.room_id} without membership"
        )
        await send_error(websocket, "Not a member of this room")
        return

    # Subscribe to room
    manager.subscribe_to_room(websocket, msg.room_id)
    logger.info(f"User {username} subscribed to room '{room.name}' (ID: {room.id})")

    # Get online users (uses the same short-lived session)
    online_users = await manager.get_room_users(msg.room_id, db)
    online_users_data = [WSUser(id=u.id, username=u.username) for u in online_users]

    # Send confirmation to subscriber
    response = WSSubscribed(
        type="subscribed", room_id=msg.room_id, online_users=online_users_data
    )
    await websocket.send_json(response.model_dump(mode="json"))

    # Notify others in room
    notification = WSUserJoined(
        type="user_joined",
        room_id=msg.room_id,
        user=WSUser(id=user_id, username=username),
    )

    await manager.broadcast_to_room(
        msg.room_id, notification.model_dump(mode="json"), exclude=websocket
    )


async def handle_unsubscribe(
    websocket: WebSocket,
    data: dict[str, Any],
    user_id: int,
    username: str,
) -> None:
    """Handle room unsubscription request. No DB session needed."""

    # Validate message
    try:
        msg = WSUnsubscribe(**data)
    except ValidationError as e:
        logger.warning(f"Invalid unsubscribe message from {username}: {e}")
        await send_error(websocket, "Invalid unsubscribe message format", e.errors())
        return

    # Unsubscribe from room
    manager.unsubscribe_from_room(websocket, msg.room_id)
    logger.info(f"User {username} unsubscribed from room ID {msg.room_id}")

    # Send confirmation
    response = WSUnsubscribed(type="unsubscribed", room_id=msg.room_id)
    await websocket.send_json(response.model_dump(mode="json"))

    # Notify others
    notification = WSUserLeft(
        type="user_left",
        room_id=msg.room_id,
        user=WSUser(id=user_id, username=username),
    )
    await manager.broadcast_to_room(msg.room_id, notification.model_dump(mode="json"))


async def handle_user_typing(
    websocket: WebSocket,
    data: dict[str, Any],
    user_id: int,
    username: str,
) -> None:
    """
    Handle user typing notification. No DB session needed.

    Uses in-memory subscription check instead of DB query — subscription
    implies verified room membership (validated during subscribe).
    """

    # Validate message
    try:
        msg = WSUserTyping(**data)
    except ValidationError as e:
        logger.warning(f"Invalid user_typing message from {username}: {e}")
        await send_error(websocket, "Invalid typing message format", e.errors())
        return

    # Check subscription in-memory (O(1), no DB query needed)
    # Subscription implies membership because handle_subscribe validates it
    if websocket not in manager.room_subscriptions.get(msg.room_id, set()):
        logger.warning(
            f"User {username} tried to send typing event without subscription to room {msg.room_id}"
        )
        await send_error(websocket, "Not subscribed to this room")
        return

    # Broadcast typing indicator to other room members (exclude sender)
    typing_event = WSTypingIndicator(
        type="typing_indicator",
        room_id=msg.room_id,
        user=WSUser(id=user_id, username=username),
    )

    await manager.broadcast_to_room(
        msg.room_id, typing_event.model_dump(mode="json"), exclude=websocket
    )

    logger.debug(
        f"Typing indicator sent: {username} → room {msg.room_id}",
        extra={"user_id": user_id, "room_id": msg.room_id},
    )


async def handle_send_message(
    websocket: WebSocket,
    data: dict[str, Any],
    user_id: int,
    username: str,
    db: AsyncSession,
) -> None:
    """
    Handle message send request.

    Validates message, checks room exists, saves to database,
    updates cache for sender and recipients, and broadcasts to room.
    """

    # Validate message
    try:
        msg = WSSendMessage(**data)
    except ValidationError as e:
        logger.warning("Invalid send_message from %s: %s", username, e)
        await send_error(websocket, "Invalid message format", e.errors())
        return

    # Verify room exists
    room = await room_crud.get_room_by_id(db, msg.room_id)
    if not room:
        logger.warning(
            "User %s tried to send message to non-existent room %s",
            username,
            msg.room_id,
        )
        await send_error(websocket, "Room not found")
        return

    # Check if user is a member
    membership = await user_room_crud.get_user_room(db, user_id, msg.room_id)
    if not membership:
        logger.warning(
            "User %s tried to send message to room %s without membership",
            username,
            msg.room_id,
        )
        await send_error(websocket, "Not a member of this room")
        return

    # Save to database first
    message_create = MessageCreate(room_id=msg.room_id, content=msg.content)
    db_message = await message_crud.create_message(db, message_create, user_id)

    # Sending a message implies the user has read up to now; keep last_read_at in sync
    await user_room_crud.mark_room_read(db, user_id, msg.room_id)

    # ========== CACHE UPDATES START ==========
    # Reset sender's unread count (they just sent a message = caught up)
    await UnreadCountCache.reset_unread(user_id, msg.room_id)

    # Increment unread count for all OTHER members of the room
    result = await db.execute(
        select(UserRoom).where(
            UserRoom.room_id == msg.room_id,
            UserRoom.user_id != user_id,
        )
    )
    other_memberships = result.scalars().all()

    for other_member in other_memberships:
        await UnreadCountCache.increment_unread(other_member.user_id, msg.room_id)
    # ========== CACHE UPDATES END ==========

    logger.info(
        "Message saved: User %s → Room '%s' (ID: %s)",
        username,
        room.name,
        room.id,
        extra={"message_id": db_message.id, "content_length": len(msg.content)},
    )

    # Broadcast to all subscribers
    broadcast_msg = WSNewMessage(
        type="new_message",
        message=WSMessage(
            id=db_message.id,
            room_id=db_message.room_id,
            user_id=db_message.user_id,
            username=username,
            content=db_message.content,
            created_at=db_message.created_at,
        ),
    )
    await manager.broadcast_to_room(msg.room_id, broadcast_msg.model_dump(mode="json"))


async def send_error(websocket: WebSocket, message: str, details: Any = None) -> None:
    """
    Send standardized error message to client.

    Args:
        websocket: The WebSocket to send to
        message: User-friendly error message
        details: Optional technical details (validation errors, etc.)
    """
    error_response = WSError(type="error", message=message)
    error_dict = error_response.model_dump(mode="json")

    if details:
        error_dict["details"] = details

    await websocket.send_json(error_dict)
