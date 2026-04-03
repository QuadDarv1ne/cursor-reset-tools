# TODO - Cursor Reset Tools

## 🔍 Аудит проекта (3 апреля 2026 г.) - АКТУАЛЬНЫЙ

### ✅ Статус синхронизации
- **dev** опережает **main** на 6 коммитов
- Требуется PR и merge в main после исправлений

### 📊 Результаты глубокого аудита кода (3 апреля 2026 г.)

#### 🐛 Найденные проблемы

**КРИТИЧЕСКИЕ (P0) - Требуют немедленного исправления:**

1. **Дублирование эндпоинтов** - одни и те же URL обрабатываются в нескольких файлах
   - `routes/reset.js` дублирует эндпоинты из `app.js`, `routes/proxy.js`, `routes/network.js`
   - Влияние: конфликты маршрутов, сложность поддержки, непредсказуемое поведение
   - Решение: удалить дубли из `reset.js`, оставить только в специализированных роутах

2. **GET для деструктивных операций** - нарушение HTTP-семантики
   - `/api/reset`, `/api/patch` используют GET для модификации файлов
   - Влияние: кэширование прокси, CSRF уязвимость, нарушение REST принципов
   - Решение: изменить на POST

3. **Path Traversal в backup.js** - отсутствие санитизации filePath
   - `/api/config-backup/export`, `/api/config-backup/import`, `/delete/:filename`
   - Влияние: запись/чтение из произвольных директорий
   - Решение: добавить `sanitizePath()` валидацию

4. **Отсутствие валидации intervalMs** - DoS через proxy rotation
   - `/api/proxy/rotation/start` принимает `intervalMs = 1`
   - Влияние: ротация каждую миллисекунду, перегрузка системы
   - Решение: ограничить диапазон (60000-86400000 ms)

**ВАЖНЫЕ (P1) - Улучшение качества:**

5. **Валидация domain в proxy.js** - SSRF уязвимость
   - `/api/proxy/resolve` не проверяет домен
   - Решение: использовать `validateDomain()`

6. **Валидация host/port в network.js** - SSRF
   - `/api/system-proxy/configure` без валидации
   - Решение: добавить валидацию IP/домена и порта

7. **Валидация botToken/webhookUrl** - notifications.js
   - Проверка только на наличие, не формат
   - Решение: regex валидация для token, URL валидация для webhook

8. **err.message в production** - утечка информации
   - Возврат полных ошибок клиенту
   - Решение: generic сообщение в production, детальное в лог

9. **CSRF защита** - отсутствует
   - POST запросы уязвимы к CSRF
   - Решение: добавить csrf middleware

10. **Content-Type и size-limit middleware** - отсутствуют
    - Нет ограничения размера тела запроса
    - Решение: `express.json({ limit: '1mb' })`, проверка content-type

**ЖЕЛАТЕЛЬНЫЕ (P2) - Улучшения:**

11. Ограничение длины `x-request-id` в reset.js
12. Audit trail логирование для деструктивных операций
13. Оптимизация LIKE запросов в SQLite (full table scan)
14. Проверка целостности файла workbench после модификации
15. Скрыть чувствительные данные в `/api/paths` в production режиме

---

## 🎯 Текущий приоритет - Исправление P0 проблем

### 🔴 Критические (P0) - В РАБОТЕ

- [ ] Удалить дубли эндпоинтов из routes/reset.js
- [ ] Изменить GET /api/reset и /api/patch на POST
- [ ] Добавить sanitizePath() для всех filePath в backup.js
- [ ] Валидация intervalMs в proxy rotation (60000-86400000)

### 🟡 Важные (P1) - Следующие

- [ ] Валидация domain через validateDomain() в proxy.js
- [ ] Валидация host/port в network.js
- [ ] Валидация botToken/webhookUrl в notifications.js
- [ ] Скрыть err.message в production режиме
- [ ] Добавить CSRF protection
- [ ] Добавить Content-Type и size-limit middleware

### 🔶 Улучшения (P2) - Планируется

- [ ] TypeScript миграция (начать с utils/validator.js)
- [ ] Performance тесты (k6)
- [ ] Swagger/OpenAPI документация
- [ ] PWA поддержка (manifest, service worker)
- [ ] Тёмная тема в UI
- [ ] CLI интерактив (inquirer, progress bars)
- [ ] Redis для production кэширования
- [ ] Dry-run режим для "опасных" операций
- [ ] WebSocket API для стриминга логов
- [ ] GraphQL API для гибких запросов

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

## ✅ Выполнено - Фаза 3: Оптимизация и Надёжность

- [x] Атомарная запись resource-stats.json (tmp + rename)
- [x] Оптимизация производительности SQLite запросов
- [x] Кэширование тяжелых операций (StatsCache.getOrCompute)
- [x] Улучшение обработки ошибок CLI
- [x] Метрики производительности (ResourceMonitor)

**Прогресс Фазы 3:** 5/5 задач выполнено (100%) ✅

---

## 📊 Статус проекта

- **Версия:** 2.8.0-dev
- **Статус:** ✅ Фаза 1 завершена, ✅ Фаза 2 завершена (100%), ✅ Фаза 3 завершена (100%)
- **Найдено проблем:** 4 P0 (критические), 6 P1 (важные), 5 P2 (улучшения)
- **Исправлено:** 0 P0, 0 P1, 0 P2 (начат аудит 3 апреля)
- **Тесты:** ✅ 199/199 passed (9 test suites)
- **ESLint:** ✅ 0 ошибок, 0 предупреждений
- **Платформы:** Windows, macOS, Linux, FreeBSD
- **Языки:** RU, EN, ZH
- **Последнее обновление:** 3 апреля 2026 г.
- **Coverage:** ✅ 70% threshold (jest)
- **npm audit:** ✅ 0 уязвимостей
- **Ветка:** dev (требуется исправление P0 перед синхронизацией с main)

---

## 📝 Активные задачи

### В работе

1. **Исправление P0 проблем** - дубли эндпоинтов, GET→POST, path traversal, DoS
2. **Исправление P1 проблем** - валидация, CSRF, error handling
3. **Синхронизация dev → main** - после исправления всех P0

### Следующие шаги

1. Исправить 4 P0 проблемы
2. Исправить 6 P1 проблем
3. Запустить тесты и lint
4. Синхронизировать dev → main
5. Релиз 2.8.0

---

**Последний коммит:** b4c67d6 - docs: обновлена информация о синхронизации веток (6 коммитов)
**Ветка:** dev (опережает main на 6 коммитов)
**Следующий релиз:** 2.8.0 (после исправления P0 проблем и тестирования)

---

## 📌 Правила проекта

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge
6. **Без запуска тестов и проекта** - только код и исправления (по запросу)
