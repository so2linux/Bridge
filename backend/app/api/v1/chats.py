from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.api.deps import get_current_user_verified
from sqlalchemy import insert

from app.models.user import User
from app.models.chat import Chat, ChatFolder, chat_members

router = APIRouter()


class ChatResponse(BaseModel):
    id: int
    slug: str | None = None  # "global" для глобального чата
    title: str
    is_group: bool
    folder_id: int | None
    display_title: str | None = None  # для DM — имя собеседника (как в Telegram)

    class Config:
        from_attributes = True


class ChatFolderResponse(BaseModel):
    id: int
    name: str
    order_index: int

    class Config:
        from_attributes = True


class ChatMemberShort(BaseModel):
    id: int
    display_name: str | None
    email: str


class ChatDetailResponse(BaseModel):
    id: int
    title: str
    is_group: bool
    folder_id: int | None
    members: list[ChatMemberShort]

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ChatResponse])
async def list_chats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    subq = select(chat_members.c.chat_id).where(chat_members.c.user_id == current_user.id)
    result = await db.execute(
        select(Chat).where(Chat.id.in_(subq)).options(selectinload(Chat.members))
    )
    chats = result.unique().scalars().all()
    # Глобальный чат (slug=global) — всегда первым
    def sort_key(c):
        return (0 if (getattr(c, "slug", None) == "global") else 1, -(c.id or 0))
    chats = sorted(chats, key=sort_key)
    out = []
    for c in chats:
        display_title = c.title
        if not c.is_group and c.members and getattr(c, "slug", None) != "global":
            other = next((m for m in c.members if m.id != current_user.id), None)
            if other:
                display_title = other.display_name or other.email or f"User {other.id}"
        out.append(ChatResponse(
            id=c.id, slug=getattr(c, "slug", None), title=c.title,
            is_group=c.is_group, folder_id=c.folder_id, display_title=display_title
        ))
    return out


@router.get("/folders", response_model=list[ChatFolderResponse])
async def list_folders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(select(ChatFolder).where(ChatFolder.user_id == current_user.id))
    folders = result.scalars().all()
    return [ChatFolderResponse(id=f.id, name=f.name, order_index=f.order_index) for f in folders]


@router.get("/dm/{user_id}", response_model=ChatResponse)
async def get_or_create_dm(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    """Найти существующий личный чат с пользователем или создать новый."""
    try:
        if user_id == current_user.id:
            raise HTTPException(status_code=400, detail="Нельзя создать чат с самим собой")
        result = await db.execute(select(User).where(User.id == user_id))
        other = result.scalar_one_or_none()
        if not other:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        # Найти DM: личный чат (не группа), в котором ровно двое — я и other (по chat_members)
        my_chats = await db.execute(
            select(chat_members.c.chat_id).where(chat_members.c.user_id == current_user.id)
        )
        my_chat_ids = [r[0] for r in my_chats.all()]
        result = await db.execute(
            select(Chat).where(Chat.is_group == False, Chat.id.in_(my_chat_ids)).options(selectinload(Chat.members))
        )
        for chat in result.scalars().unique().all():
            member_ids = [m.id for m in chat.members]
            if len(member_ids) == 2 and user_id in member_ids:
                disp = other.display_name or other.email or f"User {user_id}"
                return ChatResponse(id=chat.id, title=chat.title, is_group=chat.is_group, folder_id=chat.folder_id, display_title=disp)
        # Создать новый личный чат и явно добавить участников в chat_members
        title = f"{current_user.display_name or current_user.email}, {other.display_name or other.email}"[:200]
        chat = Chat(title=title or "Диалог", is_group=False)
        db.add(chat)
        await db.flush()
        await db.execute(insert(chat_members).values(chat_id=chat.id, user_id=current_user.id))
        await db.execute(insert(chat_members).values(chat_id=chat.id, user_id=other.id))
        await db.commit()
        await db.refresh(chat)
        disp = other.display_name or other.email or f"User {user_id}"
        return ChatResponse(id=chat.id, title=chat.title, is_group=chat.is_group, folder_id=chat.folder_id, display_title=disp)
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка создания чата: {e!s}")


@router.get("/{chat_id}", response_model=ChatDetailResponse)
async def get_chat(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    """Информация о чате и участниках (для DM — второй участник для отправки подарка)."""
    member_check = await db.execute(
        select(chat_members.c.chat_id).where(
            chat_members.c.chat_id == chat_id,
            chat_members.c.user_id == current_user.id,
        )
    )
    if member_check.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    result = await db.execute(
        select(Chat).where(Chat.id == chat_id).options(selectinload(Chat.members))
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise HTTPException(404, "Чат не найден")
    members = [
        ChatMemberShort(id=m.id, display_name=m.display_name, email=m.email or "")
        for m in chat.members
    ]
    return ChatDetailResponse(
        id=chat.id, title=chat.title, is_group=chat.is_group, folder_id=chat.folder_id, members=members
    )
