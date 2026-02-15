# Bridge Messenger — multi-stage: frontend builder + backend
# ========== Этап 1: сборка фронта ==========
FROM node:20-alpine AS builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
ENV VITE_API_URL=
RUN npm run build

# ========== Этап 2: бэкенд + статика фронта ==========
FROM python:3.10-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=builder /app/frontend/dist ./frontend_dist

EXPOSE 8000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT}
