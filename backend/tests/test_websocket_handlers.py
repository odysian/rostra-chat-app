from typing import Any, cast

from fastapi import WebSocket

from app.websocket.handlers import safe_send, send_error


class DummyWebSocket:
    def __init__(self, should_fail: bool = False):
        self.should_fail = should_fail
        self.sent_messages: list[dict[str, Any]] = []

    async def send_json(self, payload: dict[str, Any]):
        if self.should_fail:
            raise RuntimeError("socket closed")
        self.sent_messages.append(payload)


async def test_safe_send_returns_true_and_sends_payload():
    ws = DummyWebSocket()

    result = await safe_send(
        cast(WebSocket, ws),
        {"type": "subscribed", "room_id": 1},
        context="test",
    )

    assert result is True
    assert ws.sent_messages == [{"type": "subscribed", "room_id": 1}]


async def test_safe_send_returns_false_when_send_fails():
    ws = DummyWebSocket(should_fail=True)

    result = await safe_send(
        cast(WebSocket, ws),
        {"type": "subscribed", "room_id": 1},
        context="test",
    )

    assert result is False


async def test_send_error_includes_details_payload():
    ws = DummyWebSocket()

    await send_error(
        cast(WebSocket, ws),
        "Invalid typing message format",
        details=[{"loc": ["room_id"], "msg": "Field required"}],
    )

    assert ws.sent_messages == [
        {
            "type": "error",
            "message": "Invalid typing message format",
            "details": [{"loc": ["room_id"], "msg": "Field required"}],
        }
    ]


async def test_send_error_does_not_raise_on_send_failure():
    ws = DummyWebSocket(should_fail=True)

    await send_error(cast(WebSocket, ws), "Not a member of this room")
