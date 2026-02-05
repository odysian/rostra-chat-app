from datetime import datetime

from pydantic import BaseModel, Field


class RoomCreate(BaseModel):
    """Schema for creating a room"""

    name: str = Field(min_length=3, max_length=50)


class RoomResponse(BaseModel):
    """Schema for room in responses"""

    id: int
    name: str
    created_by: int
    created_at: datetime
    unread_count: int | None = None  # Optional field for unread count

    class Config:
        from_attributes = True
