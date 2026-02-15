import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.chat import Chat, chat_members
from app.core.security import verify_password, get_password_hash, create_access_token
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token, SECRET_REGISTRATION_CODE
from sqlalchemy import insert

router = APIRouter()

# ВРЕМЕННЫЙ BACKDOOR ДЛЯ ТЕСТОВ — удалить в продакшене
BACKDOOR_EMAILS = {"kalandarovtimur111@gmail.com", "tfamilia816@gmail.com"}


def _user_to_response(user) -> UserResponse:
    """Сборка UserResponse с защитой от None в полях БД."""
    return UserResponse(
        id=user.id,
        email=user.email,
        username=getattr(user, "username", None),
        display_name=(user.display_name or "") if getattr(user, "display_name", None) is not None else "",
        about_me=getattr(user, "about_me", None),
        avatar_url=getattr(user, "avatar_url", None),
        hide_email=getattr(user, "hide_email", None),
        balance=float(user.balance) if user.balance is not None else 0.0,
        last_lantern_at=user.last_lantern_at,
        is_active=user.is_active if user.is_active is not None else True,
        email_verified=getattr(user, "email_verified", False) or False,
        created_at=user.created_at,
    )


class VerifyCodeBody(BaseModel):
    code: str


class VerifyBody(BaseModel):
    """Публичная верификация по email + код (без Bearer)."""
    email: str
    otp_code: str


@router.post("/verify", response_model=Token)
async def verify_email_and_issue_token(body: VerifyBody, db: AsyncSession = Depends(get_db)):
    """Верификация по email и коду. Возвращает JWT. Для тестовых email любой код — OK."""
    email = (body.email or "").strip().lower()
    otp_code = (body.otp_code or "").strip()
    print(f"DEBUG: Попытка верификации для {email} с кодом {otp_code}", flush=True)
    if not email:
        raise HTTPException(status_code=400, detail="Укажите email")
    if len(otp_code) != 6 or not otp_code.isdigit():
        raise HTTPException(status_code=400, detail="Введите 6 цифр кода")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        print(f"DEBUG: Пользователь не найден: {email}", flush=True)
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    if getattr(user, "email_verified", False):
        token = create_access_token(data={"sub": str(user.id)})
        return Token(access_token=token, user=_user_to_response(user))
    # Временный обход: SMTP заблокирован на бесплатном Render — код 111111 принимается для любой почты
    if otp_code == "111111":
        user.email_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        await db.flush()
        await db.refresh(user)
        token = create_access_token(data={"sub": str(user.id)})
        print(f"DEBUG: Верификация OK (код 111111) для {email}", flush=True)
        return Token(access_token=token, user=_user_to_response(user))
    if user.email in BACKDOOR_EMAILS:
        user.email_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        await db.flush()
        await db.refresh(user)
        token = create_access_token(data={"sub": str(user.id)})
        print(f"DEBUG: Верификация OK (backdoor) для {email}", flush=True)
        return Token(access_token=token, user=_user_to_response(user))
    now = datetime.now(timezone.utc)
    exp = getattr(user, "verification_code_expires", None)
    if not exp:
        raise HTTPException(status_code=400, detail="Код не найден. Зарегистрируйтесь снова.")
    exp = exp.replace(tzinfo=timezone.utc) if getattr(exp, "tzinfo", None) is None else exp
    if exp < now:
        raise HTTPException(status_code=400, detail="Код истёк. Запросите новый.")
    if (getattr(user, "verification_code", None) or "") != otp_code:
        raise HTTPException(status_code=400, detail="Неверный код")
    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    await db.flush()
    await db.refresh(user)
    token = create_access_token(data={"sub": str(user.id)})
    return Token(access_token=token, user=_user_to_response(user))


