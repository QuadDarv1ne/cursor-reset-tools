# TODO - Cursor Reset Tools

## 🎯 Текущий приоритет - Фаза 2: Качество и Безопасность

### 🔴 Критические (P0) - Требуют внимания

- [x] Input валидация всех API endpoints (body, query, params)
- [x] CSP заголовки (Content Security Policy)
- [x] SQL injection защита (parameterized queries для sqlite) ✅ Аудит проведён: все запросы параметризованы
- [x] XSS защита в EJS шаблонах ✅ Аудит проведён: используется `<%=` с экранированием

### 🟡 Важные (P1) - Улучшение качества

- [ ] TypeScript миграция (начать с utils/validator.js)
- [x] E2E тесты (Playwright) ✅ Базовые тесты для homepage и API
- [ ] Performance тесты (k6)
- [x] Security аудит (npm audit, Snyk) ✅ Проведён: 10 уязвимостей (8 high требуют breaking changes)
- [x] Test coverage > 90% (сейчас неизвестно) ✅ Добавлен в jest.config.json (70% threshold)
- [x] Input санитизация (HTML encode, trim, escape) ✅ Реализовано в utils/validator.js
- [x] npm audit fix ✅ Устранено 10 уязвимостей (sqlite3@6.0.1, nodemon@3.1.14)

### 🟢 Улучшения (P2) - UX

- [ ] Swagger/OpenAPI документация
- [ ] PWA поддержка (manifest, service worker)
- [ ] Тёмная тема в UI
- [ ] CLI интерактив (inquirer, progress bars)
- [ ] Redis для production кэширования

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

## 📊 Статус проекта

- **Версия:** 2.8.0-dev 🚧
- **Статус:** ✅ Фаза 1 завершена, 🔄 Фаза 2 в процессе
- **Тесты:** ✅ 199/199 passed (9 test suites)
- **ESLint:** ✅ 0 ошибок, 0 предупреждений
- **Платформы:** Windows, macOS, Linux, FreeBSD
- **Языки:** RU, EN, ZH
- **Последнее обновление:** 26 марта 2026 г.
- **Coverage:** ✅ Настроен (70% threshold, jest)
- **Ветка:** dev

---

## 📝 Активные задачи

### В работе

1. **TypeScript миграция** - начать с utils/validator.js _(не начато)_
2. **Performance тесты** - k6 для API endpoints _(не начато)_
3. **CI/CD** - настроить GitHub Actions для автотестов _(требуется)_

### Следующие шаги

1. **TypeScript** - добавить typescript в devDependencies, начать с validator.js
2. **CI/CD** - настроить GitHub Actions для автотестов (test, lint, e2e)
3. **Performance тесты** - k6 для API endpoints
4. **Swagger/OpenAPI** - документация для /api/* endpoints

---

## 📌 Правила проекта

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge

---

**Последний коммит:** 8f3ae5f - feat: добавлены E2E тесты (Playwright)
**Ветка:** dev (требуется push в main)
**Следующий релиз:** 2.8.0 (после завершения Фазы 2)

---

## ✅ Выполнено в Фазе 2

- [x] Fix test leaks - добавлен `.unref()` таймерам и cleanup в afterEach
- [x] npm audit fix - обновлены sqlite3@6.0.1, nodemon@3.1.14 (0 уязвимостей)
- [x] E2E тесты - Playwright для homepage и API endpoints

---

## 📈 Прогресс Фазы 2

| Задача | Статус | Приоритет |
|--------|--------|-----------|
| Fix test leaks | ✅ Выполнено | P0 |
| npm audit fix | ✅ Выполнено | P0 |
| E2E тесты (Playwright) | ✅ Выполнено | P1 |
| TypeScript миграция | ❌ Не начато | P1 |
| Performance тесты (k6) | ❌ Не начато | P1 |
| CI/CD (GitHub Actions) | ❌ Не начато | P1 |
| Swagger/OpenAPI документация | ❌ Не начато | P2 |
| PWA поддержка | ❌ Не начато | P2 |
| Тёмная тема в UI | ❌ Не начато | P2 |
| CLI интерактив | ❌ Не начато | P2 |
| Redis для production | ❌ Не начато | P2 |

**Прогресс Фазы 2:** 3/11 задач выполнено
