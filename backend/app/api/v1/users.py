from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from pydantic import BaseModel

from app.api.deps import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.gift import Gift, UserGift
from app.schemas.user import UserResponse, UserUpdate


class TransferLightBody(BaseModel):
    to_user_id: int
    amount: float


class PublicUserResponse(BaseModel):
    """Профиль пользователя для модалки (без баланса)."""
    id: int
    username: str | None
    display_name: str | None
    about_me: str | None
    avatar_url: str | None

    class Config:
        from_attributes = True


class UserGiftPublic(BaseModel):
    name: str
    slug: str
    sender_name: str | None
    created_at: str


router = APIRouter()

LIGHT_PER_MESSAGE = 0.01
LANTERN_AMOUNT = 1.0
LANTERN_COOLDOWN_HOURS = 24


def _user_to_response(u: User, mask_email: bool = False) -> UserResponse:
    email = u.email
    if mask_email and getattr(u, "hide_email", False):
        email = None
    return UserResponse(
        id=u.id,
        email=email,
        username=u.username,
        display_name=u.display_name or "",
        about_me=getattr(u, "about_me", None),
        avatar_url=u.avatar_url,
        hide_email=getattr(u, "hide_email", None),
        balance=u.balance or 0,
        last_lantern_at=u.last_lantern_at,
        is_active=u.is_active,
        created_at=u.created_at,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)):
    return _user_to_response(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if body.display_name is not None:
        current_user.display_name = body.display_name
    if body.about_me is not None:
        current_user.about_me = body.about_me
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url
    if body.hide_email is not None:
        current_user.hide_email = body.hide_email
    await db.commit()
    await db.refresh(current_user)
    return _user_to_response(current_user)


@router.get("/search", response_model=list[UserResponse])
async def search_users(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Instant search by @username or display_name. Strip @ from query."""
    q = q.lstrip("@").strip().lower()
    if not q:
        return []
    q_pattern = f"%{q}%"
    result = await db.execute(
        select(User)
        .where(User.is_active == True)
        .where(or_(User.username.ilike(q_pattern), User.display_name.ilike(q_pattern)))
        .limit(limit)
    )
    users = result.scalars().all()
    return [_user_to_response(u, mask_email=True) for u in users if u.id != current_user.id]


@router.get("/{user_id}", response_model=PublicUserResponse)
async def get_user_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Публичный профиль пользователя для модалки."""
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "Пользователь не найден")
    return PublicUserResponse(
        id=u.id,
        username=u.username,
        display_name=u.display_name,
        about_me=getattr(u, "about_me", None),
        avatar_url=u.avatar_url,
    )


@router.get("/{user_id}/gifts", response_model=list[UserGiftPublic])
async def get_user_gifts(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Полученные подарки пользователя (сетка в профиле)."""
    result = await db.execute(
        select(UserGift, Gift, User)
        .join(Gift, UserGift.gift_id == Gift.id)
        .outerjoin(User, User.id == UserGift.sender_id)
        .where(UserGift.user_id == user_id)
    )
    rows = result.all()
    return [
        UserGiftPublic(
            name=g.name,
            slug=g.slug,
            sender_name=(s.display_name or s.email) if s else None,
            created_at=ug.created_at.isoformat() if ug.created_at else "",
        )
        for ug, g, s in rows
    ]


@router.post("/transfer-light")
async def transfer_light(
    body: TransferLightBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Bridge Pay: send BRG to another user."""
    amount = max(0.01, min(10000, body.amount))
    if (current_user.balance or 0) < amount:
        raise HTTPException(status_code=400, detail="Недостаточно BRG")
    result = await db.execute(select(User).where(User.id == body.to_user_id))
    to_user = result.scalar_one_or_none()
    if not to_user or to_user.id == current_user.id:
        raise HTTPException(status_code=404, detail="User not found")
    current_user.balance = (current_user.balance or 0) - amount
    to_user.balance = (to_user.balance or 0) + amount
    await db.commit()
    await db.refresh(current_user)
    return {"ok": True, "balance": current_user.balance}


@router.post("/light-lantern", response_model=UserResponse)
async def light_lantern(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.utcnow()
    if current_user.last_lantern_at:
        elapsed = (now - current_user.last_lantern_at.replace(tzinfo=None)).total_seconds()
        if elapsed < LANTERN_COOLDOWN_HOURS * 3600:
            raise HTTPException(
                status_code=400,
                detail=f"Can light lantern again in {LANTERN_COOLDOWN_HOURS}h",
            )
    current_user.last_lantern_at = now
    current_user.balance = (current_user.balance or 0) + LANTERN_AMOUNT
    await db.commit()
    await db.refresh(current_user)
    return _user_to_response(current_user)
