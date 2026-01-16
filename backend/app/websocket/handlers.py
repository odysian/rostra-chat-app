# type: ignore

from typing import Any, Dict

from app.core.database import get_db
from app.core.logging import logger
from app.core.security import decode_access_token
from app.crud import message as message_crud
from app.crud import room as room_crud
from app.crud import user as user_crud
from app.models.user import User
from app.schemas.message import MessageCreate
from app.websocket.connection_manager import manager
from app.websocket.schemas import (
    WSError,
    WSMessage,
    WSNewMessage,
    WSSendMessage,
    WSSubscribe,
    WSSubscribed,
    WSUnsubscribe,
    WSUnsubscribed,
    WSUser,
    WSUserJoined,
    WSUserLeft,
)
from fastapi import Depends, WebSocket, WebSocketDisconnect
from pydantic import ValidationError
from sqlalchemy.orm import Session


async def websocket_endpoint(
    websocket: WebSocket, token: str, db: Session = Depends(get_db)
) -> None:
    """
    Main WebSocket endpoint for real-time chat.

    Authenticates user, accepts connection, routes messages to handlers,
    and cleans up on disconnect.

    Args:
        websocket: The WebSocket connection
        token: JWT token from query parameter
        db: Database session
    """

    # Authenticate before accepting connection
    user_id = decode_access_token(token)
    if not user_id:
        logger.warning("WebSocket connection rejected: Invalid token")
        await websocket.close(code=1008, reason="Invalid token")
        return

    user = user_crud.get_user_by_id(db, int(user_id))
    if not user:
        logger.warning(f"WebSocket connection rejected: User {user_id} not found")
        await websocket.close(code=1008, reason="User not found")
        return

    # Accept connection and register with manager
    await manager.connect(websocket, user.id)
    logger.info(f"User connected: {user.username} (ID: {user.id})")

    try:
        # Message handling loop
        while True:
            data = await websocket.receive_json()
            action = data.get("action")

            # Route to handlers
            if action == "subscribe":
                await handle_subscribe(websocket, data, user, db)

            elif action == "unsubscribe":
                await handle_unsubscribe(websocket, data, user, db)

            elif action == "send_message":
                await handle_send_message(websocket, data, user, db)

            else:
                logger.warning(f"Unknown action from {user.username}: {action}")
                await send_error(websocket, f"Unknown action: {action}")

    except WebSocketDisconnect:
        logger.info(f"User disconnected: {user.username} (ID: {user.id})")
        rooms_user_was_in = manager.disconnect(websocket)

        for room_id in rooms_user_was_in:
            await manager.broadcast_to_room(
                room_id,
                WSUserLeft(
                    type="user_left",
                    room_id=room_id,
                    user=WSUser(id=user.id, username=user.username),
                ).model_dump(mode="json"),
            )

    except Exception as e:
        logger.error(f"WebSocket error for {user.username}: {e}", exc_info=True)
        manager.disconnect(websocket)


async def handle_subscribe(
    websocket: WebSocket, data: Dict[str, Any], user: User, db: Session
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
        logger.warning(f"Invalid subscribe message from {user.username}: {e}")
        await send_error(websocket, "Invalid subscribe message format", e.errors())
        return

    # Verify room exists
    room = room_crud.get_room_by_id(db, msg.room_id)
    if not room:
        logger.warning(
            f"User {user.username} tried to subscribe to non-existent room {msg.room_id}"
        )
        await send_error(websocket, "Room not found")
        return

    # Subscribe to room
    manager.subscribe_to_room(websocket, msg.room_id)
    logger.info(
        f"User {user.username} subscribed to room '{room.name}' (ID: {room.id})"
    )

    # Get online users
    online_users = manager.get_room_users(msg.room_id, db)
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
        user=WSUser(id=user.id, username=user.username),
    )

    await manager.broadcast_to_room(
        msg.room_id, notification.model_dump(mode="json"), exclude=websocket
    )


async def handle_unsubscribe(
    websocket: WebSocket, data: Dict[str, Any], user: User, db: Session
) -> None:
    """Handle room unsubscription request"""

    # Validate message
    try:
        msg = WSUnsubscribe(**data)
    except ValidationError as e:
        logger.warning(f"Invalid unsubscribe message from {user.username}: {e}")
        await send_error(websocket, "Invalid unsubscribe message format", e.errors())
        return

    # Unsubscribe from room
    manager.unsubscribe_from_room(websocket, msg.room_id)
    logger.info(f"User {user.username} unsubscribed from room ID {msg.room_id}")

    # Send confirmation
    response = WSUnsubscribed(type="unsubscribed", room_id=msg.room_id)
    await websocket.send_json(response.model_dump(mode="json"))

    # Notify others
    notification = WSUserLeft(
        type="user_left",
        room_id=msg.room_id,
        user=WSUser(id=user.id, username=user.username),
    )
    await manager.broadcast_to_room(msg.room_id, notification.model_dump(mode="json"))


async def handle_send_message(
    websocket: WebSocket, data: Dict[str, Any], user: User, db: Session
) -> None:
    """
    Handle message send request.

    Validates message, checks room exists, saves to database,
    and broadcasts to all room subscribers.
    """

    # Validate message
    try:
        msg = WSSendMessage(**data)
    except ValidationError as e:
        logger.warning(f"Invalid send_message from {user.username}: {e}")
        await send_error(websocket, "Invalid message format", e.errors())
        return

    # Verify room exists
    room = room_crud.get_room_by_id(db, msg.room_id)
    if not room:
        logger.warning(
            f"User {user.username} tried to send message to non-existent room {msg.room_id}"
        )
        await send_error(websocket, "Room not found")
        return

    # Save to database first
    message_create = MessageCreate(room_id=msg.room_id, content=msg.content)
    db_message = message_crud.create_message(db, message_create, user.id)

    logger.info(
        f"Message saved: User {user.username} → Room '{room.name}' (ID: {room.id})",
        extra={"message_id": db_message.id, "content_length": len(msg.content)},
    )

    # Broadcast to all subscribers
    broadcast_msg = WSNewMessage(
        type="new_message",
        message=WSMessage(
            id=db_message.id,
            room_id=db_message.room_id,
            user_id=db_message.user_id,
            username=user.username,
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
