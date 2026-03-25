# RELEASE NOTES - Cursor Reset Tools v2.5.0

**Дата релиза:** 25 марта 2026  
**Автор:** Dupley Maxim Igorevich  
**Статус:** ✅ Стабильный релиз

---

## 🎯 Ключевые изменения

### Dashboard страница
- **Новая страница** `/dashboard` с полной статистикой всех менеджеров
- **Система Overview:** Uptime, Память, Клиенты, Cache Hit Rate
- **Ресурсы системы:** CPU, RAM, Disk с прогресс-барами в реальном времени
- **Кэш статистика:** Hits, Misses, Size, Expirations
- **Мониторинг сервисов:** Cursor API, DNS, GitHub
- **Логи в реальном времени** через WebSocket
- **Авто-обновление** каждые 5 секунд

### Мониторинг ресурсов
- **ResourceMonitor** - новый менеджер для мониторинга CPU, RAM, Disk
- **Алерты** при превышении порогов (CPU >80%, RAM >85%, Disk >90%)
- **История замеров** с ограничением (100 записей)
- **API endpoints:** `/api/resources/status`, `/api/resources/summary`, `/api/resources/history`

### Уведомления
- **NotificationManager** - поддержка Telegram и Discord
- **Настройка в Web UI** (страница /bypass)
- **События:** start, stop, alert, cursorReset
- **API endpoints:** `/api/notifications/*`

### Авто-ротация прокси
- **ProxyManager** - расширен функциями авто-ротации
- **Настраиваемый интервал** (по умолчанию 5 минут)
- **Принудительная ротация** по кнопке
- **История ротаций** (последние 50)
- **API endpoints:** `/api/proxy/rotation/*`

### Кэширование
- **StatsCache** - кэширование с TTL
- **Интеграция в 7 API endpoints** для производительности
- **LRU eviction** при превышении лимита
- **Статистика:** hits, misses, hit rate

### Экспорт статистики
- **JSON export** - полная статистика всех менеджеров
- **CSV export** - плоский формат для таблиц
- **Автоматическое скачивание** файлов

### Навигация
- **Кнопка Dashboard** на главной странице
- **Навигация между страницами** (Главная, Bypass Tools, Dashboard)

---

## 🧪 Тесты

**Всего тестов:** 151  
**Пройдено:** 151 (100%)  
**Упало:** 0

### Новые тесты:
- `test/resourceMonitor.test.js` - 28 тестов
- `test/statsCache.test.js` - 30 тестов
- `test/notificationManager.test.js` - 24 теста

### Покрытие:
- Unit тесты для всех новых менеджеров
- Integration тесты для API endpoints
- Existing тесты: validator (40), helpers (6), API (15)

---

## 📦 Технические изменения

### Новые файлы:
- `utils/resourceMonitor.js` - мониторинг ресурсов
- `utils/statsCache.js` - кэширование статистики
- `utils/notificationManager.js` - уведомления
- `views/dashboard.ejs` - Dashboard страница
- `test/resourceMonitor.test.js`
- `test/statsCache.test.js`
- `test/notificationManager.test.js`

### Изменённые файлы:
- `app.js` - интеграция менеджеров, API endpoints, кэширование
- `views/index.ejs` - кнопка Dashboard
- `views/bypass.ejs` - UI для уведомлений и авто-ротации
- `public/js/main.js` - updateResourceMonitor()
- `public/css/style.css` - стили для resource monitor
- `utils/proxyManager.js` - авто-ротация

### API Endpoints (новые):
```
GET  /api/resources/status
GET  /api/resources/summary
GET  /api/resources/history
GET  /api/resources/alerts
POST /api/resources/alerts/clear

GET  /api/cache/status
GET  /api/cache/stats
POST /api/cache/clear
POST /api/cache/reset-stats

GET  /api/notifications/status
POST /api/notifications/configure/telegram
POST /api/notifications/configure/discord
POST /api/notifications/enable
POST /api/notifications/disable
POST /api/notifications/test
GET  /api/notifications/export

GET  /api/proxy/rotation/status
POST /api/proxy/rotation/start
POST /api/proxy/rotation/stop
POST /api/proxy/rotate

GET  /api/monitor/status
```

---

## 🌐 Локализация

**Поддерживаемые языки:**
- 🇷🇺 Русский (RU)
- 🇬🇧 English (EN)
- 🇨🇳 中文 (ZH)

---

## 📊 Статистика проекта

| Метрика | Значение |
|---------|----------|
| Версия | 2.5.0 |
| Тесты | 151/151 (100%) |
| ESLint | 0 ошибок |
| Страниц | 3 |
| Менеджеров | 8 |
| API endpoints | 30+ |
| Платформы | Windows, macOS, Linux, FreeBSD |

---

## 🚀 Миграция с v2.4.0

**Обратная совместимость:** ✅ Полная

**Шаги обновления:**
```bash
git pull origin main
npm install
npm start
```

**Конфигурация:** Не требуется, все настройки сохраняются.

---

## 🐛 Исправления

- Исправлены 5 failing тестов NotificationManager
- Исправлена логика `sendEvent()` (проверка по ключу `sendOn{Event}`)
- Улучшена обработка асинхронной очереди уведомлений

---

## 📝 Заметки

- **data/metrics.json** - не tracked (опционально для gitignore)
- **data/resource-stats.json** - не tracked (runtime данные)
- **dev:** ahead на 13 коммитов от origin/dev
- **main:** синхронизирован с dev

---

## 👥 Авторы

- **Dupley Maxim Igorevich** - владелец проекта
- Все контрибьюторы проекта

---

## 📄 Лицензия

© 2026 Все права защищены

---

## 🔗 Ссылки

- [GitHub Repository](https://github.com/QuadDarv1ne/cursor-reset-tools)
- [README.md](README.md)
- [TODO.md](TODO.md)
- [READY_TO_USE.md](READY_TO_USE.md)
