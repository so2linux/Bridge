from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_admin_user
from app.models.user import User
from app.websocket import manager

router = APIRouter()


class BanFreezeBody(BaseModel):
    hours: int | None = None  # сколько часов (например 24 = 1 день)
    days: int | None = None   # или дней (7 = неделя, 30 = месяц)
    forever: bool = False     # навсегда (9999 дней)


class AddLightBody(BaseModel):
    amount: float


@router.get("/stats")
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    """Только для tfamilia816@gmail.com: список пользователей, кто онлайн, общее число."""
    try:
        return await _build_stats(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки статистики: {str(e)}")


async def _build_stats(db: AsyncSession):
    """Собираем статистику. Используем минимальный запрос по столбцам, чтобы не падать на старых БД."""
    online_ids = set()
    try:
        online_ids = set(manager.active_connections.keys())
    except Exception:
        pass

    now = datetime.now(timezone.utc)

    def _until(dt):
        if dt is None:
            return None
        try:
            return dt.isoformat() if getattr(dt, "isoformat", None) else str(dt)
        except Exception:
            return None

    def _is_active(bu, fu):
        try:
            b = bu.replace(tzinfo=timezone.utc) if bu and getattr(bu, "tzinfo", None) is None else bu
            f = fu.replace(tzinfo=timezone.utc) if fu and getattr(fu, "tzinfo", None) is None else fu
            if b and b > now:
                return "banned"
            if f and f > now:
                return "frozen"
        except Exception:
            pass
        return "ok"

    # Сначала пробуем полный ORM-запрос
    rows_data = []
    try:
        result = await db.execute(select(User).order_by(User.created_at.desc()))
        orm_users = result.scalars().all()
        for u in orm_users:
            bu = getattr(u, "banned_until", None)
            fu = getattr(u, "frozen_until", None)
            created_at = getattr(u, "created_at", None)
            rows_data.append({
                "id": u.id,
                "email": u.email,
                "username": getattr(u, "username", None),
                "display_name": (getattr(u, "display_name", None) or "") or "",
                "created_at": created_at,
                "balance": float(getattr(u, "balance", 0) or 0),
                "banned_until": bu,
                "frozen_until": fu,
            })
    except Exception:
        # Fallback: сырой SQL только по колонкам, которые точно есть в любой версии таблицы
        try:
            r = await db.execute(text("SELECT id, email, created_at FROM users ORDER BY created_at DESC"))
            raw_rows = r.fetchall()
            for row in raw_rows:
                rows_data.append({
                    "id": row[0],
                    "email": row[1],
                    "username": None,
                    "display_name": "",
                    "created_at": row[2],
                    "balance": 0.0,
                    "banned_until": None,
                    "frozen_until": None,
                })
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Не удалось загрузить пользователей: {e2!s}")

    users = []
    for r in rows_data:
        created_at = r.get("created_at")
        bu = r.get("banned_until")
        fu = r.get("frozen_until")
        users.append({
            "id": r["id"],
            "email": r["email"],
            "username": r.get("username"),
            "display_name": r.get("display_name") or "",
            "created_at": created_at.isoformat() if created_at and getattr(created_at, "isoformat", None) else None,
            "online": r["id"] in online_ids,
            "banned_until": _until(bu),
            "frozen_until": _until(fu),
            "balance": r.get("balance", 0),
            "status": _is_active(bu, fu),
        })

    return {
        "total": len(users),
        "online_count": len(online_ids),
        "online_ids": list(online_ids),
        "users": users,
    }


def _parse_duration(body: BanFreezeBody) -> datetime | None:
    """None = навсегда (ставим дату через 100 лет)."""
    if body.forever:
        return datetime.now(timezone.utc) + timedelta(days=365 * 100)
    hours = body.hours or 0
    if body.days:
        hours += body.days * 24
    if hours <= 0:
        return None
    return datetime.now(timezone.utc) + timedelta(hours=hours)


@router.post("/users/{user_id}/ban")
async def admin_ban(
    user_id: int,
    body: BanFreezeBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    u.banned_until = _parse_duration(body)
    await db.commit()
    return {"ok": True, "banned_until": u.banned_until.isoformat() if u.banned_until else None}


@router.post("/users/{user_id}/freeze")
async def admin_freeze(
    user_id: int,
    body: BanFreezeBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    u.frozen_until = _parse_duration(body)
    await db.commit()
    return {"ok": True, "frozen_until": u.frozen_until.isoformat() if u.frozen_until else None}


@router.post("/users/{user_id}/unban")
async def admin_unban(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    u.banned_until = None
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/unfreeze")
async def admin_unfreeze(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    u.frozen_until = None
    await db.commit()
    return {"ok": True}


@router.post("/users/{user_id}/add-light")
async def admin_add_light(
    user_id: int,
    body: AddLightBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
):
    if body.amount <= 0:
        raise HTTPException(400, "amount must be positive")
    result = await db.execute(select(User).where(User.id == user_id))
    u = result.scalar_one_or_none()
    if not u:
        raise HTTPException(404, "User not found")
    u.balance = (u.balance or 0) + body.amount
    await db.commit()
    return {"ok": True, "balance": u.balance}
