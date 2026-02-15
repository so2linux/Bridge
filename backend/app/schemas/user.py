import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime

USERNAME_PATTERN = re.compile(r"^[a-zA-Z]{5,12}$")


SECRET_REGISTRATION_CODE = "tigran_lox"


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    display_name: Optional[str] = ""
    username: Optional[str] = None
    secret_code: str = ""

    @field_validator("username")
    @classmethod
    def username_alnum(cls, v):
        if v is None or v == "":
            return None
        if not USERNAME_PATTERN.match(v):
            raise ValueError("Username: 5–12 English letters only")
        return v.lower()


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: Optional[str] = None  # None если пользователь скрыл почту (для других)
    username: Optional[str] = None
    display_name: Optional[str] = ""
    about_me: Optional[str] = None
    avatar_url: Optional[str] = None
    hide_email: Optional[bool] = None  # настройка: скрыть почту от других
    balance: float = 0.0
    last_lantern_at: Optional[datetime] = None
    is_active: bool = True
    email_verified: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    about_me: Optional[str] = None
    avatar_url: Optional[str] = None
    hide_email: Optional[bool] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
