# TODO - Cursor Reset Tools

## 🎯 Текущий приоритет - Фаза 2: Качество и Безопасность

### 🔴 Критические (P0) - Требуют внимания

- [x] Input валидация всех API endpoints (body, query, params)
- [x] CSP заголовки (Content Security Policy)
- [x] SQL injection защита (parameterized queries для sqlite) ✅ Аудит проведён: все запросы параметризованы
- [x] XSS защита в EJS шаблонах ✅ Аудит проведён: используется `<%=` с экранированием

### 🟡 Важные (P1) - Улучшение качества

- [ ] TypeScript миграция (начать с utils/validator.js)
- [ ] E2E тесты (Playwright)
- [ ] Performance тесты (k6)
- [ ] Security аудит (npm audit, Snyk)
- [ ] Test coverage > 90% (сейчас неизвестно)
- [ ] Input санитизация (HTML encode, trim, escape)

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
- **Статус:** ✅ Фаза 1 завершена
- **Тесты:** ✅ 199/199 passed (9 test suites)
- **ESLint:** ✅ 0 ошибок, 0 предупреждений
- **Платформы:** Windows, macOS, Linux, FreeBSD
- **Языки:** RU, EN, ZH
- **Последнее обновление:** 26 марта 2026 г.

---

## 📝 Активные задачи

### В работе

1. **Test coverage** - добавить istanbul для отчётов (>90%)
2. **Security аудит** - npm audit, Snyk интеграция
3. **E2E тесты** - Playwright для критических сценариев

### Следующие шаги

1. Настроить coverage отчёты в CI/CD
2. Интегрировать npm audit в pre-commit hook
3. Создать базовые E2E тесты для основных endpoints

---

## 📌 Правила проекта

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge

---

**Последний коммит:** ca086ab - docs: обновлён TODO.md - Фаза 2 (P0) завершена
**Ветка:** dev
**Следующий релиз:** 2.8.0 (после завершения Фазы 2)
