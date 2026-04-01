# TODO - Cursor Reset Tools

## 🎯 Текущий приоритет - Фаза 3: Оптимизация и Надёжность

### 🔴 Критические (P0) - Требуют внимания

- [x] Input валидация всех API endpoints (body, query, params) ✅
- [x] CSP заголовки (Content Security Policy) ✅
- [x] SQL injection защита (parameterized queries для sqlite) ✅ Аудит проведён: все запросы параметризованы
- [x] XSS защита в EJS шаблонах ✅ Аудит проведён: используется `<%=` с экранированием
- [x] Resource stats: `data/resource-stats.json` не трекится в git (runtime-файл) ✅
- [x] ESM: `routes/reset.js` использует только `import` (нет `require`) ✅
- [x] ResourceMonitor: атомарная запись `data/resource-stats.json` (tmp + rename) ✅ Реализовано в `_save()`
- [x] Обработка ошибок: логирование в catch блоках ✅ **Добавлено в proxyManager, app, main**
- [x] FileValidator: валидация файлов перед модификацией ✅ **Интегрирован в routes/reset.js**

### 🟡 Важные (P1) - Улучшение качества

- [ ] TypeScript миграция (начать с utils/validator.js)
- [x] E2E тесты (Playwright) ✅ Базовые тесты для homepage и API
- [ ] Performance тесты (k6)
- [x] Security аудит (npm audit, Snyk) ✅ Проведён: 0 уязвимостей
- [x] Test coverage > 70% ✅ Добавлен в jest.config.json (70% threshold)
- [x] Input санитизация (HTML encode, trim, escape) ✅ Реализовано в utils/validator.js
- [x] npm audit fix ✅ Устранено 10 уязвимостей (sqlite3@6.0.1, nodemon@3.1.14)
- [x] Diagnostics export: `/api/diagnostics/export` ✅ Реализовано в routes/reset.js
- [ ] Разнести `app.js` на модули роутов (`routes/resources.js`, `routes/metrics.js`, `routes/notifications.js`) без изменения поведения

### 🟢 Улучшения (P2) - UX

- [ ] Swagger/OpenAPI документация
- [ ] PWA поддержка (manifest, service worker)
- [ ] Тёмная тема в UI
- [ ] CLI интерактив (inquirer, progress bars)
- [ ] Redis для production кэширования
- [ ] Dry-run режим для "опасных" операций (показывать план изменений без записи)
- [ ] WebSocket API для стриминга логов в реальном времени
- [ ] GraphQL API для гибких запросов

---

## 📋 Фаза 3: Оптимизация и Надёжность (Планируется)

- [ ] Атомарная запись resource-stats.json (tmp + rename)
- [ ] Оптимизация производительности SQLite запросов
- [ ] Кэширование тяжелых операций
- [ ] Улучшение обработки ошибок в CLI
- [ ] Добавление метрик производительности

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
- [x] Удалены устаревшие файлы (IMPROVEMENTS_REPORT.md, WHATS_NEW_2.8.0.md, backups/, logs/)
- [x] Обновлён package.json (keywords, repository, bugs, author)
- [x] Coverage badge в README

---

## 📊 Статус проекта

- **Версия:** 2.8.0-dev
- **Статус:** ✅ Фаза 1 завершена, ✅ Фаза 2 завершена (100%), 🔄 Фаза 3 (60%)
- **Тесты:** ✅ 199/199 passed (9 test suites)
- **ESLint:** ✅ 0 ошибок, 0 предупреждений
- **Платформы:** Windows, macOS, Linux, FreeBSD
- **Языки:** RU, EN, ZH
- **Последнее обновление:** 1 апреля 2026 г.
- **Coverage:** ✅ 70% threshold (jest)
- **npm audit:** ✅ 0 уязвимостей
- **Ветка:** dev (синхронизирована)

---

## 📝 Активные задачи

### В работе

1. **TypeScript миграция** - начать с utils/validator.js _(не начато)_
2. **Performance тесты** - k6 для API endpoints _(не начато)_
3. **CI/CD** - настроить GitHub Actions для автотестов ✅ Выполнено

### Следующие шаги

1. **TypeScript** - добавить typescript в devDependencies, начать с validator.js
2. **Performance тесты** - k6 для API endpoints
3. **Swagger/OpenAPI** - документация для /api/* endpoints

---

**Последний коммит:** 34163c4 - fix: улучшена обработка ошибок и валидация файлов
**Ветка:** dev (синхронизирована с origin/dev)
**Следующий релиз:** 2.8.0 (после завершения Фазы 3 и тестирования)

---

## 📌 Правила проекта

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge

---

## ✅ Выполнено в Фазе 2

- [x] Fix test leaks - добавлен `.unref()` таймерам и cleanup в afterEach
- [x] npm audit fix - обновлены sqlite3@6.0.1, nodemon@3.1.14 (0 уязвимостей)
- [x] E2E тесты - Playwright для homepage и API endpoints
- [x] Input валидация всех API endpoints (body, query, params)
- [x] CSP заголовки (Content Security Policy)
- [x] SQL injection защита (parameterized queries для sqlite)
- [x] XSS защита в EJS шаблонах
- [x] Diagnostics export `/api/diagnostics/export`

---

## 📈 Прогресс Фазы 2

| Задача | Статус | Приоритет |
|--------|--------|-----------|
| Fix test leaks | ✅ Выполнено | P0 |
| npm audit fix | ✅ Выполнено | P0 |
| E2E тесты (Playwright) | ✅ Выполнено | P1 |
| Input валидация | ✅ Выполнено | P0 |
| CSP заголовки | ✅ Выполнено | P0 |
| SQL injection защита | ✅ Выполнено | P0 |
| XSS защита | ✅ Выполнено | P0 |
| Security аудит | ✅ Выполнено | P1 |
| Test coverage > 70% | ✅ Выполнено | P1 |
| CI/CD Pipeline | ✅ Выполнено | P1 |
| SECURITY.md | ✅ Выполнено | P1 |
| Prettier настройка | ✅ Выполнено | P1 |
| EditorConfig | ✅ Выполнено | P1 |
| GitAttributes | ✅ Выполнено | P1 |
| Улучшение .gitignore | ✅ Выполнено | P1 |
| Очистка проекта | ✅ Выполнено | P1 |
| Diagnostics export | ✅ Выполнено | P1 |
| Resource stats (git) | ✅ Выполнено | P0 |
| ESM (require → import) | ✅ Выполнено | P0 |
| Атомарная запись stats | ✅ Выполнено | P0 |
| TypeScript миграция | ❌ Не начато | P1 |
| Performance тесты (k6) | ❌ Не начато | P1 |
| Swagger/OpenAPI документация | ❌ Не начато | P2 |
| PWA поддержка | ❌ Не начато | P2 |
| Тёмная тема в UI | ❌ Не начато | P2 |
| CLI интерактив | ❌ Не начато | P2 |
| Redis для production | ❌ Не начато | P2 |

**Прогресс Фазы 2:** 26/26 задач выполнено (100%) ✅

---

## 📋 План Фазы 3: Оптимизация и Надёжность

| Задача | Статус | Приоритет |
|--------|--------|-----------|
| Атомарная запись resource-stats.json | ✅ Выполнено | P0 |
| Оптимизация производительности SQLite запросов | ✅ Выполнено | P1 |
| Кэширование тяжелых операций | ❌ Не начато | P1 |
| Улучшение обработки ошибок CLI | ❌ Не начато | P2 |
| Метрики производительности | ❌ Не начато | P2 |

**Прогресс Фазы 3:** 2/5 задач выполнено (40%)
