# TODO - Cursor Reset Tools

## 🔍 Аудит проекта (4 апреля 2026 г.) - АКТУАЛЬНЫЙ

### ✅ Статус синхронизации
- **dev** и **main** синхронизированы ✅
- Готово к релизу 2.8.0

---

## 📋 Архитектура проекта

### Структура
```
cursor-reset-tools/
├── app.js                    # Главный Express сервер (web UI + API)
├── cli.js                    # CLI entry point
├── routes/                   # API маршруты (10 файлов)
│   ├── reset.js              # Сброс Machine ID, патчинг, Pro конверсия
│   ├── bypass.js             # Тестирование обхода
│   ├── proxy.js              # Прокси управление + DoH + Leak Detector
│   ├── network.js            # VPN, DNS, System Proxy, Traffic
│   ├── notifications.js      # Telegram/Discord уведомления
│   ├── backup.js             # Бэкап конфигурации
│   ├── resources.js          # Мониторинг ресурсов
│   ├── metrics.js            # Метрики
│   ├── cache.js              # Управление кэшем
│   └── updater.js            # Обновления
├── utils/                    # Утилиты (27 файлов)
│   ├── helpers.js            # Вспомогательные функции (retry, admin check, integrity)
│   ├── validator.js          # Валидация и санитизация
│   ├── config.js             # Конфигурация
│   ├── logger.js             # Логирование (Winston)
│   ├── i18n.js               # Интернационализация
│   ├── proxyManager.js       # Управление прокси
│   ├── proxyDatabase.js      # База прокси (SQLite)
│   ├── vpnManager.js         # VPN менеджер (OpenVPN/WireGuard)
│   ├── wireguardManager.js   # WireGuard специфичный
│   ├── dnsManager.js         # DNS менеджер
│   ├── dohManager.js         # DNS-over-HTTPS
│   ├── systemProxyManager.js # Системный прокси
│   ├── notificationManager.js# Уведомления
│   ├── metricsManager.js     # Метрики
│   ├── resourceMonitor.js    # Мониторинг ресурсов
│   ├── statsCache.js         # Кэш статистики
│   ├── monitorManager.js     # Мониторинг Cursor
│   ├── fingerprintManager.js # Fingerprint (MAC, hostname)
│   ├── ipManager.js          # IP менеджер
│   ├── emailManager.js       # Временная почта
│   ├── cursorRegistrar.js    # Регистрация Cursor
│   ├── configBackup.js       # Бэкап конфигурации
│   ├── dpiBypass.js          # DPI обход
│   ├── bypassTester.js       # Тестирование обхода
│   ├── leakDetector.js       # Детектор утечек
│   ├── vpnLeakFix.js         # Исправление VPN утечек
│   ├── vpnTrafficManager.js  # VPN трафик туннель
│   ├── smartBypassManager.js # Умный обход
│   ├── websocketServer.js    # WebSocket сервер
│   ├── updater.js            # Обновления
│   ├── rollback.js           # Откат изменений
│   ├── autoRollback.js       # Автоматический откат
│   ├── fileValidator.js      # Валидация файлов
│   └── cliManager.js         # CLI менеджер
├── server/
│   └── bypassServer.js       # Отдельный Bypass сервер (прокси)
├── views/                    # EJS шаблоны
├── public/                   # Статика (CSS, JS)
├── data/                     # Данные (metrics, proxies, vpn-configs)
├── test/                     # Unit тесты (Jest)
└── e2e/                      # E2E тесты (Playwright)
```

### Ключевые зависимости
- **express** - HTTP сервер
- **helmet** - Security headers
- **cors** - CORS
- **express-rate-limit** - Rate limiting
- **sqlite/sqlite3** - Хранение данных
- **uuid** - Генерация ID
- **winston** - Логирование
- **ws** - WebSocket
- **node-fetch** - HTTP клиент
- **socks-proxy-agent** - SOCKS прокси
- **http-proxy-middleware** - HTTP проксирование
- **fs-extra** - Файловые операции
- **dotenv** - Переменные окружения
- **ejs** - Шаблоны

---

## 🐛 Найденные проблемы при аудите

### КРИТИЧЕСКИЕ (P0)

