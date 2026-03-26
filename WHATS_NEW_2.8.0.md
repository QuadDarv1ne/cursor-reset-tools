# 🚀 Что нового в версии 2.8.0

## Обзор изменений

Версия 2.8.0 фокусируется на **стабильности**, **Developer Experience (DX)** и **документации**.

---

## 📋 Новые возможности

### 1. Конфигурация через .env

Теперь все настройки можно хранить в файле `.env`:

```bash
# Скопируйте пример
cp .env.example .env

# Отредактируйте под ваши нужды
nano .env
```

**Основные переменные:**

| Переменная | Значение по умолчанию | Описание |
|-----------|---------------------|----------|
| `PORT` | 3000 | Порт HTTP сервера |
| `WS_PORT` | 3001 | Порт WebSocket |
| `NODE_ENV` | development | Окружение (development/production) |
| `LOG_LEVEL` | info | Уровень логирования |
| `LOG_FILE` | logs/app.log | Путь к файлу логов |
| `LOG_MAX_FILES` | 30 | Максимум файлов логов |
| `LOG_MAX_SIZE` | 10m | Макс размер файла до ротации |

---

### 2. Улучшенное логирование

**Winston** с ротацией файлов:

- **Автоматическая ротация** по дням
- **Отдельные файлы** для ошибок
- **Цветной вывод** в консоли
- **JSON формат** в файлах
- **Разные уровни**: error, warn, info, debug, verbose

**Примеры логов:**

```
2026-03-26 10:30:45 [info]: [app] Server running on http://localhost:3000
2026-03-26 10:30:46 [error]: [vpnManager] Connection failed
```

**Просмотр логов:**

```bash
# Текущие логи
tail -f logs/app-current.log

# Логи за сегодня
cat logs/app-2026-03-26.log

# Только ошибки
cat logs/app-error-2026-03-26.log
```

---

### 3. Graceful Shutdown

Корректная остановка всех менеджеров:

- **Автоматическая очистка** ресурсов
- **Закрытие соединений** (HTTP, WebSocket, VPN)
- **Сохранение состояния** перед выходом
- **Защита от повторного сигнала**

**Сигналы:**

- `SIGTERM` - плановая остановка
- `SIGINT` - Ctrl+C
- `uncaughtException` - критическая ошибка
- `unhandledRejection` - ошибка Promise

---

### 4. Pre-commit Hooks

**Husky + Lint-staged** автоматически проверяют код перед коммитом:

```bash
# При коммите автоматически:
1. ESLint проверка (.js файлы)
2. Prettier форматирование (.json, .md)
```

**Настройка в package.json:**

```json
{
  "lint-staged": {
    "*.js": ["eslint --fix"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

### 5. Makefile и make.bat

**Удобные команды** для разработки:

#### Linux/macOS (Makefile)

```bash
make help           # Показать все команды
make install        # Установить зависимости
make dev            # Запуск разработки
make start          # Запуск production
make test           # Запуск тестов
make test-coverage  # Тесты с покрытием
make lint           # Проверка ESLint
make lint-fix       # Исправление ESLint
make clean          # Очистка
make docker-build   # Сборка Docker
make docker-run     # Запуск Docker
make backup         # Бэкап конфигурации
```

#### Windows (make.bat)

```bat
make.bat help
make.bat install
make.bat dev
make.bat test
make.bat clean
```

---

### 6. Docker Compose

**Быстрый старт** с Docker:

```bash
# Запуск разработки
docker-compose up --build

# Запуск production
docker-compose -f docker-compose.yml up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

**Multi-stage Dockerfile:**

- **Builder stage** - сборка
- **Production stage** - минимальный образ
- **Development stage** - с nodemon

---

### 7. Глобальные обработчики ошибок

**Автоматический перехват** ошибок:

```javascript
// Необработанные исключения
process.on('uncaughtException', error => {
  logger.error(`Uncaught Exception: ${error.message}`, 'app');
  gracefulShutdown('uncaughtException');
});

// Необработанные Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason?.message}`, 'app');
});
```

---

## 📁 Новые файлы

```
cursor-reset-tools/
├── .env.example          # Шаблон конфигурации
├── .env                  # Конфигурация (не tracked)
├── .dockerignore         # Игнорирование для Docker
├── .husky/pre-commit     # Pre-commit hook
├── Makefile              # Команды для Linux/macOS
├── make.bat              # Команды для Windows
├── docker-compose.yml    # Docker Compose
├── Dockerfile            # Multi-stage Docker
├── CHANGELOG.md          # История изменений
├── CONTRIBUTING.md       # Гайд по вкладу
└── .github/
    ├── ISSUE_TEMPLATE/
    │   ├── bug_report.md
    │   ├── feature_request.md
    │   └── docs_improvement.md
    └── PULL_REQUEST_TEMPLATE.md
```

---

## 🔧 Миграция с 2.7.0

### Шаг 1: Обновление зависимостей

```bash
npm install
```

### Шаг 2: Создание .env

```bash
cp .env.example .env
```

### Шаг 3: Настройка (опционально)

Отредактируйте `.env` под ваши нужды.

### Шаг 4: Запуск

```bash
# Разработка
npm run dev

# Production
npm start

# Docker
docker-compose up --build
```

---

## 🎯 Примеры использования

### Разработка

```bash
# Установка
make install

# Запуск с auto-reload
make dev

# Проверка кода
make lint

# Тесты
make test
```

### Production

```bash
# Сборка Docker
make docker-build

# Запуск
make docker-run

# Просмотр логов
docker logs -f cursor-reset-tools
```

### Бэкап

```bash
# Создание бэкапа
make backup

# Восстановление
make restore
```

---

## 📊 Сравнение с 2.7.0

| Возможность | 2.7.0 | 2.8.0 |
|-----------|-------|-------|
| Конфигурация | Хардкод | .env |
| Логирование | Простой файл | Winston + ротация |
| Graceful Shutdown | Базовый | Полный |
| Error Handling | Частичный | Полный |
| Pre-commit Hooks | ❌ | ✅ |
| Makefile | ❌ | ✅ |
| Docker Compose | ❌ | ✅ |
| CHANGELOG | ❌ | ✅ |
| Issue Templates | ❌ | ✅ |
| PR Template | ❌ | ✅ |

---

## 🐛 Известные проблемы

- Нет (все тесты проходят ✅)

---

## 📞 Поддержка

Если у вас возникли вопросы:

1. Проверьте [README_RU.md](README_RU.md)
2. Посмотрите [CONTRIBUTING.md](CONTRIBUTING.md)
3. Создайте [Issue](https://github.com/QuadDarv1ne/cursor-reset-tools/issues)

---

**Версия:** 2.8.0-dev  
**Дата:** 26 марта 2026 г.  
**Автор:** Dupley Maxim Igorevich
