from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.core.config import get_settings

settings = get_settings()
Base = declarative_base()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

# Синхронный движок для create_all при старте (в т.ч. Render)
sync_engine = create_engine(
    settings.DATABASE_URL_SYNC,
    connect_args={"check_same_thread": False},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