#### 1. ⚠️ GET запросы для деструктивных операций в updater.js
- **Файл:** `routes/updater.js`
- **Проблема:** `GET /api/updater/download` выполняет скачивание файлов
- **Риск:** CSRF атаки, кеширование, повторное выполнение
- **Решение:** Изменить на POST

#### 2. ⚠️ Отсутствие лимита запросов на чувствительных эндпоинтах
- **Файлы:** `routes/reset.js`, `routes/network.js`
- **Проблема:** Глобальный rate limit только на `/api`, но нет индивидуальных лимитов
- **Риск:** brute-force на reset/DNS/VPN операции
- **Решение:** Добавить индивидуальные rate limiters

### ВАЖНЫЕ (P1)

#### 3. ⚠️ Валидация DNS provider в network.js
- **Файл:** `routes/network.js` (POST /api/dns/set)
- **Проблема:** Валидируется только наличие `provider` строки, но не проверяется допустимое значение
- **Решение:** Добавить whitelist провайдеров

#### 4. ⚠️ Отсутствие пагинации в некоторых списках
- **Файлы:** `routes/backup.js` (GET /list), `routes/proxy.js`
- **Проблема:** Возвращаются все элементы без лимита
- **Риск:** DoS при большом количестве бэкапов/прокси
- **Решение:** Добавить пагинацию (offset/limit)

#### 5. ⚠️ Hardcoded пути в bypassServer.js
- **Файл:** `server/bypassServer.js`
- **Проблема:** CONFIG с hardcoded портами, нет динамической конфигурации
- **Решение:** Использовать переменные окружения

#### 6. ⚠️ Неполная валидация в cliManager.js
- **Файл:** `utils/cliManager.js`
- **Проблема:** Некоторые команды не проверяют входные параметры
- **Пример:** `handleProxyAdd` не валидирует формат proxy строки
- **Решение:** Добавить валидацию через validator модуль

### ЖЕЛАТЕЛЬНЫЕ (P2)

#### 7. 💡 Дублирование логики проверки Cursor процесса
- **Файлы:** `helpers.js`, `routes/reset.js`
- **Проблема:** Несколько мест проверяют процесс Cursor
- **Решение:** Централизовать в одном месте

#### 8. 💡 Отсутствие типизации
- **Проблема:** JavaScript без типов сложно поддерживать
- **Решение:** Рассмотреть TypeScript или JSDoc аннотации

#### 9. 💡 Большие файлы (>1000 строк)
- **Файлы:** `cliManager.js` (1511 строк), `reset.js` (1503 строки)
- **Решение:** Разбить на меньшие модули

#### 10. 💡 Magic numbers в коде
- **Примеры:** `10000`, `50 * 1024 * 1024`, `128` в helpers.js
- **Решение:** Вынести в константы/конфигурацию

---

## ✅ Выполнено - Фаза 1: Стабильность (2.8.0-dev)

- [x] .env поддержка для конфигурации (dotenv)
- [x] Улучшенное логирование с Winston и ротацией файлов
- [x] Graceful shutdown для всех менеджеров
- [x] Глобальные обработчики ошибок (uncaughtException, unhandledRejection)
- [x] Pre-commit hooks (Husky + Lint-staged)
- [x] Makefile и make.bat для удобных команд
- [x] Docker Compose конфигурация
- [x] Multi-stage Dockerfile

---

## ✅ Выполнено - Фаза 2: Качество и Безопасность (2.8.0)

- [x] Fix test leaks - добавлен `.unref()` таймерам и cleanup в afterEach
- [x] npm audit fix - обновлены sqlite3@6.0.1, nodemon@3.1.14 (0 уязвимостей)
- [x] E2E тесты - Playwright для homepage и API endpoints
- [x] Input валидация всех API endpoints (body, query, params)
- [x] CSP заголовки (Content Security Policy)
- [x] SQL injection защита (parameterized queries для sqlite)
- [x] XSS защита в EJS шаблонах
- [x] Security аудит (npm audit, Snyk)
- [x] Test coverage > 70% (настроен в jest.config.json)
- [x] Input санитизация (HTML encode, trim, escape)
- [x] CI/CD Pipeline - GitHub Actions для test, lint, build, release
- [x] SECURITY.md - политика безопасности
- [x] .prettierrc - форматирование кода
- [x] .editorconfig - единый стиль кода
- [x] .gitattributes - контроль окончаний строк
- [x] Улучшен .gitignore
- [x] Удалены устаревшие файлы
- [x] Обновлён package.json
- [x] Coverage badge в README

