"""Добавляет отсутствующие колонки в существующие таблицы SQLite (без пересоздания БД)."""
from sqlalchemy import text, inspect


def add_missing_columns(conn):
    """Добавить отсутствующие колонки в users и chats (только SQLite)."""
    if conn.dialect.name != "sqlite":
        return
    insp = inspect(conn)
    tables = insp.get_table_names()
    if "users" not in tables:
        return
    columns = [c["name"] for c in insp.get_columns("users")]
    if "username" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN username VARCHAR(12)"))
    if "banned_until" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN banned_until DATETIME"))
    if "frozen_until" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN frozen_until DATETIME"))
    if "about_me" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN about_me TEXT"))
    if "avatar_url" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)"))
    if "updated_at" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN updated_at DATETIME"))
    if "hide_email" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN hide_email BOOLEAN DEFAULT 0"))
    if "email_verified" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT 1"))
    if "verification_code" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN verification_code VARCHAR(6)"))
    if "verification_code_expires" not in columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN verification_code_expires DATETIME"))

    # Таблица chats: is_secret, ttl_seconds, updated_at, folder_id
    if "chats" in tables:
        chat_columns = [c["name"] for c in insp.get_columns("chats")]
        if "is_secret" not in chat_columns:
            conn.execute(text("ALTER TABLE chats ADD COLUMN is_secret BOOLEAN DEFAULT 0"))
        if "ttl_seconds" not in chat_columns:
            conn.execute(text("ALTER TABLE chats ADD COLUMN ttl_seconds INTEGER"))
        if "updated_at" not in chat_columns:
            conn.execute(text("ALTER TABLE chats ADD COLUMN updated_at DATETIME"))
        if "folder_id" not in chat_columns:
            conn.execute(text("ALTER TABLE chats ADD COLUMN folder_id INTEGER"))
        if "slug" not in chat_columns:
            conn.execute(text("ALTER TABLE chats ADD COLUMN slug VARCHAR(50)"))

    # Глобальный чат: создать если нет, добавить всех пользователей
    if "chats" in tables and "chat_members" in tables:
        r = conn.execute(text("SELECT id FROM chats WHERE slug = 'global'"))
        row = r.fetchone()
        if not row:
            conn.execute(text(
                "INSERT INTO chats (slug, title, is_group, created_at, updated_at) VALUES "
                "('global', 'Global Bridge 🌎', 1, datetime('now'), datetime('now'))"
            ))
        r = conn.execute(text("SELECT id FROM chats WHERE slug = 'global'"))
        row = r.fetchone()
        if row:
            global_id = row[0]
            users = conn.execute(text("SELECT id FROM users"))
            for (uid,) in users:
                conn.execute(text(
                    "INSERT OR IGNORE INTO chat_members (chat_id, user_id) VALUES (:cid, :uid)"
                ), {"cid": global_id, "uid": uid})

    # Таблица messages: self_destruct_at, updated_at, gift_id (если добавлялись позже)
    if "messages" in tables:
        msg_columns = [c["name"] for c in insp.get_columns("messages")]
        if "self_destruct_at" not in msg_columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN self_destruct_at DATETIME"))
        if "updated_at" not in msg_columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN updated_at DATETIME"))
        if "gift_id" not in msg_columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN gift_id INTEGER"))
        if "edited_at" not in msg_columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN edited_at DATETIME"))
        if "is_edited" not in msg_columns:
            conn.execute(text("ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT 0"))

    # Таблица gifts: image_url, description
    if "gifts" in tables:
        gift_columns = [c["name"] for c in insp.get_columns("gifts")]
        if "image_url" not in gift_columns:
            conn.execute(text("ALTER TABLE gifts ADD COLUMN image_url VARCHAR(500)"))
        if "description" not in gift_columns:
            conn.execute(text("ALTER TABLE gifts ADD COLUMN description VARCHAR(500)"))

    # Таблица user_gifts: message_text
    if "user_gifts" in tables:
        ug_columns = [c["name"] for c in insp.get_columns("user_gifts")]
        if "message_text" not in ug_columns:
            conn.execute(text("ALTER TABLE user_gifts ADD COLUMN message_text VARCHAR(500)"))

    # Сид подарков (если пусто) — эмодзи в названии
    if "gifts" in tables:
        gift_cols = [c["name"] for c in insp.get_columns("gifts")]
        r = conn.execute(text("SELECT COUNT(*) FROM gifts"))
        (cnt,) = r.fetchone() if r else (0,)
        if cnt == 0:
            if "description" in gift_cols:
                conn.execute(text(
                    "INSERT INTO gifts (slug, name, description, price, icon_url, image_url, created_at) VALUES "
                    "('coffee', '☕ Кофе', 'Согревающий кофе', 10.0, NULL, NULL, datetime('now')), "
                    "('brick', '🧱 Кирпич', 'Кирпич для моста', 50.0, NULL, NULL, datetime('now')), "
                    "('bridge', '🌉 Мост', 'Мост через реку', 150.0, NULL, NULL, datetime('now')), "
                    "('crystal', '💎 Кристалл', 'Кристалл единения', 500.0, NULL, NULL, datetime('now')), "
                    "('rocket', '🚀 Ракета', 'Ракета к звёздам', 1000.0, NULL, NULL, datetime('now'))"
                ))
            else:
                conn.execute(text(
                    "INSERT INTO gifts (slug, name, price, icon_url, image_url, created_at) VALUES "
                    "('coffee', '☕ Кофе', 10.0, NULL, NULL, datetime('now')), "
                    "('brick', '🧱 Кирпич', 50.0, NULL, NULL, datetime('now')), "
                    "('bridge', '🌉 Мост', 150.0, NULL, NULL, datetime('now')), "
                    "('crystal', '💎 Кристалл', 500.0, NULL, NULL, datetime('now')), "
                    "('rocket', '🚀 Ракета', 1000.0, NULL, NULL, datetime('now'))"
                ))
