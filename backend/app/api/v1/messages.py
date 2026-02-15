from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.api.deps import get_current_user_verified
from app.models.user import User
from app.models.message import Message, MessageType
from app.models.chat import Chat, chat_members
from app.models.reaction import MessageReaction
from app.schemas.message import MessageCreate, MessageUpdate, MessageResponse, ReactionItem

router = APIRouter()

LIGHT_PER_MESSAGE = 0.01


async def _build_reactions(db, message_ids, current_user_id):
    """Возвращает dict: message_id -> {"reactions": [ReactionItem], "my_reaction": str|None}."""
    if not message_ids:
        return {}
    all_r = await db.execute(select(MessageReaction).where(MessageReaction.message_id.in_(message_ids)))
    rows = all_r.scalars().all()
    my_r = await db.execute(select(MessageReaction).where(MessageReaction.message_id.in_(message_ids), MessageReaction.user_id == current_user_id))
    my_rows = {r.message_id: r.emoji for r in my_r.scalars().all()}
    from collections import defaultdict
    agg = defaultdict(lambda: defaultdict(int))
    for r in rows:
        agg[r.message_id][r.emoji] += 1
    result = {}
    for mid in message_ids:
        result[mid] = {
            "reactions": [ReactionItem(emoji=e, count=c) for e, c in agg[mid].items()],
            "my_reaction": my_rows.get(mid),
        }
    return result


@router.get("/chat/{chat_id}", response_model=list[MessageResponse])
async def list_messages(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    try:
        result = await db.execute(select(Chat).where(Chat.id == chat_id))
        chat = result.scalar_one_or_none()
        if not chat:
            raise HTTPException(404, "Chat not found")
        member_check = await db.execute(
            select(chat_members).where(
                chat_members.c.chat_id == chat_id,
                chat_members.c.user_id == current_user.id,
            )
        )
        if member_check.first() is None:
            raise HTTPException(403, "Нет доступа к чату")
        result = await db.execute(
            select(Message).where(Message.chat_id == chat_id, Message.is_deleted == False).order_by(Message.created_at)
        )
        messages = result.scalars().all()
        msg_ids = [m.id for m in messages]
        reactions_map = await _build_reactions(db, msg_ids, current_user.id)
        return [
            MessageResponse(
                id=m.id, chat_id=m.chat_id, sender_id=m.sender_id, content=m.content,
                message_type=m.message_type.value if hasattr(m.message_type, "value") else m.message_type,
                gift_id=m.gift_id, is_edited=m.is_edited, is_deleted=m.is_deleted,
                edited_at=m.edited_at, created_at=m.created_at,
                reactions=reactions_map.get(m.id, {}).get("reactions") or [],
                my_reaction=reactions_map.get(m.id, {}).get("my_reaction"),
            )
            for m in messages
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"Ошибка загрузки чата: {e!s}")


@router.post("/chat/{chat_id}", response_model=MessageResponse)
async def send_message(
    chat_id: int,
    data: MessageCreate,
  db: AsyncSession = Depends(get_db),
  current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(select(Chat).where(Chat.id == chat_id))
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(404, "Chat not found")
    member_check = await db.execute(
        select(chat_members).where(
            chat_members.c.chat_id == chat_id,
            chat_members.c.user_id == current_user.id,
        )
    )
    if member_check.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    msg_type = getattr(MessageType, data.message_type.upper(), MessageType.TEXT)
    message = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        content=data.content,
        message_type=msg_type,
        gift_id=data.gift_id,
    )
    db.add(message)
    current_user.balance = (current_user.balance or 0) + LIGHT_PER_MESSAGE
    await db.flush()
    await db.refresh(message)
    await db.commit()
    return MessageResponse(
        id=message.id, chat_id=message.chat_id, sender_id=message.sender_id, content=message.content,
        message_type=message.message_type.value, gift_id=message.gift_id,
        is_edited=message.is_edited, is_deleted=message.is_deleted, edited_at=message.edited_at,
        created_at=message.created_at, reactions=[], my_reaction=None,
    )


class ReactionBody(BaseModel):
    emoji: str | None = None  # None = убрать реакцию


@router.post("/{message_id}/reaction", response_model=MessageResponse)
async def set_reaction(
    message_id: int,
    body: ReactionBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    """Поставить или убрать реакцию. emoji: один эмодзи или null чтобы убрать."""
    result = await db.execute(select(Message).where(Message.id == message_id))
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(404, "Message not found")
    member_check = await db.execute(
        select(chat_members).where(
            chat_members.c.chat_id == message.chat_id,
            chat_members.c.user_id == current_user.id,
        )
    )
    if member_check.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    emoji = (body.emoji or "").strip()[:20] or None
    existing = await db.execute(
        select(MessageReaction).where(
            MessageReaction.message_id == message_id,
            MessageReaction.user_id == current_user.id,
        )
    )
    existing_row = existing.scalar_one_or_none()
    if emoji:
        if existing_row:
            existing_row.emoji = emoji
        else:
            db.add(MessageReaction(message_id=message_id, user_id=current_user.id, emoji=emoji))
    else:
        if existing_row:
            db.delete(existing_row)
    await db.commit()
    reactions_map = await _build_reactions(db, [message_id], current_user.id)
    data = reactions_map.get(message_id, {})
    return MessageResponse(
        id=message.id, chat_id=message.chat_id, sender_id=message.sender_id, content=message.content,
        message_type=message.message_type.value if hasattr(message.message_type, "value") else message.message_type,
        gift_id=message.gift_id, is_edited=message.is_edited, is_deleted=message.is_deleted,
        edited_at=message.edited_at, created_at=message.created_at,
        reactions=data.get("reactions") or [], my_reaction=data.get("my_reaction"),
    )


@router.patch("/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: int,
    data: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(select(Message).where(Message.id == message_id, Message.sender_id == current_user.id))
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(404, "Message not found")
    member_check = await db.execute(
        select(chat_members).where(
            chat_members.c.chat_id == message.chat_id,
            chat_members.c.user_id == current_user.id,
        )
    )
    if member_check.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    message.content = data.content
    message.is_edited = True
    from datetime import datetime, timezone
    message.edited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(message)
    reactions_map = await _build_reactions(db, [message.id], current_user.id)
    data = reactions_map.get(message.id, {})
    return MessageResponse(
        id=message.id, chat_id=message.chat_id, sender_id=message.sender_id, content=message.content,
        message_type=message.message_type.value, gift_id=message.gift_id,
        is_edited=message.is_edited, is_deleted=message.is_deleted, edited_at=message.edited_at,
        created_at=message.created_at, reactions=data.get("reactions") or [], my_reaction=data.get("my_reaction"),
    )


@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(select(Message).where(Message.id == message_id, Message.sender_id == current_user.id))
    message = result.scalar_one_or_none()
    if not message:
        raise HTTPException(404, "Message not found")
    member_check = await db.execute(
        select(chat_members).where(
            chat_members.c.chat_id == message.chat_id,
            chat_members.c.user_id == current_user.id,
        )
    )
    if member_check.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    message.is_deleted = True
    message.content = ""
    await db.commit()
    return {"ok": True}