---

## ✅ Выполнено - Фаза 3: Оптимизация и Надёжность

- [x] Атомарная запись resource-stats.json
- [x] Оптимизация производительности SQLite запросов (GLOB вместо LIKE)
- [x] Кэширование тяжелых операций (StatsCache)
- [x] Улучшение обработки ошибок CLI
- [x] Метрики производительности (ResourceMonitor)
- [x] Проверка целостности workbench файла
- [x] Скрытие чувствительных данных в /api/paths

**Прогресс Фазы 3:** 7/7 задач выполнено (100%) ✅

---

## 📊 Статус проекта

- **Версия:** 2.8.0-dev
- **Статус:** ✅ Фаза 1 завершена, ✅ Фаза 2 завершена, ✅ Фаза 3 завершена
- **Найдено новых проблем:** 2 P0, 4 P1, 4 P2
- **Тесты:** 199/199 passed (9 test suites) ✅
- **Платформы:** Windows, macOS, Linux, FreeBSD
- **Языки:** RU, EN, ZH
- **npm audit:** ✅ 0 уязвимостей
- **Ветка:** dev и main синхронизированы ✅

---

## 🎯 Текущий приоритет - Подготовка к релизу 2.8.0

### P0 - Критические (исправить перед релизом)

- [ ] Изменить GET /api/updater/download на POST
- [ ] Добавить индивидуальные rate limiters на чувствительные эндпоинты

### P1 - Важные

- [ ] Валидация DNS provider через whitelist
- [ ] Добавить пагинацию в списки бэкапов и прокси
- [ ] Вынести CONFIG из bypassServer.js в переменные окружения
- [ ] Добавить валидацию в CLI команды

### P2 - Улучшения

- [ ] Централизовать проверку процесса Cursor
- [ ] JSDoc аннотации для основных функций
- [ ] Рефакторинг больших файлов (cliManager.js, reset.js)
- [ ] Вынести magic numbers в константы
- [ ] CSRF protection (требует csrf-csrf пакет)
- [ ] TypeScript миграция (начать с utils/validator.js)
- [ ] Performance тесты (k6)
- [ ] Swagger/OpenAPI документация
- [ ] PWA поддержка
- [ ] Тёмная тема в UI
- [ ] CLI интерактив (inquirer, progress bars)
- [ ] Redis для production кэширования
- [ ] Dry-run режим для "опасных" операций
- [ ] WebSocket API для стриминга логов
- [ ] GraphQL API для гибких запросов

---

## 📝 Активные задачи

### В работе

1. ⏳ **Исправление P0 проблем** - GET → POST, rate limiting
2. ⏳ **Исправление P1 проблем** - валидация, пагинация, конфиг

### Выполнено

1. ✅ Исправлены 4 P0 проблемы (дубли эндпоинтов, GET→POST, path traversal, DoS)
2. ✅ Исправлены 4 P1 проблемы (валидация domain, host/port, botToken/webhookUrl, error handling)
3. ✅ Добавлен audit trail для reset и patch операций
4. ✅ Ограничение длины x-request-id (128 символов)
5. ✅ LIKE заменён на GLOB в SQLite запросах
6. ✅ Запущен lint и исправлены все ошибки
7. ✅ Проверка целостности workbench файла с автоматическим rollback
8. ✅ Скрытие чувствительных данных в /api/paths в production режиме

### Следующие шаги

1. Исправить P0 проблемы (GET → POST в updater.js)
2. Добавить rate limiting на чувствительные эндпоинты
3. Исправить P1 проблемы
4. CSRF protection
5. Релиз 2.8.0

---

**Последний коммит:** f1281cb - feat: добавлена проверка целостности workbench и скрытие данных в production
**Ветка:** dev и main синхронизированы ✅
**Следующий релиз:** 2.8.0

---

## 📌 Правила проекта

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge
6. **Без запуска тестов и проекта** - только код и исправления (по запросу)
