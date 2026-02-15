from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.story import Story

router = APIRouter()
STORY_TTL_HOURS = 24


class StoryCreate(BaseModel):
    content_type: str = "text"
    content: str


class StoryResponse(BaseModel):
    id: int
    user_id: int
    content_type: str
    content: str
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=StoryResponse)
async def create_story(
    body: StoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    expires = now + timedelta(hours=STORY_TTL_HOURS)
    story = Story(
        user_id=current_user.id,
        content_type=body.content_type or "text",
        content=body.content,
        expires_at=expires,
    )
    db.add(story)
    await db.flush()
    await db.refresh(story)
    await db.commit()
    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        content_type=story.content_type,
        content=story.content,
        created_at=story.created_at,
        expires_at=story.expires_at,
    )


@router.get("", response_model=list[StoryResponse])
async def list_stories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Story).where(Story.expires_at > now).order_by(Story.created_at.desc())
    )
    stories = result.scalars().all()
    return [
        StoryResponse(
            id=s.id,
            user_id=s.user_id,
            content_type=s.content_type,
            content=s.content,
            created_at=s.created_at,
            expires_at=s.expires_at,
        )
        for s in stories
    ]


@router.delete("/{story_id}")
async def delete_story(
    story_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Story).where(Story.id == story_id, Story.user_id == current_user.id))
    story = result.scalar_one_or_none()
    if not story:
        raise HTTPException(404, "Story not found")
    await db.delete(story)
    await db.commit()
    return {"ok": True}
