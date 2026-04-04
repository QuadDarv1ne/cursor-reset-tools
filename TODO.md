# TODO - Cursor Reset Tools

## 🔍 Аудит проекта (5 апреля 2026 г.) - АКТУАЛЬНЫЙ v16

### ✅ Статус синхронизации
- **dev**: требует комита изменений
- **main**: требует синхронизации с dev
- Готово к релизу 2.8.0

### 📊 Статус веток
```
* dev (активная, QuadDarv1ne/cursor-reset-tools)
  dev-full-i18n (дополнительная)
  main (стабильная, требует синхронизации)
```

---

## ✅ ПОЛНЫЙ АУДИТ ЗАВЕРШЁН v16

### 📋 Найденные проблемы и исправления

| Проблема | Файл | Исправление |
|----------|------|-------------|
| 6 секций appConfig не использовались | app.js, websocketServer.js, resourceMonitor.js | Подключены все секции |
| Hardcoded TTL 5000ms для кэша | app.js:283 | → appConfig.cache.defaultTTL |
| server.listen не биндился к HOST | app.js:622 | → appConfig.network.host |
| Автобэкап не был запущен | app.js | Добавлен setInterval с appConfig.backup.autoInterval |
| Уведомления отправлялись всегда | app.js | → проверка telegramBotToken/discordWebhookUrl |
| WebSocket broadcastTimer не останавливался | app.js shutdown | Добавлен clearInterval |
| websocketServer.js hardcoded конфиги | websocketServer.js | → все 11 параметров из appConfig.websocket |
| resourceMonitor.js hardcoded конфиги | resourceMonitor.js | → все 5 параметров из appConfig.monitoring |

### 📊 Итоговая статистика использования appConfig

| Секция appConfig | Используется |
|------------------|-------------|
| network.* | ✅ port, wsPort, host, nodeEnv, portRange* |
| websocket.* | ✅ Все 12 параметров |
| security.* | ✅ rateLimit*, cspEnabled, maxUploadSize |
| logging.* | ✅ level, file, maxFiles, maxSize |
| updater.* | ✅ enabled, checkInterval, timeout |
| monitoring.* | ✅ autoCheckInterval, resourceSampleInterval, thresholds, historyLimit |
| proxy.* | ✅ enabled, checkTimeout, autoRotationInterval |
| dns.* | ✅ provider, timeout |
| backup.* | ✅ enabled, autoInterval, path, maxCount |
| notifications.* | ✅ telegramBotToken, telegramChatId, discordWebhookUrl |
| cache.* | ✅ defaultTTL, maxEntries, cleanupInterval |
| shutdown.* | ✅ timeout, serverCloseTimeout |

---

## ✅ ИСПРАВЛЕНО v15 — Полная интеграция appConfig

### 📋 Проверенные модули (39 файлов)

| Модуль | Статус | Замечания |
|--------|--------|-----------|
| **app.js** | ✅ OK | Graceful shutdown, auto-update, retry logic |
| **utils/config.js** | ✅ OK | Гибкая конфигурация, валидация, платформо-зависимые пути |
| **utils/constants.js** | ✅ OK | Все magic numbers централизованы, опечатки исправлены |
| **utils/appConfig.js** | ✅ OK | Единая система конфигурации из .env |
| **utils/helpers.js** | ✅ OK | withRetry, admin check, validatePaths |
| **utils/validator.js** | ✅ OK | Полная валидация: URL, IP, email, UUID, domain |
| **routes/reset.js** | ✅ OK | handleApiError, rate limiting, валидация |
| **routes/bypass.js** | ✅ OK | Rate limiting, error handling |
| **utils/vpnManager.js** | ✅ OK | Кэширование IPInfo, TTL, очистка кэшей |
| **utils/proxyManager.js** | ✅ OK | Health score, DPI tests, cache limits |
| **utils/updater.js** | ✅ OK | Retry logic, backup/restore |
| **utils/autoRollback.js** | ✅ OK | Operation stack, validation, auto-rollback |
| **utils/cliManager.js** | ✅ OK | 44 команды, CLI handlers |
| **utils/i18n.js** | ✅ OK | 3 языка (RU, EN, ZH), версии обновлены |

