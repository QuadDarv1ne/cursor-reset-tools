# TODO - Cursor Reset Tools

## 🔍 Аудит проекта (4 апреля 2026 г.) - АКТУАЛЬНЫЙ v8

### ✅ Статус синхронизации
- **dev**: 189d3a0 (HEAD) - fix: синтаксическая ошибка fingerprintManager
- **main**: 189d3a0 - синхронизирована с dev ✅
- Готово к релизу 2.8.0

### 📊 Статус веток
```
* dev (активная, QuadDarv1ne/cursor-reset-tools)
  dev-full-i18n (дополнительная)
  main (стабильная, синхронизирована)
```

---

## ✅ ИСПРАВЛЕНО в этом раунде аудита (v8)

### Синтаксическая ошибка
- [x] **fingerprintManager.js**: Исправлена синтаксическая ошибка в `changeHostnameWindows()` - лишние фигурные скобки в catch блоке

### Предыдущие исправления (v7)
- [x] **wireguardManager.js**: Генерация ключей (SHA256 → randomBytes + warning)

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

### Критические пути (должны работать стабильно)
1. ✅ Reset Machine ID - основной функционал
2. ✅ Rate limiting - защита от abuse (все эндпоинты)
3. ✅ Валидация ввода - безопасность
4. ✅ Graceful shutdown - стабильность (.unref() добавлен)
5. ✅ Бэкап и откат - восстановление при ошибках
6. ✅ Версия приложения синхронизирована

### Для релиза 2.8.0 нужно:
- [x] Все P0 исправлены
- [x] Все P1 исправлены
- [ ] Финальное тестирование
- [ ] Обновить CHANGELOG.md
- [ ] Merge dev → main (уже синхронизировано)
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
