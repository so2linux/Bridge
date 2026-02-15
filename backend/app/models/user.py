from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text
from app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    username = Column(String(12), unique=True, index=True, nullable=True)  # @username 5-12 eng letters
    display_name = Column(String(100), default="")
    about_me = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    balance = Column(Float, default=0.0, nullable=False)  # BRG currency
    last_lantern_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True)
    banned_until = Column(DateTime(timezone=True), nullable=True)
    frozen_until = Column(DateTime(timezone=True), nullable=True)
    hide_email = Column(Boolean, default=False)  # не показывать почту другим в поиске и т.д.
    email_verified = Column(Boolean, default=False, nullable=False)
    verification_code = Column(String(6), nullable=True)
    verification_code_expires = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
