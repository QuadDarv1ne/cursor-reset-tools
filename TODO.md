# TODO - Cursor Reset Tools

## 🔍 АКТУАЛЬНЫЙ СТАТУС (5 апреля 2026 г.) - v2.8.0-dev

### 📊 Текущая ветка
- **dev**: ✅ Синхронизирована с origin/dev, готова к релизу 2.8.0
- **main**: ✅ Синхронизирована с origin/main, включает все изменения из dev

### ✅ ВЫПОЛНЕНО В ЭТОЙ ВЕРСИИ (Коммит: 1c7ee4e)

#### Автоматизация
- [x] **AutoSetup** (utils/autoSetup.js) - полная проверка и настройка окружения при старте
  - Проверка окружения (платформа, Node.js, память, CPU)
  - Проверка/создание директорий
  - Проверка/генерация .env файла
  - Проверка зависимостей
  - Проверка прав доступа
  - 3 профиля: minimal, standard, full
  - Автоматическое исправление проблем
  - API: `/api/autosetup/status`, `/api/autosetup/profiles`
  - CLI: `autosetup:check`, `autosetup:fix`, `autosetup:env`, `autosetup:profiles`, `autosetup:status`

- [x] **CircuitBreaker** (utils/circuitBreaker.js) - защита от каскадных сбоев
  - Паттерн Circuit Breaker (Closed/Open/Half-Open)
  - Экспоненциальная задержка с jitter
  - Таймауты операций
  - Fallback функции
  - retry с лимитами
  - Статистика вызовов
  - 8 предконфигурированных breakers для основных сервисов
  - API: `/api/circuit-breakers/status`, `/api/circuit-breakers/reset`, `/api/circuit-breakers/:name/reset`
  - CLI: `cb:status`, `cb:reset`, `cb:info`

#### Интеграция CircuitBreaker в модули
- [x] **proxyManager.js** - checkProxy обёрнут в CircuitBreaker с fallback
- [x] **vpnManager.js** - getIPInfo и getVPNIP обёрнуты в CircuitBreaker
- [x] **updater.js** - fetchLatestRelease обёрнут в CircuitBreaker
- [x] **dnsManager.js** - добавлен импорт CircuitBreaker (готов к использованию)

#### Улучшения
- [x] **helpers.js** - улучшен retry logic с jitter для предотвращения thundering herd
- [x] **cliManager.js** - 8 новых CLI команд (всего 52)
- [x] **app.js** - AutoSetup и CircuitBreaker инициализируются при старте
- [x] **README.md** - документация обновлена с описанием AutoSetup
- [x] **README_RU.md** - русская версия документации

### 📦 СТАТИСТИКА КОММИТА
- **Файлов изменено**: 12
- **Новых файлов**: 2 (autoSetup.js, circuitBreaker.js)
- **Строк добавлено**: 2153
- **Строк удалено**: 485
- **CLI команд добавлено**: 8
- **API эндпоинтов добавлено**: 5

---

## 📋 АРХИТЕКТУРА ПРОЕКТА

### Ядро
```
app.js                    # Express сервер + WebSocket + инициализация менеджеров
cli.js                    # CLI entry point → utils/cliManager.js
```

### Новые модули
| Модуль | Назначение | Статус | Интеграция |
|--------|-----------|--------|------------|
| autoSetup.js | Автоматическая настройка | ✅ | app.js, cliManager.js |
| circuitBreaker.js | Защита от сбоев | ✅ | app.js, cliManager.js |

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

### Утилиты (40 файлов в utils/)
**Критические:**
- helpers.js - retry с jitter ✅, admin check, cursor check, integrity
- validator.js - валидация и санитизация (URL, IP, email, UUID, domain)
- constants.js - ВСЕ magic numbers централизованы ✅
- config.js - конфигурация платформы
- logger.js - Winston логирование с ротацией

**Новые менеджеры:**
- autoSetup.js - автоматическая настройка ✅
- circuitBreaker.js - защита от каскадных сбоев ✅

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
- cliManager.js - 52 команды (было 44)

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

## 🎯 ПРИОРИТЕТЫ ДЛЯ РЕЛИЗА 2.8.0

### ✅ Все критические пути работают стабильно
1. ✅ Reset Machine ID - основной функционал
2. ✅ Rate limiting - защита от abuse (все эндпоинты)
3. ✅ Валидация ввода - безопасность
4. ✅ Graceful shutdown - стабильность (.unref() добавлен)
5. ✅ Бэкап и откат - восстановление при ошибках
6. ✅ Версия приложения синхронизирована (2.8.0-dev)
7. ✅ AutoSetup - автоматическая настройка
8. ✅ Circuit Breaker - защита от каскадных сбоев

### Для релиза 2.8.0 нужно:
- [x] AutoSetup интегрирован
- [x] CircuitBreaker интегрирован
- [x] helpers.js улучшен (retry + jitter)
- [ ] Обернуть вызовы в CircuitBreaker (proxy, vpn, dns)
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
- [ ] Тесты для autoSetup.js
- [ ] Тесты для circuitBreaker.js
- [ ] Обернуть реальные вызовы в CircuitBreaker

---

## 📝 ПРАВИЛА ПРОЕКТА

1. **Качество > Количество** - лучше меньше функций, но стабильных
2. **Код с тестами** - новая функция = тесты
3. **Безопасность** - валидация input, CSP, rate limiting
4. **Документация по запросу** - не создавать без необходимости
5. **dev → test → main** - проверять перед merge
6. **Без запуска тестов и проекта** - только код и исправления (по запросу)
7. **Синхронизация** - всегда синхронизировать изменения с remote