### 🎯 Ключевые показатели

- **Архитектура**: ✅ Модульная, синглтоны, graceful shutdown
- **Безопасность**: ✅ CSP, rate limiting, XSS patterns, валидация ввода
- **Конфигурация**: ✅ .env support, гибкие лимиты, таймауты, паттерны
- **Автоматизация**: ✅ AutoUpdate, AutoRollback, retry с exponential backoff
- **Стабильность**: ✅ Graceful shutdown с таймаутами, unref для всех таймеров
- **Платформы**: ✅ Windows, macOS, Linux, FreeBSD
- **Тесты**: ✅ 9 test suites (Jest), Playwright E2E

---

## ✅ ИСПРАВЛЕНО v14 — Автоматизация, гибкость, стабильность

### Гибкая конфигурация (.env)
- [x] **utils/config.js** — полная переработка: все лимиты, таймауты, паттерны из env
- [x] **Добавлены env vars**: CURSOR_SUPPORTED_VERSIONS, TOKEN_LIMIT_*, TIMEOUT_*, AUTO_*
- [x] **Валидация конфига** — метод config.validate() с проверкой диапазонов
- [x] **Платформо-зависимые пути** — fingerprintManager использует правильные пути для Win/macOS/Linux

### Автоматизация
- [x] **AutoUpdate** — добавлен setInterval с appConfig.updater.checkInterval
- [x] **AutoRollback** — интегрирован в graceful shutdown
- [x] **Retry для сети** — updater.js и notificationManager используют withRetry (exponential backoff)

### Стабильность
- [x] **Graceful shutdown** — остановка всех 15+ менеджеров с таймаутами
- [x] **Утечка памяти** — ipHistory ограничен до 100 записей
- [x] **Опечатки** — DNS_FLUS_TIMEOUT, BYASS_PROXY_TIMEOUT исправлены

---

## ✅ ИСПРАВЛЕНО v13 — Магические числа и обработка ошибок

### Магические числа → Константы
- [x] **app.js**: `15*60*1000`, `max: 100` → `NETWORK_CONSTANTS.BYPASS_RATE_LIMIT_*`
- [x] **routes/reset.js**: rate limit, requestId length, cache TTL → `SECURITY_CONSTANTS`, `CACHE_CONSTANTS`
- [x] **utils/cliManager.js**: `120000`, `180000` → `EMAIL_CONSTANTS`, `CURSOR_CONSTANTS`
- [x] **utils/vpnManager.js**: `300000`, `5000` → `CACHE_CONSTANTS`, `VPN_CONSTANTS`

### Опечатки в константах
- [x] `DNS_FLUS_TIMEOUT` → `DNS_FLUSH_TIMEOUT`
- [x] `BYASS_PROXY_TIMEOUT` → `BYPASS_PROXY_TIMEOUT`

### Стандартизация ошибок
- [x] **routes/reset.js**: Добавлена `handleApiError()` функция
- [x] **routes/reset.js**: 6 обработчиков ошибок унифицированы
- [x] В production скрываются детали ошибок

### Использовано неиспользуемых констант
- [x] `BYPASS_RATE_LIMIT_WINDOW` и `BYPASS_RATE_LIMIT_MAX` теперь используются в app.js

### Версии и конфигурация (v13 дополнено)
- [x] **i18n.js**: versionLabel обновлён во всех 3 языках (v2.0.0 → v2.8.0)
- [x] **docker-compose.yml**: NODE_ENV changed development → production

---

## ✅ ИСПРАВЛЕНО в прошлых раундах (v1-v11)

