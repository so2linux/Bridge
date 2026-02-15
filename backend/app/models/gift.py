from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.db.session import Base


class Gift(Base):
    """Catalog of gifts: id, name, description, price, image_url (эмодзи в name пока)."""
    __tablename__ = "gifts"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(50), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    price = Column(Float, nullable=False)  # in BRG
    icon_url = Column(String(500), nullable=True)
    image_url = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

    messages = relationship("Message", back_populates="gift")


class UserGift(Base):
    """Inventory: gifts owned by user (received or bought). Кто отправил, кому, какой подарок и сообщение."""
    __tablename__ = "user_gifts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)  # кому
    gift_id = Column(Integer, ForeignKey("gifts.id", ondelete="CASCADE"), nullable=False)
    quantity = Column(Integer, default=1)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)  # кто отправил
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="SET NULL"), nullable=True)
    message_text = Column(String(500), nullable=True)  # короткое сообщение к подарку
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
