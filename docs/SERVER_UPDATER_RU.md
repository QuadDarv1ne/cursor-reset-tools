# 🚀 Bypass Server & Updater - Документация

Сервер обхода блокировок и система автообновления приложения.

---

## 📋 Содержание

1. [Bypass Server](#bypass-server)
2. [Updater](#updater)
3. [CLI Команды](#cli-команды)
4. [API Reference](#api-reference)

---

## 🔵 Bypass Server

Прокси-сервер для предоставления доступа к прокси клиентам через HTTP и WebSocket.

### Возможности

- **HTTP Proxy** - проксирование HTTP/HTTPS запросов
- **WebSocket** - реальное время для клиентов
- **Ротация прокси** - автоматический выбор рабочих прокси
- **Балансировка** - распределение нагрузки между клиентами
- **Rate Limiting** - ограничение запросов
- **Статистика** - мониторинг использования

### Запуск сервера

```bash
# Через npm
npm run server

# С указанием порта
npm run cli -- server:start --port 3001

# Прямой запуск
node server/bypassServer.js
```

### Конфигурация

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `BYPASS_PORT` | 3001 | HTTP порт сервера |
| `WS_PORT` | 3002 | WebSocket порт |
| `MAX_CLIENTS` | 100 | Максимум клиентов |
| `PROXY_TIMEOUT` | 30000 | Таймаут прокси (мс) |

---

### HTTP API Endpoints

#### Health Check
```bash
GET /health
```

Ответ:
```json
{
  "status": "ok",
  "uptime": 3600000,
  "clients": 5,
  "requests": 1234
}
```

#### Статистика
```bash
GET /stats
```

#### Получить прокси
```bash
GET /proxy?protocol=socks5
```

Ответ:
```json
{
  "success": true,
  "proxy": {
    "url": "192.168.1.1:1080",
    "protocol": "socks5",
    "country": "US"
  }
}
```

#### Список прокси
```bash
GET /proxies?limit=10&protocol=socks5&country=US
```

#### Проксирование запроса
```bash
GET /bypass/https://example.com
POST /bypass/https://api.example.com/data
```

Заголовки в ответе:
- `x-bypass-proxy` - использованный прокси
- `x-bypass-country` - страна прокси

---

### WebSocket API

#### Подключение
```javascript
const ws = new WebSocket('ws://localhost:3001/ws');
```

#### Формат сообщений

**Запрос прокси:**
```json
{
  "type": "proxy",
  "protocol": "socks5"
}
```

**Ответ:**
```json
{
  "type": "proxy",
  "proxy": {
    "url": "192.168.1.1:1080",
    "protocol": "socks5",
    "country": "US"
  }
}
```

**Проксирование запроса:**
```json
{
  "type": "request",
  "requestId": "req_123",
  "url": "https://api.example.com/data",
  "method": "GET",
  "headers": {}
}
```

**Ответ:**
```json
{
  "type": "response",
  "requestId": "req_123",
  "status": 200,
  "headers": {...},
  "body": "..."
}
```

**Ping/Pong:**
```json
{
  "type": "ping"
}
```

---

## 🟢 Updater

Система автообновления приложения через GitHub Releases.

### Возможности

- **Проверка версий** - сравнение с GitHub Releases
- **Загрузка** - скачивание обновлений
- **Установка** - автоматическая установка
- **Бэкап** - сохранение текущей версии
- **Откат** - восстановление при ошибках

---

### CLI Команды

#### Проверка обновлений
```bash
npm run cli -- updater:check
```

#### Скачать обновление
```bash
npm run cli -- updater:download
```

#### Установить обновление
```bash
npm run cli -- updater:install
```

#### Авто-обновление
```bash
npm run cli -- updater:auto
```

#### Статус
```bash
npm run cli -- updater:status
```

---

### API Endpoints

#### Проверка обновлений
```bash
GET /api/updater/check
```

Ответ:
```json
{
  "updateAvailable": true,
  "currentVersion": "2.2.0",
  "latestVersion": "2.3.0",
  "info": {
    "name": "Release v2.3.0",
    "description": "New features...",
    "publishedAt": "2026-03-23T12:00:00Z"
  }
}
```

#### Статус
```bash
GET /api/updater/status
```

#### Скачать
```bash
POST /api/updater/download
```

#### Установить
```bash
POST /api/updater/install
```

---

## 💻 CLI Команды

### Server (3 команды)

```bash
# Запустить сервер
npm run cli -- server:start [--port 3001]

# Статус сервера
npm run cli -- server:status

# Остановить сервер
npm run cli -- server:stop
```

### Updater (5 команд)

```bash
# Проверить обновления
npm run cli -- updater:check

# Скачать обновление
npm run cli -- updater:download

# Установить обновление
npm run cli -- updater:install

# Авто-обновление
npm run cli -- updater:auto

# Статус обновлений
npm run cli -- updater:status
```

---

## 📖 Примеры использования

### Bypass Server через CLI

```bash
# Запуск на порту 3001
npm run cli -- server:start --port 3001

# В другом терминале - проверка статуса
npm run cli -- server:status
```

### Bypass Server программно

```javascript
import { globalBypassServer } from './server/bypassServer.js';

// Инициализация
await globalBypassServer.init();

// Запуск
await globalBypassServer.start();

// Статистика
const stats = globalBypassServer.getStats();
console.log(stats);

// Остановка
await globalBypassServer.stop();
```

### Updater через CLI

```bash
# Проверка и установка
npm run cli -- updater:auto

# Или по шагам:
npm run cli -- updater:check
npm run cli -- updater:download
npm run cli -- updater:install
```

### Updater программно

```javascript
import { globalUpdater } from './utils/updater.js';

// Проверка
const result = await globalUpdater.checkForUpdates();

if (result.updateAvailable) {
  console.log(`Update: ${result.currentVersion} → ${result.latestVersion}`);
  
  // Загрузка
  await globalUpdater.downloadUpdate('./updates/update.zip');
  
  // Установка
  await globalUpdater.installUpdate('./updates/update.zip');
}
```

---

## 🔧 Настройка

### Bypass Server конфигурация

```javascript
const CONFIG = {
  port: 3001,              // HTTP порт
  wsPort: 3002,            // WebSocket порт
  maxClients: 100,         // Максимум клиентов
  proxyTimeout: 30000,     // Таймаут прокси (мс)
  healthCheckInterval: 60000,
  rateLimit: {
    windowMs: 60000,       // Окно (мс)
    maxRequests: 100       // Максимум запросов
  }
};
```

### Updater конфигурация

```javascript
const CONFIG = {
  owner: 'QuadDarv1ne',           // GitHub owner
  repo: 'cursor-reset-tools',     // GitHub repo
  branch: 'main',                 // Ветка
  checkInterval: 3600000,         // Проверка каждый час
  timeout: 30000,                 // Таймаут запроса
  backupDir: './updates/backup'   // Директория бэкапов
};
```

---

## 📊 Архитектура

### Bypass Server

```
Клиенты → HTTP/WebSocket → Bypass Server → Proxy Database → Прокси
                ↓
           Статистика
                ↓
           Rate Limiting
```

### Updater

```
Приложение → GitHub API → Проверка версии
                ↓
           Загрузка архива
                ↓
           Бэкап текущей версии
                ↓
           Распаковка и копирование
                ↓
           Обновление package.json
```

---

## ⚠️ Важные замечания

### Bypass Server

1. **Порт**: По умолчанию 3001, можно изменить через `--port`
2. **WebSocket**: Доступен на `/ws`
3. **Rate Limiting**: 100 запросов в минуту
4. **Логи**: Сохраняются в `logs/app.log`

### Updater

1. **Права доступа**: Требуются для записи файлов
2. **Бэкап**: Создаётся автоматически перед обновлением
3. **Перезапуск**: Требуется после установки обновлений
4. **GitHub**: Используется публичный API (без токена)

---

## 🛠️ Обслуживание

### Мониторинг сервера

```bash
# Статус
npm run cli -- server:status

# Health check
curl http://localhost:3001/health
```

### Управление обновлениями

```bash
# Проверка
npm run cli -- updater:check

# Авто-обновление
npm run cli -- updater:auto

# Статус
npm run cli -- updater:status
```

### Бэкапы

Директория: `updates/backup/`

Каждое обновление создаёт бэкап текущей версии.

---

## 📈 Статистика

### Bypass Server метрики

- `totalRequests` - Всего запросов
- `activeClients` - Активных клиентов
- `proxiedBytes` - Проксировано байт
- `uptime` - Время работы

### Updater метрики

- `currentVersion` - Текущая версия
- `latestVersion` - Последняя версия
- `updateAvailable` - Доступно обновление
- `isDownloading` - Идёт загрузка
- `downloadProgress` - Прогресс загрузки (%)

---

## 📞 Поддержка

При проблемах:

1. Проверьте логи: `logs/app.log`
2. Проверьте порт: `netstat -ano | findstr :3001`
3. Проверьте GitHub API: https://api.github.com/repos/QuadDarv1ne/cursor-reset-tools/releases/latest

---

**Версия**: 2.2.0  
**Автор**: Sazumi Cloud  
**Лицензия**: MIT