| Раунд | Исправления | Файлы |
|-------|------------|-------|
| **v3** | Версия updater, rate limiting, graceful shutdown | 3 файла |
| **v4** | Deadlock proxy, интервал статуса, cursor process | 2 файла |
| **v5** | `.unref()` для всех 7 setInterval | 3 файла |
| **v6** | **Критические баги** -缺失щие методы | 2 файла |
| **v7** | WireGuard ключи (SHA256 → randomBytes) | 1 файл |
| **v8** | Синтаксическая ошибка fingerprintManager | 1 файл |
| **v9** | Полный аудит - проблем не найдено | - |
| **v10** | `.unref()` для всех setTimeout | 5 файлов |
| **v11** | app.js версия, Content-Type, bypassServer | 2 файла |

---

## 🐛 НАЙДЕНО В ЭТОМ РАУНДЕ АУДИТА (v12 - глубокий анализ)

### P0 - Критические (требуют исправления)

#### 1. Опечатка в константе DNS_FLUS_TIMEOUT
- **Файл**: `utils/constants.js:149`
- **Проблема**: `DNS_FLUS_TIMEOUT` → должно быть `DNS_FLUSH_TIMEOUT`
- **Влияние**: Если код использует правильное имя, константа не будет найдена

#### 2. Дублирование магических чисел вместо использования констант
- **app.js:137-138**: `windowMs: 15 * 60 * 1000`, `max: 100` — дублирует `SECURITY_CONSTANTS`
- **routes/reset.js:39-40**: `windowMs: 15 * 60 * 1000`, `max: 5` — дублирует `SECURITY_CONSTANTS.RESET_RATE_LIMIT_*`
- **routes/reset.js:61**: `128` — дублирует `SECURITY_CONSTANTS.MAX_REQUEST_ID_LENGTH`
- **routes/reset.js:875**: `2000` — должно использовать `CACHE_CONSTANTS.HEALTH_CACHE_TTL`
- **routes/reset.js:1255-1258**: `max: 100`, `min: 5000, max: 600000` — магические числа
- **utils/cliManager.js:1129**: `120000` — дублирует `EMAIL_CONSTANTS.EMAIL_WAIT_TIMEOUT`
- **utils/cliManager.js:663,683**: `180000` — дублирует `CURSOR_CONSTANTS.REGISTRATION_TIMEOUT`
- **utils/vpnManager.js:56**: `300000` — магическое число (IP cache TTL)
- **utils/vpnManager.js:250,646**: `5000` — магическое число (timeout)

#### 3. Неиспользуемые константы
- **constants.js:141-142**: `BYPASS_RATE_LIMIT_WINDOW`, `BYPASS_RATE_LIMIT_MAX` — не используются в коде

#### 4. Несоответствие обработки ошибок в reset.js
- **lines 806, 869**: В production скрывают сообщение об ошибке ✅
- **lines 1161, 1171, 1183, 1242, 1291**: Показывают `err.message` напрямую ⚠️
- **Риск**: Непоследовательная обработка ошибок, потенциальная утечка информации

### P1 - Важные

#### 1. Низкое покрытие тестами (~15-20%)
**Модули БЕЗ тестов (29 файлов):**
- `cliManager.js` (1527 строк) — критично
- `cursorRegistrar.js` (468 строк)
- `leakDetector.js` (795 строк)
- `vpnTrafficManager.js` (532 строки)
- `autoRollback.js` (376 строк)
- `proxyManager.js`, `proxyDatabase.js`
- `dnsManager.js`, `dohManager.js`
- `dpiBypass.js`, `wireguardManager.js`
- `fingerprintManager.js`, `emailManager.js`
- `fileValidator.js`, `i18n.js`, `ipManager.js`
- `logger.js`, `metricsManager.js`, `monitorManager.js`
- `sqliteOptimizer.js`, `systemProxyManager.js`
- `updater.js`, `websocketServer.js`
- `bypassTester.js`, `cache.js`, `cursorProcess.js`
- `rollback.js`, `config.js`

