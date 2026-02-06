from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class MessageCreate(BaseModel):
    """Schema for creating a message"""

    room_id: int
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content", mode="before")
    @classmethod
    def trim_whitespace(cls, v: str) -> str:
        """Trim whitespace from message content before validation."""
        if isinstance(v, str):
            return v.strip()
        return v


class MessageResponse(BaseModel):
    """Schema for message in responses"""

    id: int
    room_id: int
    user_id: int
    username: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True
