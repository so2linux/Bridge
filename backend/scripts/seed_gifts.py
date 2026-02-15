"""
Скрипт наполнения каталога подарков (эмодзи вместо картинок).
Запуск из корня backend: python -m scripts.seed_gifts
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text
from app.db.session import engine, AsyncSessionLocal
from app.models.gift import Gift


GIFTS = [
    ("coffee", "☕ Кофе", "Согревающий кофе", 10.0),
    ("brick", "🧱 Кирпич", "Кирпич для моста", 50.0),
    ("bridge", "🌉 Мост", "Мост через реку", 150.0),
    ("crystal", "💎 Кристалл", "Кристалл единения", 500.0),
    ("rocket", "🚀 Ракета", "Ракета к звёздам", 1000.0),
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: _ensure_description(c))
    async with AsyncSessionLocal() as db:
        for slug, name, description, price in GIFTS:
            r = await db.execute(select(Gift).where(Gift.slug == slug))
            g = r.scalar_one_or_none()
            if g:
                g.name = name
                g.description = description
                g.price = price
            else:
                db.add(Gift(slug=slug, name=name, description=description, price=price))
        await db.commit()
    print("Gifts seeded:", [f"{n} ({p} BRG)" for _, n, _, p in GIFTS])


def _ensure_description(conn):
    from sqlalchemy import inspect, text
    insp = inspect(conn)
    if "gifts" not in insp.get_table_names():
        return
    cols = [c["name"] for c in insp.get_columns("gifts")]
    if "description" not in cols:
        conn.execute(text("ALTER TABLE gifts ADD COLUMN description VARCHAR(500)"))


if __name__ == "__main__":
    asyncio.run(seed())
