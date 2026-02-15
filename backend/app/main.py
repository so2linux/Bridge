from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.api.v1 import api_router
from app.db.session import engine, Base
import app.models  # noqa: F401 - register all models with Base.metadata
from app.websocket import manager, get_user_from_ws

settings = get_settings()
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
(STATIC_DIR / "avatars").mkdir(exist_ok=True)
(STATIC_DIR / "stories").mkdir(exist_ok=True)
(STATIC_DIR / "voice").mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Добавить колонку username в старую БД, если её нет
        await conn.run_sync(lambda c: __import__("app.db.migrate", fromlist=["add_missing_columns"]).add_missing_columns(c))
    yield
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# С allow_credentials=True браузер не принимает "*" — указываем явные origin
_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins if _origins else ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# При деплое (Docker) раздаём SPA из frontend_dist: статика + index.html для всех не-API путей
FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend_dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


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
