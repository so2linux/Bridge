from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MessageCreate(BaseModel):
    content: str
    message_type: str = "text"
    gift_id: Optional[int] = None


class MessageUpdate(BaseModel):
    content: str


class ReactionItem(BaseModel):
    emoji: str
    count: int


class MessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    content: str
    message_type: str
    gift_id: Optional[int] = None
    is_edited: bool
    is_deleted: bool
    edited_at: Optional[datetime] = None
    created_at: datetime
    reactions: Optional[list[ReactionItem]] = None
    my_reaction: Optional[str] = None

    class Config:
        from_attributes = True
