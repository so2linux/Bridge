"""
Показать или выдать новый код подтверждения для пользователя по email.
Запуск из папки backend: python -m scripts.show_verify_code [email]
Или из корня проекта: python backend/scripts/show_verify_code.py kalandarovtimur111@gmail.com
"""
import asyncio
import random
import sys
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta

_backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_backend_dir))
os.chdir(_backend_dir)  # чтобы sqlite:///./bridge.db находил bridge.db

from sqlalchemy import select
from app.db.session import AsyncSessionLocal
from app.models.user import User


async def main():
    email = (sys.argv[1] if len(sys.argv) > 1 else "kalandarovtimur111@gmail.com").strip()
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(User).where(User.email == email))
        user = r.scalar_one_or_none()
        if not user:
            print(f"Пользователь с email {email} не найден.")
            return
        code = getattr(user, "verification_code", None)
        expires = getattr(user, "verification_code_expires", None)
        if not code or (expires and expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc)):
            code = "".join(random.choices("0123456789", k=6))
            user.verification_code = code
            user.verification_code_expires = datetime.now(timezone.utc) + timedelta(minutes=15)
            await db.commit()
            print(f"Выдан новый код (действует 15 мин).")
        print(f"\n>>> [Bridge] Код подтверждения для {email}: {code} <<<\n")


if __name__ == "__main__":
    asyncio.run(main())
