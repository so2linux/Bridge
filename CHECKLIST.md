# Bridge — проверка от А до Я

## Backend

### Core
- **config.py** — SQLite URL, SECRET_KEY, JWT срок. Всё ок.
- **security.py** — bcrypt (обрезка 72 байт), JWT encode/decode. Ок.
- **session.py** — async engine, get_db с commit/rollback. Ок.

### DB
- **migrate.py** — проверка `users` в tables перед миграцией; колонки users + chats (is_secret, ttl_seconds, updated_at). Исправлено: добавлена проверка существования таблицы `users`.

### Models
- **User** — email, username, display_name, about_me, avatar_url, balance, last_lantern_at, banned_until, frozen_until, hide_email. Ок.
- **Chat** — is_group, is_secret, ttl_seconds, members (M2M chat_members). Ок.
- **Message** — message_type (Enum), is_deleted, chat_id, sender_id. Ок.
- **Story** — content_type, content, expires_at. Ок.
- **Gift, UserGift, SyncPoint, SyncPointItem** — без изменений.

### API
- **deps.py** — get_current_user: проверка banned_until/frozen_until (403). Импорт datetime в начале. Ок.
- **auth.py** — register/login, banned/frozen при входе, _user_to_response с about_me, hide_email. Ок.
- **users.py** — me, PATCH me (display_name, about_me, avatar_url, hide_email), search с mask_email, transfer-light, light-lantern. Ок.
- **chats.py** — list_chats, list_folders, get_or_create_dm (две вставки в chat_members, try/except). Ок.
- **messages.py** — list_messages, send_message: проверка по chat_members. edit_message, delete_message: проверка участника чата. Ок.
- **upload.py** — avatar (5 МБ), story (фото/видео до 25 МБ). Ок.
- **stories.py** — create, list, delete. Ок.
- **admin.py** — stats (fallback raw SQL), ban/freeze/add-light. Ок.
- **sync_points.py** — get_sync_point, add_item, toggle_item: проверка участия в чате (chat_members). Исправлено: добавлены проверки доступа.
- **gifts.py** — catalog, inventory, buy. Ок.

### Main
- **main.py** — lifespan (create_all + migrate), CORS, StaticFiles /static, WebSocket. Ок.
- **websocket.py** — ConnectionManager, get_user_from_ws по token. Ок.

---

## Frontend

### Routing (App.jsx)
- PublicOnly: /login, /register с ?add=1 не редирект для залогиненных. Ок.
- ProtectedRoute: все страницы под Layout. Ок.

### Contexts
- **AuthContext** — fetchWithAuth: не ставить Content-Type для FormData (на будущее). Ок.
- **ThemeContext** — light/dark/oled, localStorage. Ок.

### Pages
- **Login** — ссылка на Register с ?add=1 при isAddAccount. Ок.
- **Register** — isAddAccount, ссылка на Login с ?add=1. Ок.
- **ChatList** — Link to `/chat/${c.id}`. Ок.
- **Chat** — validChatId, loadError, проверка по chat_members на бэке. Ок.
- **Profile** — аватар (fetch без Content-Type), about_me, PATCH. Ок.
- **Settings** — темы, Конфиденциальность (hide_email), выход. Ок.
- **Stories** — текст + фото/видео, загрузка через fetch. Ок.
- **Admin** — загрузка stats, ошибка с текстом с бэкенда. Ок.

### Components
- **SearchModal** — поиск, openChatWithUser → /chats/dm/:id, navigate to /chat/:id. Ок.
- **Layout** — сайдбар, аккаунты, ссылка «Добавить аккаунт» /login?add=1. Ок.
- **SyncPointsWidget** — load/add/toggle; бэкенд проверяет chat_members. Ок.
- **BridgePayWidget** — transfer-light по to_user_id. Ок.
- **GlassPanel** — обёртка. Ок.

### Styles
- **index.css** — glass-panel, theme-light/dark/oled, message-echo, gift-glow, voice-wave. Ок.
- **tailwind.config.js** — keyframes pulse-echo, gift-glow, voice-wave. Ок.

---

## Итог изменений в этой проверке

1. **migrate.py** — перед миграцией users проверяется наличие таблицы `users` в списке таблиц.
2. **sync_points.py** — проверка участия в чате для get_sync_point, add_item, toggle_item (через chat_members).
3. **AuthContext.jsx** — для FormData не устанавливается Content-Type в fetchWithAuth.

Всё остальное по коду согласовано и проверено.
