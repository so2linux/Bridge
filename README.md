# Bridge — мессенджер (Web App)

**Архитектура:** Frontend (React + Tailwind, mobile-first) + Backend (FastAPI + PostgreSQL + WebSockets) + PWA.

## Структура проекта

```
├── backend/                 # FastAPI + SQLAlchemy + WebSockets
│   ├── app/
│   │   ├── api/v1/          # Эндпоинты: auth, users, chats, messages, gifts, sync_points
│   │   ├── core/            # config, security (JWT)
│   │   ├── db/              # session, Base
│   │   ├── models/          # User, Message, Chat, ChatFolder, Gift, UserGift, SyncPoint, SyncPointItem
│   │   ├── schemas/
│   │   ├── main.py          # FastAPI app + WebSocket /ws
│   │   └── websocket.py
│   ├── scripts/seed_gifts.py
│   └── requirements.txt
├── frontend/                # React + Vite + Tailwind
│   ├── public/
│   │   ├── manifest.json    # PWA
│   │   └── sw.js            # Service Worker
│   └── src/
│       ├── contexts/        # ThemeContext (Light/Dark/OLED), AuthContext
│       ├── components/      # Layout, GlassPanel, SyncPointsWidget
│       ├── pages/           # Login, Register, ChatList, Chat, Profile
│       ├── App.jsx
│       └── index.css        # темы и glassmorphism
└── README.md
```

## Модели БД

- **User**: email, hashed_password, display_name, avatar_url, **balance** (Light), last_lantern_at, is_active.
- **Message**: chat_id, sender_id, content, message_type (text/echo/gift/system), gift_id, is_edited, is_deleted, edited_at.
- **Chat**, **ChatFolder**, **chat_members** (M2M).
- **Gift**: slug (brick/lantern/beacon), name, price.
- **UserGift**: user_id, gift_id, quantity, sender_id, message_id (инвентарь).
- **SyncPoint**, **SyncPointItem**: общий to-do по чату.

## Запуск

### Backend (FastAPI + SQLite)

**Первый раз:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Перезапуск бэкенда:** в терминале, где он запущен, нажми **Ctrl+C**, затем снова:
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Если при запуске ошибка про `TypingOnly` / `__static_attributes__`** — у тебя Python 3.13 или 3.14, нужна свежая SQLAlchemy. В папке `backend` выполни:
```bash
venv\Scripts\activate
pip install -U "sqlalchemy>=2.0.41"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

*(На Linux/macOS вместо `venv\Scripts\activate` используй `source venv/bin/activate`.)*

После первого запуска таблицы и недостающие колонки создадутся автоматически. Подарки по умолчанию: `python scripts/seed_gifts.py`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Открыть http://localhost:3000. Прокси: `/api` и `/static` → `http://localhost:8000`, `/ws` → WebSocket.

## Функционал

1. **Авторизация:** регистрация/вход по email и паролю (JWT).
2. **Light:** баланс в профиле; кнопка «Зажечь фонарь» (+1 Light раз в 24 ч); +0.01 Light за каждое сообщение.
3. **Подарки:** каталог и инвентарь (покупка за Light) — API готов, UI можно расширить.
4. **Чат:** список чатов, папки, сообщения (текст / Echo с пульсацией), WebSocket для реалтайма.
5. **Sync Points:** виджет общего to-do в окне переписки.

## Дизайн (Bridge)

- **Glassmorphism:** панели с `backdrop-blur` (10–20px), полупрозрачный фон.
- **Темы:** Light, Dark, OLED — переключение в шапке через ThemeContext.
- **Анимации:** плавные переходы, пульсация для Echo, эффект сияния для подарков (классы `message-echo`, `gift-glow`).

## PWA

- В корне фронта: `manifest.json`, `sw.js`.
- В `index.html` подключён `<link rel="manifest" href="/manifest.json">`.
- Регистрация Service Worker в `main.jsx` (в production). Сайт можно установить на телефон как приложение.