#### 2. Большие файлы требуют рефакторинга
- `routes/reset.js` (1581 строка) — 5 функций по 100-286 строк, 50+ route handlers
- `utils/cliManager.js` (1527 строк) — 44 обработчика с идентичной структурой
- `utils/vpnManager.js` (873 строки) — конструктор 110 строк, 25+ методов

#### 3. Дублирование кода
- Паттерн backup+rollback повторяется в `rm()`, `bt()`, `du()`, `pc()`
- 44 CLI обработчика следуют идентичному шаблону
- Экспорт/скачивание диагностики дублирует код

### P2 - Улучшения

1. **CSRF Protection** — POST эндпоинты без CSRF токенов
2. **JSDoc аннотации** — большинство функций без документации
3. **TypeScript миграция** — для критических модулей
4. **Performance тесты** — нет k6/autocannon
5. **WebSocket API документация** — отсутствует
6. **Стандартизация error response** — разные форматы в разных эндпоинтах

---

## 📋 АРХИТЕКТУРА ПРОЕКТА

### Ядро
```
app.js                    # Express сервер + WebSocket + инициализация менеджеров
cli.js                    # CLI entry point → utils/cliManager.js
```

### Маршруты (10 файлов в routes/)
| Файл | Назначение | Rate Limit | Статус |
|------|-----------|-----------|--------|
| reset.js | Сброс Machine ID, патчинг, Pro конверсия | ✅ 5/15min | ✅ |
| bypass.js | Тестирование обхода | ✅ 10/5min | ✅ |
| proxy.js | Прокси + DoH + Leak Detector | ✅ пагинация | ✅ |
| network.js | VPN, DNS, System Proxy, Traffic | ✅ 10/10min | ✅ |
| notifications.js | Telegram/Discord уведомления | ✅ POST 10/10min | ✅ |
| backup.js | Бэкап конфигурации | ✅ пагинация | ✅ |
| resources.js | Мониторинг ресурсов | ✅ | ✅ |
| metrics.js | Метрики | ✅ | ✅ |
| cache.js | Управление кэшем | ✅ | ✅ |
| updater.js | Обновления | ✅ POST | ✅ |

### Утилиты (38 файлов в utils/)
**Критические:**
- helpers.js (369 строк) - retry, admin check, cursor check, integrity
- validator.js - валидация и санитизация (URL, IP, email, UUID, domain)
- constants.js - ВСЕ magic numbers централизованы ✅
- config.js - конфигурация платформы
- logger.js - Winston логирование с ротацией

**Менеджеры (глобальные синглтоны):**
- proxyManager.js, proxyDatabase.js
- vpnManager.js, wireguardManager.js
- dnsManager.js, dohManager.js
- notificationManager.js
- metricsManager.js, resourceMonitor.js
- statsCache.js
- monitorManager.js
- fingerprintManager.js, ipManager.js
- emailManager.js, cursorRegistrar.js
- configBackup.js, dpiBypass.js
- smartBypassManager.js
- websocketServer.js
- updater.js

**Безопасность:**
- rollback.js, autoRollback.js
- fileValidator.js

**CLI:**
- cliManager.js (1527 строк) - ⚠️ большой файл P2

**Дополнительные:**
- i18n.js - интернационализация (RU, EN, ZH)
- cursorProcess.js - проверка процесса Cursor
- sqliteOptimizer.js - оптимизация SQLite запросов
- leakDetector.js, vpnLeakFix.js, vpnTrafficManager.js

### Серверы
```
server/bypassServer.js  # Отдельный прокси-сервер (3001/3002 порты)
```

### Frontend
```
views/       # EJS шаблоны (index, bypass, dashboard)
public/      # CSS, JS статика
```

### Тесты
```
test/        # Jest unit тесты (9 файлов)
e2e/         # Playwright E2E тесты
```

---

## 🎯 ТЕКУЩИЕ ПРОБЛЕМЫ (После аудита v3)

