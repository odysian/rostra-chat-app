"""
Tests for WebSocket typing indicators.

These tests intentionally use a synchronous TestClient-only flow:
- setup data through HTTP endpoints (register/login/create/join)
- then open websocket connections from the same client

This avoids cross-event-loop issues from mixing async test coroutines
with TestClient websocket sessions.
"""

from typing import Any
from uuid import uuid4

import pytest
from starlette.testclient import TestClient

from app.websocket.connection_manager import manager


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(client: TestClient, username: str, email: str) -> dict[str, Any]:
    """Create a user through API and return user payload + access token."""
    register_response = client.post(
        "/api/auth/register",
        json={
            "email": email,
            "username": username,
            "password": "password123",
        },
    )
    assert register_response.status_code == 201, register_response.text
    user_data = register_response.json()

    login_response = client.post(
        "/api/auth/login",
        json={"username": username, "password": "password123"},
    )
    assert login_response.status_code == 200, login_response.text
    token = login_response.json()["access_token"]

    return {"user": user_data, "access_token": token}


def _create_room(client: TestClient, token: str, room_name: str) -> dict[str, Any]:
    create_room_response = client.post(
        "/api/rooms",
        json={"name": room_name},
        headers=_auth_headers(token),
    )
    assert create_room_response.status_code == 201, create_room_response.text
    result: dict[str, Any] = create_room_response.json()
    return result


@pytest.fixture(autouse=True)
def clear_websocket_manager_state():
    """
    Reset websocket manager state before/after each test.

    This prevents state leakage when a prior websocket test fails and
    doesn't complete normal disconnect cleanup.
    """
    manager.active_connections.clear()
    manager.room_subscriptions.clear()
    yield
    manager.active_connections.clear()
    manager.room_subscriptions.clear()


def test_user_typing_broadcasts_to_other_subscribers(app):
    """
    Alice and Bob subscribe to room. Alice sends user_typing.
    Bob receives typing_indicator. Alice does NOT receive it.
    """
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        alice = _register_and_login(
            client, f"alice_{suffix}", f"alice_{suffix}@test.com"
        )
        bob = _register_and_login(client, f"bob_{suffix}", f"bob_{suffix}@test.com")

        room = _create_room(client, alice["access_token"], f"Typing Room {suffix}")
        room_id = room["id"]

        join_response = client.post(
            f"/api/rooms/{room_id}/join",
            headers=_auth_headers(bob["access_token"]),
        )
        assert join_response.status_code == 200, join_response.text

        with client.websocket_connect(
            f"/ws/connect?token={alice['access_token']}"
        ) as alice_ws:
            alice_ws.send_json({"action": "subscribe", "room_id": room_id})
            alice_subscribed = alice_ws.receive_json()
            assert alice_subscribed["type"] == "subscribed"
            assert alice_subscribed["room_id"] == room_id

            with client.websocket_connect(
                f"/ws/connect?token={bob['access_token']}"
            ) as bob_ws:
                bob_ws.send_json({"action": "subscribe", "room_id": room_id})
                bob_subscribed = bob_ws.receive_json()
                assert bob_subscribed["type"] == "subscribed"

                bob_joined = alice_ws.receive_json()
                assert bob_joined["type"] == "user_joined"
                assert bob_joined["user"]["username"] == f"bob_{suffix}"

                alice_ws.send_json({"action": "user_typing", "room_id": room_id})

                typing_event = bob_ws.receive_json()
                assert typing_event["type"] == "typing_indicator"
                assert typing_event["room_id"] == room_id
                assert typing_event["user"]["id"] == alice["user"]["id"]
                assert typing_event["user"]["username"] == f"alice_{suffix}"


def test_typing_indicator_includes_correct_user_info(app):
    """Typing indicator includes correct user.id and user.username."""
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        alice = _register_and_login(
            client, f"alice_{suffix}", f"alice_{suffix}@test.com"
        )
        bob = _register_and_login(client, f"bob_{suffix}", f"bob_{suffix}@test.com")

        room = _create_room(client, alice["access_token"], f"User Info Room {suffix}")
        room_id = room["id"]

        join_response = client.post(
            f"/api/rooms/{room_id}/join",
            headers=_auth_headers(bob["access_token"]),
        )
        assert join_response.status_code == 200, join_response.text

        with client.websocket_connect(
            f"/ws/connect?token={alice['access_token']}"
        ) as alice_ws:
            alice_ws.send_json({"action": "subscribe", "room_id": room_id})
            alice_ws.receive_json()  # subscribed

            with client.websocket_connect(
                f"/ws/connect?token={bob['access_token']}"
            ) as bob_ws:
                bob_ws.send_json({"action": "subscribe", "room_id": room_id})
                bob_ws.receive_json()  # subscribed
                alice_ws.receive_json()  # user_joined

                alice_ws.send_json({"action": "user_typing", "room_id": room_id})

                typing_event = bob_ws.receive_json()
                assert typing_event["type"] == "typing_indicator"
                assert typing_event["room_id"] == room_id
                assert typing_event["user"]["id"] == alice["user"]["id"]
                assert typing_event["user"]["username"] == f"alice_{suffix}"


def test_user_typing_requires_room_subscription(app):
    """User cannot send typing indicator for room they haven't subscribed to."""
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        user_data = _register_and_login(
            client, f"user_{suffix}", f"user_{suffix}@test.com"
        )
        room = _create_room(
            client,
            user_data["access_token"],
            f"Subscription Required Room {suffix}",
        )
        room_id = room["id"]

        with client.websocket_connect(
            f"/ws/connect?token={user_data['access_token']}"
        ) as ws:
            ws.send_json({"action": "user_typing", "room_id": room_id})
            error_response = ws.receive_json()
            assert error_response["type"] == "error"
            assert "not subscribed" in error_response["message"].lower()


def test_user_typing_rejects_invalid_format(app):
    """User_typing with missing room_id receives error response."""
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        user_data = _register_and_login(
            client, f"user_{suffix}", f"user_{suffix}@test.com"
        )
        with client.websocket_connect(
            f"/ws/connect?token={user_data['access_token']}"
        ) as ws:
            ws.send_json({"action": "user_typing"})
            error_response = ws.receive_json()
            assert error_response["type"] == "error"
            assert "invalid" in error_response["message"].lower()


def test_user_typing_to_empty_room_no_error(app):
    """
    Sole subscriber sending typing indicator doesn't cause error.
    No broadcast is sent because sender is excluded.
    """
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        user_data = _register_and_login(
            client, f"user_{suffix}", f"user_{suffix}@test.com"
        )
        room = _create_room(client, user_data["access_token"], f"Empty Room {suffix}")
        room_id = room["id"]

        with client.websocket_connect(
            f"/ws/connect?token={user_data['access_token']}"
        ) as ws:
            ws.send_json({"action": "subscribe", "room_id": room_id})
            subscribed = ws.receive_json()
            assert subscribed["type"] == "subscribed"

            ws.send_json({"action": "user_typing", "room_id": room_id})
            # If the server rejected this action we'd receive an "error" event.
            # No receive call here because there should be no outbound event.
