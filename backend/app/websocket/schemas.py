from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


# Client → Server Messages (Actions)
class WSSubscribe(BaseModel):
    """Client request to subscribe to a room"""

    action: Literal["subscribe"]
    room_id: int


class WSUnsubscribe(BaseModel):
    """Client request to unsubscribe from a room"""

    action: Literal["unsubscribe"]
    room_id: int


class WSSendMessage(BaseModel):
    """Client request to send a message"""

    action: Literal["send_message"]
    room_id: int
    content: str = Field(min_length=1, max_length=1000)


# Server → Client Messages (Events)
class WSUser(BaseModel):
    """User info for WebSocket messages"""

    id: int
    username: str


class WSMessage(BaseModel):
    """Message info for WebSocket responses"""

    id: int
    room_id: int
    user_id: int
    username: str
    content: str
    created_at: datetime


class WSSubscribed(BaseModel):
    """Server confirms subscription to room"""

    type: Literal["subscribed"]
    room_id: int
    online_users: list[WSUser]


class WSUnsubscribed(BaseModel):
    """Server confirms unsubscription from room"""

    type: Literal["unsubscribed"]
    room_id: int


class WSNewMessage(BaseModel):
    """Server broadcasts new message"""

    type: Literal["new_message"]
    message: WSMessage


class WSUserJoined(BaseModel):
    """Server notifies that user joined room"""

    type: Literal["user_joined"]
    room_id: int
    user: WSUser


class WSUserLeft(BaseModel):
    """Server notifies that user left room"""

    type: Literal["user_left"]
    room_id: int
    user: WSUser


class WSError(BaseModel):
    """Server sends error message"""

    type: Literal["error"]
    message: str