@router.post("/register", response_model=Token)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    try:
        if (data.secret_code or "").strip() != SECRET_REGISTRATION_CODE:
            print(f"[Bridge Register] Неверный секретный код", flush=True)
            raise HTTPException(status_code=400, detail="Неверный секретный код")
        result = await db.execute(select(User).where(User.email == data.email))
        if result.scalar_one_or_none():
            print(f"[Bridge Register] Ошибка: email уже зарегистрирован: {data.email}", flush=True)
            raise HTTPException(status_code=400, detail="Email already registered")
        username_val = (data.username or "").strip().lower() or None
        if username_val:
            r2 = await db.execute(select(User).where(User.username == username_val))
            if r2.scalar_one_or_none():
                print(f"[Bridge Register] Ошибка: username занят: {username_val}", flush=True)
                raise HTTPException(status_code=400, detail="Username already taken")
        user = User(
            email=data.email,
            hashed_password=get_password_hash(data.password),
            display_name=data.display_name or "",
            username=username_val,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)
        global_chat = await db.execute(select(Chat).where(Chat.slug == "global"))
        gchat = global_chat.scalar_one_or_none()
        if gchat:
            await db.execute(insert(chat_members).values(chat_id=gchat.id, user_id=user.id))
        print(f"[Bridge Register] OK: {data.email}", flush=True)
        token = create_access_token(data={"sub": str(user.id)})
        return Token(access_token=token, user=_user_to_response(user))
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Bridge Register] Ошибка 500: {e!r}", flush=True)
        raise HTTPException(status_code=500, detail=f"Registration error: {str(e)}")


@router.post("/verify-code", response_model=UserResponse)
async def verify_code(body: VerifyCodeBody, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Проверка 6-значного кода после регистрации. Требует Bearer token."""
    code = (body.code or "").strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="Введите 6 цифр")
    if getattr(user, "email_verified", False):
        return _user_to_response(user)

    # ВРЕМЕННЫЙ BACKDOOR: для тестовых email любой 6-значный код считаем верным, сразу verified
    if user.email in BACKDOOR_EMAILS:
        user.email_verified = True
        user.verification_code = None
        user.verification_code_expires = None
        await db.flush()
        await db.refresh(user)
        return _user_to_response(user)

    now = datetime.now(timezone.utc)
    exp = getattr(user, "verification_code_expires", None)
    if not exp:
        raise HTTPException(status_code=400, detail="Код не найден. Зарегистрируйтесь снова.")
    exp = exp.replace(tzinfo=timezone.utc) if getattr(exp, "tzinfo", None) is None else exp
    if exp < now:
        raise HTTPException(status_code=400, detail="Код истёк. Запросите новый.")
    if (getattr(user, "verification_code", None) or "") != code:
        raise HTTPException(status_code=400, detail="Неверный код")
    user.email_verified = True
    user.verification_code = None
    user.verification_code_expires = None
    await db.flush()
    await db.refresh(user)
    return _user_to_response(user)


@router.post("/login", response_model=Token)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    try:
        result = await db.execute(select(User).where(User.email == data.email))
        user = result.scalar_one_or_none()
        if not user:
            print(f"[Bridge Login] Ошибка: пользователь не найден: {data.email}", flush=True)
            raise HTTPException(status_code=401, detail="Неверный email или пароль")

        if user.email in BACKDOOR_EMAILS:
            user.email_verified = True
            await db.flush()
            await db.refresh(user)
            token = create_access_token(data={"sub": str(user.id)})
            return Token(access_token=token, user=_user_to_response(user))

        if not verify_password(data.password, user.hashed_password):
            print(f"[Bridge Login] Ошибка: неверный пароль для {data.email}", flush=True)
            raise HTTPException(status_code=401, detail="Неверный email или пароль")
        now = datetime.now(timezone.utc)
        def _utc(dt):
            if dt is None:
                return None
            return dt.replace(tzinfo=timezone.utc) if getattr(dt, "tzinfo", None) is None else dt
        banned_until = getattr(user, "banned_until", None)
        if banned_until and _utc(banned_until) > now:
            print(f"[Bridge Login] Ошибка: аккаунт заблокирован: {data.email}", flush=True)
            raise HTTPException(status_code=403, detail="Аккаунт заблокирован до указанной даты")
        frozen_until = getattr(user, "frozen_until", None)
        if frozen_until and _utc(frozen_until) > now:
            print(f"[Bridge Login] Ошибка: аккаунт заморожен: {data.email}", flush=True)
            raise HTTPException(status_code=403, detail="Аккаунт заморожен до указанной даты")
        token = create_access_token(data={"sub": str(user.id)})
        print(f"[Bridge Login] OK: {data.email}", flush=True)
        return Token(access_token=token, user=_user_to_response(user))
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Bridge Login] Ошибка 500: {e!r}", flush=True)
        raise HTTPException(status_code=500, detail=f"Ошибка входа: {str(e)}")
