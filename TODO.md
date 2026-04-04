# TODO - Cursor Reset Tools

## 🔍 Аудит проекта (4 апреля 2026 г.) - АКТУАЛЬНЫЙ v2

### ✅ Статус синхронизации
- **dev**: eefe0cc (HEAD) - SQLite Optimizer + P2 improvements
- **main**: eefe0cc - синхронизирована с dev ✅
- Готово к релизу 2.8.0

### 📊 Статус веток
```
* dev (активная, QuadDarv1ne/cursor-reset-tools)
  dev-full-i18n (дополнительная)
  main (стабильная, синхронизирована)
```

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
| bypass.js | Тестирование обхода | ❌ | ⚠️ P1 |
| proxy.js | Прокси + DoH + Leak Detector | ❌ | ⚠️ P1 (нет пагинации) |
| network.js | VPN, DNS, System Proxy, Traffic | ✅ 10/10min | ✅ |
| notifications.js | Telegram/Discord уведомления | ❌ | ⚠️ P2 |
| backup.js | Бэкап конфигурации | ❌ | ✅ (пагинация есть) |
| resources.js | Мониторинг ресурсов | ❌ | ✅ |
| metrics.js | Метрики | ❌ | ✅ |
| cache.js | Управление кэшем | ❌ | ✅ |
| updater.js | Обновления | ❌ | ✅ (GET→POST исправлено) |

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

## 🎯 ТЕКУЩИЕ ПРОБЛЕМЫ (После аудита)

### ✅ ИСПРАВЛЕНО в последних коммитах
- [x] updater.js: GET /download → POST (было P0) ✅
- [x] Rate limiting на reset (5/15min) и network (10/10min) ✅
- [x] Валидация DNS provider через whitelist ✅
- [x] Валидация в cliManager.js через validator ✅
- [x] Magic numbers вынесены в constants.js ✅
- [x] Пагинация в backup.js ✅
- [x] CONFIG в bypassServer.js использует переменные окружения ✅

### ⚠️ ОСТАВШИЕСЯ ПРОБЛЕМЫ

#### P1 - Важные

1. **Пагинация в proxy.js**
   - Файл: `routes/proxy.js`
   - Проблема: Некоторые списки прокси могут возвращать все элементы
   - Решение: Добавить offset/limit для списков прокси

2. **Отсутствие rate limiting на bypass.js**
   - Файл: `routes/bypass.js`
   - Проблема: Нет индивидуального rate limiter
   - Решение: Добавить limiter для тестирования обхода

3. **Отсутствие rate limiting на notifications.js**
   - Файл: `routes/notifications.js`
   - Проблема: Нет защиты от спама уведомлений
   - Решение: Добавить limiter (10/10min)

#### P2 - Улучшения

4. **Большие файлы**
   - `cliManager.js` (1527 строк) - разбить на модули команд
   - `reset.js` (1580 строк) - разбить на подмодули операций
   - `bypassServer.js` (415 строк) - приемлемо

5. **Централизация проверки процесса Cursor**
   - Уже есть `cursorProcess.js`, но некоторые файлы дублируют логику
   - Нужно проверить использование везде

6. **CSRF Protection**
   - Отсутствует csrf-csrf пакет
   - POST эндпоинты уязвимы без CSRF токенов
   - Требует добавления пакета и middleware

7. **JSDoc аннотации**
   - Большинство функций без полной документации
   - validator.js имеет хороший пример - распространить на другие модули

8. **TypeScript миграция**
   - Рассмотреть для критических модулей (validator, helpers)
   - Начать с добавления JSDoc типов

9. **Performance тесты**
   - Нет k6 или autocannon тестов
   - Нужны для проверки rate limiting и нагрузки

10. **WebSocket API документация**
    - Есть websocketServer.js, но нет документации API
    - Нужен список событий и форматов сообщений

---

## 📊 СТАТИСТИКА ПРОЕКТА

### Версия и статус
- **Версия:** 2.8.0-dev (package.json)
- **Последний коммит:** eefe0cc - feat: add SQLite optimizer and complete P2 improvements
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

### Критические пути (должны работать стабильно)
1. ✅ Reset Machine ID - основной функционал
2. ✅ Rate limiting - защита от abuse
3. ✅ Валидация ввода - безопасность
4. ✅ Graceful shutdown - стабильность
5. ✅ Бэкап и откат - восстановление при ошибках

### Для релиза 2.8.0 нужно:
- [x] Все P0 исправлены
- [ ] Исправить оставшиеся P1 (пагинация proxy, rate limiting bypass/notifications)
- [ ] Финальное тестирование
- [ ] Обновить CHANGELOG.md
- [ ] Merge dev → main
- [ ] Создать тег v2.8.0
- [ ] Опубликовать релиз на GitHub

### Для будущих версий (2.9.0+)
- [ ] CSRF protection
- [ ] WebSocket API документация
- [ ] JSDoc для основных модулей
- [ ] Performance тесты
- [ ] Рефакторинг больших файлов
- [ ] TypeScript миграция (опционально)

---

## 📝 ПРАВИЛА ПРОЕКТА

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge
6. **Без запуска тестов и проекта** - только код и исправления (по запросу)
7. **Синхронизация** - всегда синхронизировать изменения с remote