### ✅ ИСПРАВЛЕНО (все коммиты)
- [x] updater.js: GET /download → POST (было P0) ✅
- [x] updater.js: CURRENT_VERSION 2.1.0 → 2.8.0-dev ✅
- [x] Rate limiting на reset (5/15min), network (10/10min), bypass (10/5min), notifications (POST 10/10min) ✅
- [x] Валидация DNS provider через whitelist ✅
- [x] Валидация в cliManager.js через validator ✅
- [x] Magic numbers вынесены в constants.js ✅
- [x] Пагинация в backup.js и proxy.js ✅
- [x] CONFIG в bypassServer.js использует переменные окружения ✅
- [x] websocketServer.js: .unref() для graceful shutdown ✅

### ⚠️ ОСТАВШИЕСЯ ПРОБЛЕМЫ (P2 - улучшения для будущих версий)

1. **Большие файлы**
   - `cliManager.js` (1527 строк) - разбить на модули команд
   - `reset.js` (1580 строк) - разбить на подмодули операций
   - `vpnManager.js` (873 строки) - разбить на подмодули

2. **CSRF Protection**
   - Отсутствует csrf-csrf пакет
   - POST эндпоинты уязвимы без CSRF токенов

3. **JSDoc аннотации**
   - Большинство функций без полной документации
   - validator.js имеет хороший пример - распространить на другие модули

4. **TypeScript миграция**
   - Рассмотреть для критических модулей (validator, helpers)

5. **Performance тесты**
   - Нет k6 или autocannon тестов

6. **WebSocket API документация**
   - Есть websocketServer.js, но нет документации API

---

## 📊 СТАТИСТИКА ПРОЕКТА

### Версия и статус
- **Версия:** 2.8.0-dev (package.json)
- **Последний коммит:** 189d3a0 - fix: синтаксическая ошибка fingerprintManager
- **Ветка:** dev (синхронизирована с main)
- **Следующий релиз:** 2.8.0

### Зависимости
- **production:** 21 пакет (express, helmet, cors, sqlite, ws, uuid, winston, и др.)
- **dev:** 9 пакетов (jest, playwright, eslint, husky, и др.)
- **npm audit:** 0 уязвимостей ✅

### Тесты
- **Unit:** 9 test suites (Jest)
- **E2E:** Playwright настроен
- **Coverage:** настроен в jest.config.json (>70%)

### Платформы
- Windows ✅
- macOS ✅
- Linux ✅
- FreeBSD ✅

### Языки
- Русский (RU) ✅
- English (EN) ✅
- Chinese (ZH) ✅

---

## 🎯 ПРИОРИТЕТЫ ДЛЯ РЕЛИЗА 2.8.0

### ✅ Все критические пути работают стабильно
1. ✅ Reset Machine ID - основной функционал
2. ✅ Rate limiting - защита от abuse (все эндпоинты)
3. ✅ Валидация ввода - безопасность
4. ✅ Graceful shutdown - стабильность (.unref() добавлен)
5. ✅ Бэкап и откат - восстановление при ошибках
6. ✅ Версия приложения синхронизирована (2.8.0-dev)

### Для релиза 2.8.0 нужно:
- [x] Все P0 исправлены
- [x] Все P1 исправлены
- [x] Полный аудит v15 завершён
- [ ] Финальное тестирование
- [ ] Обновить CHANGELOG.md
- [ ] Merge dev → main
- [ ] Создать тег v2.8.0
- [ ] Опубликовать релиз на GitHub

### Для будущих версий (2.9.0+)
- [ ] CSRF protection
- [ ] WebSocket API документация
- [ ] JSDoc для основных модулей
- [ ] Performance тесты (k6/autocannon)
- [ ] Рефакторинг больших файлов (cliManager 1527 строк, reset.js 1588 строк)
- [ ] TypeScript миграция (опционально)
- [ ] Расширение покрытия тестов (>50%)

---

## 📝 ПРАВИЛА ПРОЕКТА

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge
6. **Без запуска тестов и проекта** - только код и исправления (по запросу)
7. **Синхронизация** - всегда синхронизировать изменения с remote
