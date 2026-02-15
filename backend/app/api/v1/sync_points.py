from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.api.deps import get_current_user_verified
from app.models.user import User
from app.models.chat import Chat, chat_members
from app.models.sync_point import SyncPoint, SyncPointItem

router = APIRouter()


class SyncPointItemResponse(BaseModel):
    id: int
    text: str
    is_done: bool
    order_index: int

    class Config:
        from_attributes = True


class SyncPointResponse(BaseModel):
    id: int
    chat_id: int
    title: str
    items: list[SyncPointItemResponse] = []

    class Config:
        from_attributes = True


class SyncPointItemCreate(BaseModel):
    text: str


@router.get("/chat/{chat_id}", response_model=SyncPointResponse | None)
async def get_sync_point(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    r = await db.execute(select(chat_members).where(chat_members.c.chat_id == chat_id, chat_members.c.user_id == current_user.id))
    if r.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    result = await db.execute(select(SyncPoint).where(SyncPoint.chat_id == chat_id))
    sp = result.scalar_one_or_none()
    if not sp:
        return None
    result = await db.execute(select(SyncPointItem).where(SyncPointItem.sync_point_id == sp.id).order_by(SyncPointItem.order_index))
    items = result.scalars().all()
    return SyncPointResponse(
        id=sp.id, chat_id=sp.chat_id, title=sp.title,
        items=[SyncPointItemResponse(id=i.id, text=i.text, is_done=i.is_done, order_index=i.order_index) for i in items],
    )


@router.post("/chat/{chat_id}/items", response_model=SyncPointItemResponse)
async def add_item(
    chat_id: int,
    data: SyncPointItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    r = await db.execute(select(chat_members).where(chat_members.c.chat_id == chat_id, chat_members.c.user_id == current_user.id))
    if r.first() is None:
        raise HTTPException(403, "Нет доступа к чату")
    result = await db.execute(select(SyncPoint).where(SyncPoint.chat_id == chat_id))
    sp = result.scalar_one_or_none()
    if not sp:
        sp = SyncPoint(chat_id=chat_id, title="Sync Points")
        db.add(sp)
        await db.flush()
    result = await db.execute(select(SyncPointItem).where(SyncPointItem.sync_point_id == sp.id))
    order = len(result.scalars().all())
    item = SyncPointItem(sync_point_id=sp.id, text=data.text, order_index=order)
    db.add(item)
    await db.flush()
    await db.refresh(item)
    await db.commit()
    return SyncPointItemResponse(id=item.id, text=item.text, is_done=item.is_done, order_index=item.order_index)


@router.patch("/items/{item_id}/toggle")
async def toggle_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_verified),
):
    result = await db.execute(select(SyncPointItem).where(SyncPointItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Item not found")
    sp_result = await db.execute(select(SyncPoint).where(SyncPoint.id == item.sync_point_id))
    sp = sp_result.scalar_one_or_none()
    if sp:
        r = await db.execute(select(chat_members).where(chat_members.c.chat_id == sp.chat_id, chat_members.c.user_id == current_user.id))
        if r.first() is None:
            raise HTTPException(403, "Нет доступа к чату")
    item.is_done = not item.is_done
    await db.commit()
    return {"ok": True, "is_done": item.is_done}
