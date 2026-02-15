from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship
from app.db.session import Base

# Many-to-many: users in a chat
chat_members = Table(
    "chat_members",
    Base.metadata,
    Column("chat_id", Integer, ForeignKey("chats.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=True, index=True)  # "global" для глобального чата
    title = Column(String(200), default="Chat")
    is_group = Column(Boolean, default=False)
    is_secret = Column(Boolean, default=False)  # Secret Bridge: messages self-destruct
    ttl_seconds = Column(Integer, nullable=True)  # message TTL for secret chat (e.g. 60, 300)
    folder_id = Column(Integer, ForeignKey("chat_folders.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    folder = relationship("ChatFolder", back_populates="chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    members = relationship("User", secondary=chat_members, backref="chats")


class ChatFolder(Base):
    __tablename__ = "chat_folders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    order_index = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    chats = relationship("Chat", back_populates="folder", cascade="all, delete-orphan")


class ChatFolderMember(Base):
    """Links user to folder for ordering (optional extra table if needed)."""
    __tablename__ = "chat_folder_members"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    folder_id = Column(Integer, ForeignKey("chat_folders.id", ondelete="CASCADE"), nullable=False)
    order_index = Column(Integer, default=0)
