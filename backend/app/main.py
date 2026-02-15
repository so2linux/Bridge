from pathlib import Path
from contextlib import asynccontextmanager
from sqlalchemy import text
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.core.config import get_settings
from app.api.v1 import api_router
from app.db.session import engine, sync_engine, Base
import app.models  # noqa: F401 - register all models with Base.metadata
from app.websocket import manager, get_user_from_ws

# Таблицы создаются при старте (критично для Render)
Base.metadata.create_all(bind=sync_engine)

settings = get_settings()
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "avatars").mkdir(exist_ok=True)
(STATIC_DIR / "stories").mkdir(exist_ok=True)
(STATIC_DIR / "voice").mkdir(exist_ok=True)

# Путь к собранному фронту (в Docker копируется из образа builder)
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend_dist"
INDEX_HTML = FRONTEND_DIST / "index.html" if FRONTEND_DIST.exists() else None


def _ensure_global_chat_sync(conn):
    """Создать чат slug=global, если его ещё нет."""
    r = conn.execute(text("SELECT id FROM chats WHERE slug = 'global'"))
    if r.fetchone():
        return
    conn.execute(text(
        "INSERT INTO chats (slug, title, is_group, created_at, updated_at) VALUES "
        "('global', 'Global Bridge 🌎', 1, datetime('now'), datetime('now'))"
    ))
    r = conn.execute(text("SELECT id FROM chats WHERE slug = 'global'"))
    row = r.fetchone()
    if row:
        for (uid,) in conn.execute(text("SELECT id FROM users")):
            conn.execute(text("INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (:cid, :uid)"), {"cid": row[0], "uid": uid})


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(lambda c: __import__("app.db.migrate", fromlist=["add_missing_columns"]).add_missing_columns(c))
        await conn.run_sync(_ensure_global_chat_sync)
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS: все методы и заголовки для Render
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    user_id = await get_user_from_ws(websocket)
    if not user_id:
        await websocket.close(code=4001)
        return
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            if action == "subscribe_chat" and "chat_id" in data:
                manager.subscribe_chat(user_id, data["chat_id"], websocket)
            elif action == "message":
                chat_id = data.get("chat_id")
                if chat_id:
                    await manager.broadcast_to_chat(chat_id, data)
            elif action == "unsubscribe_chat" and "chat_id" in data:
                if data["chat_id"] in manager.chat_connections:
                    manager.chat_connections[data["chat_id"]].discard(websocket)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, user_id)


# SPA: для /register, /chat, /verify-email и др. отдаём index.html (до mount, чтобы имел приоритет)
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    if not FRONTEND_DIST.exists() or not INDEX_HTML or not INDEX_HTML.exists():
        raise HTTPException(404)
    if full_path.startswith("api/") or full_path.startswith("static/"):
        raise HTTPException(404)
    safe = (FRONTEND_DIST / full_path).resolve()
    if safe.is_file() and str(safe).startswith(str(FRONTEND_DIST.resolve())):
        return FileResponse(safe)
    return FileResponse(INDEX_HTML)


# После всех API-роутов — раздача фронта из frontend_dist (файлы + html=True для директорий)
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
