from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from app.db.session import Base


class SyncPoint(Base):
    """Shared To-Do list attached to a chat."""
    __tablename__ = "sync_points"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), default="Sync Points")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class SyncPointItem(Base):
    """Single to-do item in a Sync Point list."""
    __tablename__ = "sync_point_items"

    id = Column(Integer, primary_key=True, index=True)
    sync_point_id = Column(Integer, ForeignKey("sync_points.id", ondelete="CASCADE"), nullable=False)
    text = Column(String(500), nullable=False)
    is_done = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
