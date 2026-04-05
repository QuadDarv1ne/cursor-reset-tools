# TODO - Cursor Reset Tools

## 🔍 АКТУАЛЬНЫЙ СТАТУС (5 апреля 2026 г.) - v2.8.0-dev

### 📊 Текущая ветка
- **dev**: активная, несохранённые изменения готовы к коммиту ✅
- **main**: стабильная, требует обновления после dev

### 📦 НОВЫЕ МОДУЛИ (готовы к интеграции)

#### 1. utils/autoSetup.js - Автоматическая настройка
- **Статус**: ✅ Реализован, интегрирован в app.js и cliManager.js
- **Функционал**:
  - Проверка окружения (платформа, Node.js версия, память, CPU)
  - Проверка/создание директорий
  - Проверка/генерация .env файла
  - Проверка зависимостей
  - Проверка прав доступа
  - 3 профиля: minimal, standard, full
  - Автоматическое исправление проблем
- **API эндпоинты**: `/api/autosetup/status`, `/api/autosetup/profiles`
- **CLI команды**: `autosetup:check`, `autosetup:fix`, `autosetup:env`, `autosetup:profiles`, `autosetup:status`
- **Интеграция**: Вызывается ПЕРВЫМ при запуске сервера в app.js

#### 2. utils/circuitBreaker.js - Защита от каскадных сбоев
- **Статус**: ✅ Реализован, интегрирован в app.js и cliManager.js
- **Функционал**:
  - Паттерн Circuit Breaker (Closed/Open/Half-Open)
  - Экспоненциальная задержка с jitter
  - Таймауты операций
  - Fallback функции
  -retry с лимитами
  - Статистика вызовов
  - 8 предконфигурированных breakers для основных сервисов
- **API эндпоинты**: `/api/circuit-breakers/status`, `/api/circuit-breakers/reset`, `/api/circuit-breakers/:name/reset`
- **CLI команды**: `cb:status`, `cb:reset`, `cb:info`
- **Интеграция**: Инициализируется при запуске сервера

#### 3. utils/helpers.js - Улучшенный retry logic
- **Статус**: ✅ Улучшен
- **Изменения**:
  - Добавлен jitter для предотвращения thundering herd
  - Улучшенное логирование с именем операции
  - Более гибкая конфигурация задержек

---

## ✅ ЧТО СДЕЛАНО В ЭТОЙ ВЕРСИИ

### Автоматизация
- [x] **AutoSetup** - полная проверка и настройка окружения при старте
- [x] **Генерация .env** - автоматическое создание конфигурации
- [x] **Профили настройки** - minimal/standard/full для разных сценариев
- [x] **CLI команды** - 5 новых команд для autosetup
- [x] **API эндпоинты** - 2 новых эндпоинта для статуса

### Стабильность
- [x] **Circuit Breaker** - защита от каскадных сбоев для 8 сервисов
- [x] **Exponential backoff + jitter** - улучшенный retry logic в helpers.js
- [x] **CLI команды** - 3 новых команды для circuit breakers
- [x] **API эндпоинты** - 3 новых эндпоинта для управления

### Интеграция
- [x] **app.js** - AutoSetup и CircuitBreaker инициализируются при старте
- [x] **cliManager.js** - 8 новых CLI команд добавлены
- [x] **README.md** - документация обновлена с описанием AutoSetup

---

## ⚠️ ТРЕБУЕТ ПРОВЕРКИ И ИСПРАВЛЕНИЙ

### P1 - Важные проблемы

#### 1. Circuit Breaker не используется в реальных операциях
- **Проблема**: CircuitBreaker инициализирован, но не обёрнуты реальные вызовы
- **Что нужно**: Обернуть вызовы в proxyManager, vpnManager, dnsManager, updater
- **Приоритет**: Средний - функционал есть, но не используется

#### 2. AutoSetup дублирует инициализацию
- **Проблема**: AutoSetup проверяет директории, но менеджеры тоже могут их создавать
- **Что нужно**: Убедиться что нет дублирования логики создания директорий

#### 3. Отсутствует валидация входных данных в API
- **Проблема**: API endpoints для circuit-breakers не валидируют входные параметры
- **Риск**: Возможность некорректных данных

### P2 - Улучшения

#### 1. README.md неполный
- Нужно добавить документацию по Circuit Breaker API

#### 2. Тесты отсутствуют для новых модулей
- autoSetup.js - нет тестов
- circuitBreaker.js - нет тестов

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
