import json
from typing import Dict, Set
from fastapi import WebSocket

from app.core.security import decode_access_token


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, Set[WebSocket]] = {}  # user_id -> set of websockets
        self.chat_connections: Dict[int, Set[WebSocket]] = {}    # chat_id -> set of websockets

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int | None):
        if user_id and user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        for chat_id, conns in list(self.chat_connections.items()):
            conns.discard(websocket)
            if not conns:
                del self.chat_connections[chat_id]

    def subscribe_chat(self, user_id: int, chat_id: int, websocket: WebSocket):
        if chat_id not in self.chat_connections:
            self.chat_connections[chat_id] = set()
        self.chat_connections[chat_id].add(websocket)

    async def broadcast_to_chat(self, chat_id: int, message: dict):
        if chat_id not in self.chat_connections:
            return
        dead = set()
        for ws in self.chat_connections[chat_id]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.chat_connections[chat_id].discard(ws)


manager = ConnectionManager()


async def get_user_from_ws(websocket: WebSocket) -> int | None:
    try:
        token = websocket.query_params.get("token") or websocket.headers.get("Authorization", "").replace("Bearer ", "")
        if not token:
            return None
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            return int(payload["sub"])
    except Exception:
        pass
    return None
