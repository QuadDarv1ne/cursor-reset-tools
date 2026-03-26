# ============================================
# Cursor Reset Tools - Dockerfile
# ============================================
# Multi-stage build для оптимизации размера образа
# ============================================

# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Копирование package файлов
COPY package*.json ./

# Установка всех зависимостей (включая dev для сборки)
RUN npm ci

# Копирование исходного кода
COPY . .

# ============================================
# Stage 2: Production
# ============================================
FROM node:18-alpine AS production

# Установка curl для healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Создание пользователя для безопасности
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Копирование package файлов
COPY package*.json ./

# Установка только production зависимостей
RUN npm ci --only=production && npm cache clean --force

# Копирование приложения из builder stage
COPY --from=builder /app .

# Создание директорий для данных
RUN mkdir -p /app/data /app/logs /app/backups && \
    chown -R nodejs:nodejs /app

# Переключение на не-root пользователя
USER nodejs

# Экспозиция портов
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Запуск приложения
CMD ["node", "app.js"]

# ============================================
# Stage 3: Development (опционально)
# ============================================
FROM node:18-alpine AS development

WORKDIR /app

# Установка зависимостей для разработки
COPY package*.json ./
RUN npm ci

COPY . .

# Проброс портов
EXPOSE 3000 3001

# Запуск с nodemon для auto-reload
CMD ["npm", "run", "dev"]
