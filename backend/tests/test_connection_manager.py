from typing import Any, cast

from fastapi import WebSocket

from app.websocket.connection_manager import ConnectionManager


class DummyWebSocket:
    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.sent_messages: list[dict[str, Any]] = []

    async def send_json(self, message: dict[str, Any]):
        if self.should_fail:
            raise RuntimeError("socket closed")
        self.sent_messages.append(message)


async def test_broadcast_to_room_continues_after_single_send_failure():
    manager = ConnectionManager()
    room_id = 101
    payload = {"type": "typing_indicator", "room_id": room_id}

    healthy_socket = DummyWebSocket()
    failing_socket = DummyWebSocket(should_fail=True)

    healthy_ws = cast(WebSocket, healthy_socket)
    failing_ws = cast(WebSocket, failing_socket)

    manager.room_subscriptions[room_id] = {healthy_ws, failing_ws}

    await manager.broadcast_to_room(room_id, payload)

    assert healthy_socket.sent_messages == [payload]
    assert healthy_ws in manager.room_subscriptions[room_id]
    assert failing_ws not in manager.room_subscriptions[room_id]


async def test_broadcast_to_room_removes_room_when_all_sends_fail():
    manager = ConnectionManager()
    room_id = 202
    payload = {"type": "typing_indicator", "room_id": room_id}

    failing_socket = DummyWebSocket(should_fail=True)
    failing_ws = cast(WebSocket, failing_socket)
    manager.room_subscriptions[room_id] = {failing_ws}

    await manager.broadcast_to_room(room_id, payload)

    assert room_id not in manager.room_subscriptions


async def test_subscribe_to_room_enforces_max_subscriptions_per_connection():
    manager = ConnectionManager()
    ws = cast(WebSocket, DummyWebSocket())

    for room_id in range(1, manager.MAX_SUBSCRIPTIONS_PER_CONNECTION + 1):
        assert manager.subscribe_to_room(ws, room_id) is True

    assert manager.subscribe_to_room(ws, 999) is False
    assert 999 not in manager.room_subscriptions


async def test_subscribe_to_room_is_idempotent_at_limit():
    manager = ConnectionManager()
    ws = cast(WebSocket, DummyWebSocket())

    for room_id in range(1, manager.MAX_SUBSCRIPTIONS_PER_CONNECTION + 1):
        assert manager.subscribe_to_room(ws, room_id) is True

    existing_room_id = manager.MAX_SUBSCRIPTIONS_PER_CONNECTION
    assert manager.subscribe_to_room(ws, existing_room_id) is True
