# Bridge Messenger — backend + frontend (SPA) в одном образе
# Сборка фронта (Vite/React)
FROM node:20-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev
COPY frontend/ ./
# API с того же origin при деплое
ENV VITE_API_URL=
RUN npm run build

# Бэкенд (FastAPI)
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend /app/frontend/dist ./frontend_dist

EXPOSE 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
