# TODO - Cursor Reset Tools

## 🎯 Текущий приоритет - Фаза 2: Качество и Безопасность

### 🔴 Критические (P0) - Требуют внимания

- [ ] Input валидация всех API endpoints (body, query, params)
- [ ] CSP заголовки (Content Security Policy)
- [ ] SQL injection защита (parameterized queries для sqlite)
- [ ] XSS защита в EJS шаблонах

### 🟡 Важные (P1) - Улучшение качества

- [ ] TypeScript миграция (начать с utils/validator.js)
- [ ] E2E тесты (Playwright)
- [ ] Performance тесты (k6)
- [ ] Security аудит (npm audit, Snyk)
- [ ] Test coverage > 90% (сейчас неизвестно)

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

1. **Input валидация** - utils/validator.js уже есть, нужно интегрировать во все API endpoints
2. **CSP заголовки** - настроить helmet.contentSecurityPolicy
3. **Test coverage** - добавить istanbul для отчётов

### Следующие шаги

1. Интегрировать validator во все POST/PUT endpoints
2. Настроить CSP с report-only режимом
3. Добавить coverage отчёты в CI/CD

---

## 📌 Правила проекта

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge

---

**Последний коммит:** e84165f - feat(2.8.0): Фаза 1 - Стабильность и DX улучшения  
**Ветка:** dev  
**Следующий релиз:** 2.8.0 (после завершения Фазы 2)
