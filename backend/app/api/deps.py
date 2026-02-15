from datetime import datetime, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.user import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalid or user not found. Please log in again.",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="User inactive")
    now = datetime.now(timezone.utc)
    banned_until = getattr(user, "banned_until", None)
    if banned_until:
        b = banned_until.replace(tzinfo=timezone.utc) if getattr(banned_until, "tzinfo", None) is None else banned_until
        if b > now:
            raise HTTPException(status_code=403, detail="Аккаунт заблокирован")
    frozen_until = getattr(user, "frozen_until", None)
    if frozen_until:
        f = frozen_until.replace(tzinfo=timezone.utc) if getattr(frozen_until, "tzinfo", None) is None else frozen_until
        if f > now:
            raise HTTPException(status_code=403, detail="Аккаунт заморожен")
    return user


ADMIN_EMAIL = "tfamilia816@gmail.com"
# Админ по нику: если username == этот ник — показывается кнопка «+500 BRG» в профиле
ADMIN_USERNAME = "admin"


async def get_current_user_verified(user: User = Depends(get_current_user)) -> User:
    """Текущий пользователь с проверкой email. Без верификации в чат не пускать."""
    if not getattr(user, "email_verified", False):
        raise HTTPException(
            status_code=403,
            detail="Подтвердите email. Введите 6-значный код из письма.",
        )
    return user


async def get_admin_user(user: User = Depends(get_current_user)) -> User:
    if user.email != ADMIN_EMAIL and (not user.username or user.username != ADMIN_USERNAME):
        raise HTTPException(status_code=403, detail="Access denied")
    return user
