# 🛡️ Cursor Reset Tools

[![Version](https://img.shields.io/github/package-json/v/QuadDarv1ne/cursor-reset-tools?style=flat-square)](https://github.com/QuadDarv1ne/cursor-reset-tools/releases)
[![Tests](https://img.shields.io/github/actions/workflow/status/QuadDarv1ne/cursor-reset-tools/ci.yml?branch=main&label=tests&style=flat-square)](https://github.com/QuadDarv1ne/cursor-reset-tools/actions)
[![Coverage](https://img.shields.io/badge/coverage-70%25-brightgreen?style=flat-square)](coverage/)
[![License](https://img.shields.io/github/license/QuadDarv1ne/cursor-reset-tools?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/docker/pulls/quaddarv1ne/cursor-reset-tools?style=flat-square)](https://hub.docker.com/r/quaddarv1ne/cursor-reset-tools)

> *"О, они заблокировали вашу страну для использования Cursor Student? Как мило. Позвольте познакомить вас с чем-то лучшим."*

**[🇬🇧 English version](README.md)** | **[📝 Changelog](CHANGELOG.md)** | **[🤝 Contributing](CONTRIBUTING.md)**

## Предварительный просмотр Website 1

![Sazumi Cloud Cursor Reset Tool Preview1](./src/preview.png)

## Предварительный просмотр Website 2

![Sazumi Cloud Cursor Reset Tool Preview2](./src/preview-3.png)

## Предварительный просмотр Pro функции

![Sazumi Cloud Cursor Reset Tool Preview4](./src/preview-2.png)

Забудьте об ограничениях Cursor Student и запретах стран! Этот революционный веб-инструмент насмехается над произвольными ограничениями Cursor IDE, возвращая власть разработчикам из каждого уголка мира. Кому нужна их "студенческая программа", когда можно сбрасывать Machine ID, обходить эти неприятные лимиты токенов и превращать бесплатные пробные версии в Pro функции несколькими кликами? Мы создали систему, которая не только обходит ограничения Machine ID, но и предотвращает те самые автоматические обновления, предназначенные для блокировки нашей свободы. Потому что отличные AI инструменты должны быть доступны каждому, а не только тем, кто находится в "одобренных" регионах Cursor. Освободите свой опыт кодирования уже сегодня!

## Расширенные функции обхода

- **Обход лимита токенов**: Удаление ограничений на использование токенов для AI completions
- **Pro Trial конвертация**: Доступ к Pro функциям без покупки подписки
- **Сброс Machine ID**: Обход ограничения "Слишком много пробных аккаунтов использовано на этом устройстве"
- **Предотвращение автообновлений**: Остановка автоматических обновлений Cursor, которые могут удалить функциональность обхода
- **🛡️ VPN поддержка**: Автоматическое определение VPN (Amnezia, WireGuard, NordVPN, и др.)
- **🌐 Управление DNS**: Смена DNS серверов (Cloudflare, Google, Quad9) для обхода блокировок
- **🔀 Проксирование**: Поддержка SOCKS5 и HTTP прокси с ротацией
- **🔒 DoH (DNS over HTTPS)**: Шифрование DNS запросов для дополнительной защиты
- **🚫 Kill Switch**: Блокировка трафика при отключении VPN
- **🔍 Проверка утечек**: DNS, WebRTC, IPv6 утечки - обнаружение и исправление
- **🤖 Умный обход**: Автоматический выбор лучшего метода на основе тестов
- **Кроссплатформенность**: Совместимость с Windows, macOS и Linux
- **Удобный интерфейс**: Чистый, современный UI с понятными инструкциями
- **Информация о системе**: Отображает подробную информацию о системе и установке Cursor

## Установка

### Быстрый старт

```bash
# Клонирование репозитория
git clone https://github.com/QuadDarv1ne/cursor-reset-tools.git
cd cursor-reset-tools

# Установка зависимостей
npm install

# Автоматическая настройка (рекомендуется)
npm start
```

Приложение автоматически настроится при первом запуске:
- ✓ Создаст нужные директории
- ✓ Сгенерирует `.env` файл с настройками по умолчанию
- ✓ Проверит окружение и зависимости

### Ручная настройка (опционально)

```bash
# Проверить окружение
node cli.js autosetup:check

# Применить исправления и создать .env
node cli.js autosetup:fix

# Выбрать профиль (minimal/standard/full)
node cli.js autosetup:fix --profile full
```

### Профили автонастройки

| Профиль | Описание | Для кого |
|---------|----------|----------|
| `minimal` | Только основные функции | Быстрый старт, мало ресурсов |
| `standard` | Баланс (по умолчанию) | Большинство пользователей |
| `full` | Все функции включены | Продвинутые пользователи |

### CLI команды для автонастройки

```bash
# Проверить статус окружения
node cli.js autosetup:check

# Применить автоматические исправления
node cli.js autosetup:fix

# Сгенерировать .env файл
node cli.js autosetup:env

# Посмотреть доступные профили
node cli.js autosetup:profiles

# Проверить текущий статус
node cli.js autosetup:status
```

### С помощью Make

```bash
# Установка зависимостей
make install

# Запуск в режиме разработки
make dev

# Запуск тестов
make test

# Сборка Docker образа
make docker-build
```

### Docker

```bash
# Запуск с Docker Compose
docker-compose up --build

# Или вручную
docker build -t cursor-reset-tools .
docker run -p 3000:3000 -v $(pwd)/data:/app/data cursor-reset-tools
```

## Стабильность и надёжность

Приложение включает **Circuit Breakers** и **умную retry логику** для максимальной стабильности:

- **Автоматическое восстановление** - Ошибочные операции повторяются с экспоненциальной задержкой + jitter
- **Защита от каскадных сбоев** - Circuit breakers предотвращают лавинообразные ошибки
- **Мониторинг в реальном времени** - Отслеживание здоровья всех подсистем

### Команды Circuit Breakers

```bash
# Проверить статус всех circuit breakers
node cli.js cb:status

# Показать только разомкнутые цепи
node cli.js cb:status --open

# Сбросить все circuit breakers
node cli.js cb:reset --all

# Сбросить конкретный breaker
node cli.js cb:reset --name proxy:check

# Подробная информация о breaker
node cli.js cb:info api:ip-check
```

## Быстрая проверка VPN и DNS

Для быстрой проверки всех систем:

```bash
npm run quick
```

Этот скрипт проверит:
- ✓ VPN подключение
- ✓ DNS серверы
- ✓ Утечки (DNS, WebRTC, IPv6)
- ✓ Методы обхода
- ✓ Даст рекомендации

## Запуск с правами администратора

Этот инструмент требует привилегии администратора для модификации системных файлов.

### Windows
```bash
# Запустите CMD как администратор
cd путь\к\cursor-reset-tools
npm start
```

### macOS/Linux
```bash
cd путь/к/cursor-reset-tools
sudo npm start
```

## Как это работает

Cursor идентифицирует ваше устройство с помощью уникального ID, хранящегося в определённых местах:

- **Windows**: `%APPDATA%\Cursor\machineId`
- **macOS**: `~/Library/Application Support/Cursor/machineId`
- **Linux**: `~/.config/cursor/machineid`

Этот инструмент:
1. Определяет, запущен ли Cursor (и предупреждает вас закрыть его)
2. Генерирует новый UUID для замены существующего Machine ID
3. Очищает кэшированные файлы, хранящие данные об использовании
4. Предотвращает автоматические обновления, которые могут удалить функциональность обхода
5. Модифицирует системные файлы для разблокировки Pro функций и обхода лимитов токенов
6. Позволяет Cursor считать ваше устройство новым устройством

## 💡 Рекомендуемые советы

Для лучших результатов при создании новых аккаунтов Cursor:

- **Смените IP при необходимости**: Если вы столкнулись с ошибками "too many requests", переключите мобильные данные для получения нового IP адреса
- **Используйте одноразовые email сервисы**: Вы можете использовать [Sazumi Cloud - Email Disposable](https://mail.sazumi.com), который хорошо работает с Cursor
- **Сначала сбросьте Machine ID**: Всегда сбрасывайте Machine ID перед созданием нового аккаунта Cursor
- **Используйте приватный просмотр**: Регистрируйтесь в приватных/incognito окнах браузера
- **Очищайте cookies**: Очищайте cookies браузера после регистрации для лучшей безопасности

## Используемые технологии

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, JavaScript
- **Шаблонизатор**: EJS
- **Утилиты**: uuid, fs-extra, node-fetch, sqlite, sqlite3

## ⚠️ Отказ от ответственности

Этот инструмент предоставлен только для образовательных и исследовательских целей. Используйте на свой страх и риск. Разработчики Sazumi Cloud не несут ответственности за любые последствия, возникшие в результате использования этого инструмента.

**Пожалуйста, рассмотрите возможность поддержки разработки Cursor, приобретя легальную лицензию, если вы находите их продукт ценным для вашего рабочего процесса.**

## Лицензия

Этот проект лицензирован под MIT Лицензией — смотрите файл LICENSE для деталей.

## 🤝 Вклад

Вклады приветствуются! Пожалуйста, не стесняйтесь отправлять Pull Request.

1. Форкните репозиторий
2. Создайте вашу ветку функции (`git checkout -b feature/cursor-fix`)
3. Закоммитьте ваши изменения (`git commit -m 'Add cursor bypass fix'`)
4. Отправьте в ветку (`git push origin feature/cursor-fix`)
5. Откройте Pull Request

## 🔗 Ссылки

- [GitHub репозиторий](https://github.com/QuadDarv1ne/cursor-reset-tools)
- [Трекер проблем](https://github.com/QuadDarv1ne/cursor-reset-tools/issues)
- [Поддержать проект](https://sociabuzz.com/maestro7it/tribe)

---

Сделано с ❤️ от Sazumi Cloud
