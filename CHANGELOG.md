# Changelog

Все значимые изменения в этом проекте будут задокументированы в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.0.0/),
и проект придерживается [Semantic Versioning](https://semver.org/lang/ru/).

## [Неопубликовано]

### Добавлено
- `.env` поддержка для конфигурации через переменные окружения
- Улучшенное логирование с использованием Winston с ротацией файлов
- Глобальные обработчики ошибок (uncaughtException, unhandledRejection)
- Улучшенный Graceful Shutdown для всех менеджеров
- Docker Compose для быстрой разработки
- Makefile и make.bat для удобных команд
- Pre-commit hooks через Husky и Lint-staged
- `.env.example` с полной документацией
- `.dockerignore` для оптимизации Docker образов
- Multi-stage Dockerfile для production

### Изменено
- Обновлен `utils/logger.js` для использования Winston
- Обновлен `app.js` с улучшенной обработкой ошибок
- Обновлен `package.json` с новыми скриптами
- Обновлен `.gitignore` для игнорирования логов и `.env`

### Исправлено
- Утечки памяти при graceful shutdown
- Race conditions при остановке менеджеров

---

## [2.7.0] - 2026-03-25

### Добавлено
- Auto Rollback Manager - автоматический откат операций при ошибках
- File Validator - комплексная валидация файлов
- DPI Bypass модуль для обхода Deep Packet Inspection
- WireGuard Manager для управления VPN подключениями
- Улучшенный Proxy Manager с WireGuard поддержкой
- Улучшенный Leak Detector с авто-исправлением
- Smart Bypass Manager с ML предсказаниями
- 20+ новых API endpoints для VPN/DNS/Proxy функциональности

### Изменено
- Оптимизирована производительность (I/O в 10 раз меньше)
- Улучшена обработка ошибок с retry logic
- Улучшены менеджеры обхода

### Исправлено
- Критические утечки памяти (proxyManager, smartBypassManager, websocketServer)
- Race conditions (proxyManager rotateProxy, websocketServer broadcast)

### Тесты
- ✅ 199/199 тестов passed (9 test suites)

---

## [2.6.0] - 2026-03-20

### Добавлено
- VPN Leak Fix Manager
- VPN Traffic Manager с Kill Switch
- Bypass Tester для диагностики
- System Proxy Manager
- Amnezia VPN поддержка
- DoH-VPN Integration
- Скрипт quick-setup.js
- Бэкап конфигурации (7 API endpoints)
- CLI команды для backup

### Изменено
- Обновлена документация (VPN_BYPASS_GUIDE_RU.md)

---

## [2.5.0] - 2026-03-15

### Добавлено
- Мониторинг ресурсов (CPU, RAM, Disk)
- Кэширование статистики запросов
- Авто-ротация прокси
- Уведомления (Telegram/Discord)
- Web UI для мониторинга
- WebSocket клиент для реального времени

---

## [2.4.0] - 2026-03-10

### Добавлено
- Система локализации (i18n)
- Поддержка языков: RU, EN, ZH
- WebSocket сервер для логов
- Dashboard страница

---

## [2.3.0] - 2026-03-05

### Добавлено
- Smart Bypass Manager
- DNS Manager
- IP Manager
- Fingerprint Manager

---

## [2.2.0] - 2026-02-28

### Добавлено
- Proxy Manager
- Proxy Database
- Monitor Manager

---

## [2.1.0] - 2026-02-20

### Добавлено
- CLI режим для headless использования
- Автообновление приложения

---

## [2.0.0] - 2026-02-15

### Добавлено
- Web UI с EJS шаблонами
- Express сервер
- Rate limiting
- Helmet security headers

### Изменено
- Полная переработка архитектуры

---

## [1.0.0] - 2026-01-01

### Добавлено
- Базовый сброс Machine ID
- Поддержка Windows, macOS, Linux

---

## Формат

- **Добавлено** - для новых функций.
- **Изменено** - для изменений в существующей функциональности.
- **Устарело** - для скорого удаления функций.
- **Удалено** - для удалённых функций.
- **Исправлено** - для исправления ошибок.
- **Безопасность** - для уязвимостей.

---

**Автор:** Dupley Maxim Igorevich  
**Год:** 2026  
**Последнее обновление:** 26 марта 2026 г.
