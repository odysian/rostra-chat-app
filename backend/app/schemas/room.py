from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RoomCreate(BaseModel):
    """Schema for creating a room"""

    name: str = Field(min_length=3, max_length=50)
    description: str | None = Field(default=None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def trim_whitespace(cls, v: str) -> str:
        """Trim whitespace from room name before validation."""
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("description", mode="before")
    @classmethod
    def normalize_description(cls, v: str | None) -> str | None:
        """Normalize optional descriptions; empty values clear to null."""
        if v is None:
            return None
        if isinstance(v, str):
            trimmed = v.strip()
            if "\n" in trimmed or "\r" in trimmed:
                raise ValueError("Description cannot contain newline characters")
            return trimmed or None
        return v


class RoomUpdate(BaseModel):
    """Schema for creator-only room metadata updates."""

    name: str | None = Field(default=None, min_length=3, max_length=50)
    description: str | None = Field(default=None, max_length=255)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name_whitespace(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator("description", mode="before")
    @classmethod
    def normalize_update_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if isinstance(v, str):
            trimmed = v.strip()
            if "\n" in trimmed or "\r" in trimmed:
                raise ValueError("Description cannot contain newline characters")
            return trimmed or None
        return v

    @model_validator(mode="after")
    def ensure_room_update_payload(self) -> "RoomUpdate":
        if "name" in self.model_fields_set and self.name is None:
            raise ValueError("Name cannot be null")
        if not self.model_fields_set:
            raise ValueError("Provide at least one field to update")
        return self


class RoomResponse(BaseModel):
    """Schema for room in responses"""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    created_by: int
    created_at: datetime
    last_read_at: datetime | None = None
    unread_count: int | None = None  # Optional field for unread count


class RoomReadResponse(BaseModel):
    """Schema for room read-marker update response."""

    status: str
    room_id: int
    last_read_at: datetime | None
