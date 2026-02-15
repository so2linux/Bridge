from fastapi import APIRouter
from app.api.v1 import auth, users, chats, messages, gifts, sync_points, stories, admin, upload

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(upload.router, prefix="/upload", tags=["upload"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(messages.router, prefix="/messages", tags=["messages"])
api_router.include_router(gifts.router, prefix="/gifts", tags=["gifts"])
api_router.include_router(sync_points.router, prefix="/sync-points", tags=["sync-points"])
api_router.include_router(stories.router, prefix="/stories", tags=["stories"])
