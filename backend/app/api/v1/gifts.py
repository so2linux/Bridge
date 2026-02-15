from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.deps import get_current_user_verified
from app.models.user import User
from app.models.gift import Gift, UserGift
from app.models.chat import chat_members
from app.models.message import Message, MessageType
from app.schemas.message import MessageResponse
from app.websocket import manager

router = APIRouter()


class GiftResponse(BaseModel):
    id: int
    slug: str
    name: str
    description: str | None
    price: float
    icon_url: str | None
    image_url: str | None

    class Config:
        from_attributes = True


class UserGiftResponse(BaseModel):
    id: int
    gift_id: int
    quantity: int
    slug: str
    name: str
    sender_id: int | None
    sender_name: str | None
    message_text: str | None
    created_at: str

    class Config:
        from_attributes = True


class SendGiftBody(BaseModel):
    to_user_id: int
    gift_id: int
    message: Optional[str] = None
    chat_id: Optional[int] = None


@router.get("/catalog", response_model=list[GiftResponse])
async def catalog(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Gift).order_by(Gift.id))
    gifts = result.scalars().all()
    return [
        GiftResponse(
            id=g.id, slug=g.slug, name=g.name, description=getattr(g, "description", None),
            price=g.price, icon_url=g.icon_url, image_url=getattr(g, "image_url", None) or g.icon_url
        )
        for g in gifts
    ]


@router.get("/inventory", response_model=list[UserGiftResponse])
async def inventory(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(
        select(UserGift, Gift, User)
        .join(Gift, UserGift.gift_id == Gift.id)
        .outerjoin(User, User.id == UserGift.sender_id)
        .where(UserGift.user_id == current_user.id)
    )
    rows = result.all()
    return [
        UserGiftResponse(
            id=ug.id, gift_id=ug.gift_id, quantity=ug.quantity, slug=g.slug, name=g.name,
            sender_id=ug.sender_id,
            sender_name=(s.display_name or s.email) if s else None,
            message_text=getattr(ug, "message_text", None),
            created_at=ug.created_at.isoformat() if ug.created_at else "",
        )
        for ug, g, s in rows
    ]


@router.post("/send-gift")
async def send_gift(
    body: SendGiftBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    """Отправить подарок пользователю: списание BRG, запись в UserGift, системное сообщение в чат (если chat_id)."""
    if body.to_user_id == current_user.id:
        raise HTTPException(400, "Нельзя отправить подарок себе")
    result = await db.execute(select(Gift).where(Gift.id == body.gift_id))
    gift = result.scalar_one_or_none()
    if not gift:
        raise HTTPException(404, "Подарок не найден")
    if (current_user.balance or 0) < gift.price:
        raise HTTPException(400, "Недостаточно BRG")
    result = await db.execute(select(User).where(User.id == body.to_user_id))
    to_user = result.scalar_one_or_none()
    if not to_user:
        raise HTTPException(404, "Получатель не найден")
    message_text = (body.message or "").strip()[:500] if body.message else None
    current_user.balance = (current_user.balance or 0) - gift.price
    ug = UserGift(
        user_id=body.to_user_id,
        gift_id=gift.id,
        quantity=1,
        sender_id=current_user.id,
        message_text=message_text,
    )
    db.add(ug)
    await db.flush()
    chat_message = None
    if body.chat_id:
        member_check = await db.execute(
            select(chat_members.c.chat_id).where(
                chat_members.c.chat_id == body.chat_id,
                chat_members.c.user_id == current_user.id,
            )
        )
        if member_check.first() is not None:
            sender_name = current_user.display_name or current_user.email or "Кто-то"
            emoji = gift.name[0] if gift.name else "🎁"
            content = f"{sender_name} отправил вам подарок {emoji}!"
            if message_text:
                content += f" Сообщение: {message_text}"
            msg = Message(
                chat_id=body.chat_id,
                sender_id=current_user.id,
                content=content,
                message_type=MessageType.GIFT,
                gift_id=gift.id,
            )
            db.add(msg)
            await db.flush()
            ug.message_id = msg.id
            chat_message = MessageResponse(
                id=msg.id, chat_id=msg.chat_id, sender_id=msg.sender_id, content=msg.content,
                message_type=MessageType.GIFT.value, gift_id=msg.gift_id,
                is_edited=False, is_deleted=False, edited_at=None, created_at=msg.created_at,
            )
    await db.commit()
    await db.refresh(current_user)
    msg_payload = None
    if chat_message and body.chat_id:
        msg_payload = {
            "id": chat_message.id, "chat_id": chat_message.chat_id, "sender_id": chat_message.sender_id,
            "content": chat_message.content, "message_type": chat_message.message_type, "gift_id": chat_message.gift_id,
            "is_edited": chat_message.is_edited, "is_deleted": chat_message.is_deleted,
            "edited_at": chat_message.edited_at.isoformat() if chat_message.edited_at else None,
            "created_at": chat_message.created_at.isoformat() if hasattr(chat_message.created_at, "isoformat") else str(chat_message.created_at),
        }
        await manager.broadcast_to_chat(body.chat_id, {"message": msg_payload})
    return {
        "ok": True,
        "balance": current_user.balance,
        "message": msg_payload,
    }


@router.post("/buy/{gift_id}")
async def buy_gift(
  gift_id: int,
  db: AsyncSession = Depends(get_db),
  current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(select(Gift).where(Gift.id == gift_id))
    gift = result.scalar_one_or_none()
    if not gift:
        raise HTTPException(404, "Gift not found")
    if (current_user.balance or 0) < gift.price:
        raise HTTPException(400, "Недостаточно BRG")
    current_user.balance -= gift.price
    inv = UserGift(user_id=current_user.id, gift_id=gift.id, quantity=1)
    db.add(inv)
    await db.commit()
    return {"ok": True, "balance": current_user.balance}
