from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from app.db.session import Base


class MessageReaction(Base):
    """Реакция эмодзи на сообщение. Один пользователь — одна реакция на сообщение."""
    __tablename__ = "message_reactions"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    emoji = Column(String(20), nullable=False)  # 👍 ❤️ 😂 и т.д.

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_user_reaction"),)
