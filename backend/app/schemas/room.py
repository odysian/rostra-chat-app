from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class RoomCreate(BaseModel):
    """Schema for creating a room"""

    name: str = Field(min_length=3, max_length=50)

    @field_validator("name", mode="before")
    @classmethod
    def trim_whitespace(cls, v: str) -> str:
        """Trim whitespace from room name before validation."""
        if isinstance(v, str):
            return v.strip()
        return v


class RoomResponse(BaseModel):
    """Schema for room in responses"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    created_by: int
    created_at: datetime
    last_read_at: datetime | None = None
    unread_count: int | None = None  # Optional field for unread count


class RoomReadResponse(BaseModel):
    """Schema for room read-marker update response."""

    status: str
    room_id: int
    last_read_at: datetime | None
