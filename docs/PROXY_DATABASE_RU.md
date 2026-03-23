# 📦 Proxy Database - Документация

База данных прокси с авто-обновлением и встроенными списками.

## 🚀 Возможности

- **Встроенные прокси**: 13 предустановленных прокси
- **Загрузка из API**: Автоматическая загрузка с 4+ источников
- **Сохранение**: Данные сохраняются в `data/proxies.json`
- **Фильтрация**: По стране, протоколу, статусу
- **Авто-обновление**: Периодическое обновление списка
- **Проверка**: Тестирование работоспособности прокси

---

## 📋 CLI Команды

### Инициализация базы
```bash
npm run cli -- proxy-db:init
```
Загружает встроенные прокси + скачивает из API.

### Список прокси
```bash
# Все прокси (первые 50)
npm run cli -- proxy-db:list

# Только SOCKS5
npm run cli -- proxy-db:list --protocol socks5

# Только США
npm run cli -- proxy-db:list --country US

# Только рабочие
npm run cli -- proxy-db:list --working
```

### Статистика
```bash
npm run cli -- proxy-db:stats
```
Показывает:
- Всего прокси
- Рабочих/нерабочих
- Распределение по протоколам
- Распределение по странам

### Обновление базы
```bash
npm run cli -- proxy-db:refresh
```
Загружает новые прокси из API.

### Проверка всех прокси
```bash
# Проверка с 5 параллельными потоками
npm run cli -- proxy-db:check --concurrency 5
```

### Случайный рабочий прокси
```bash
# Любой протокол
npm run cli -- proxy-db:random

# Только SOCKS5
npm run cli -- proxy-db:random --protocol socks5
```

### Список стран
```bash
npm run cli -- proxy-db:countries
```

### Авто-обновление
```bash
# Включить (5 минут по умолчанию)
npm run cli -- proxy-db:auto --enable

# Включить (интервал 10 минут)
npm run cli -- proxy-db:auto --enable --interval 600000

# Выключить
npm run cli -- proxy-db:auto --disable
```

---

## 🔗 API Endpoints

### Получить информацию
```bash
GET /api/proxy-db/info
```

Ответ:
```json
{
  "success": true,
  "info": {
    "total": 2256,
    "working": 1500,
    "failed": 100,
    "countries": ["US", "DE", "NL", ...],
    "protocols": ["socks5", "http"],
    "lastUpdate": 1234567890,
    "autoUpdateEnabled": true
  }
}
```

### Получить список прокси
```bash
GET /api/proxy-db/list?protocol=socks5&country=US&workingOnly=true&limit=50
```

Параметры:
- `protocol` - socks5, http
- `country` - код страны (US, DE, NL)
- `workingOnly` - true/false
- `limit` - максимум записей

### Статистика
```bash
GET /api/proxy-db/stats
```

### Список стран
```bash
GET /api/proxy-db/countries
```

### Обновить базу
```bash
POST /api/proxy-db/refresh
```

### Проверить все прокси
```bash
POST /api/proxy-db/check
{
  "concurrency": 5
}
```

### Включить авто-обновление
```bash
POST /api/proxy-db/auto-update
{
  "enable": true,
  "interval": 300000
}
```

### Получить случайный рабочий прокси
```bash
GET /api/proxy-db/random?protocol=socks5
```

### Импорт из файла
```bash
POST /api/proxy-db/import
{
  "filePath": "/path/to/proxies.txt",
  "defaultProtocol": "socks5"
}
```

### Экспорт в файл
```bash
POST /api/proxy-db/export
{
  "filePath": "/path/to/output.txt"
}
```

### Очистка нерабочих
```bash
DELETE /api/proxy-db/cleanup
{
  "maxFailures": 3
}
```

---

## 💻 Программное использование

### Инициализация
```javascript
import { globalProxyDatabase } from './utils/proxyDatabase.js';

// Инициализация (загрузка встроенных + API)
await globalProxyDatabase.init();
```

### Получение прокси
```javascript
// Все прокси
const all = globalProxyDatabase.getProxies();

// Только SOCKS5 из США
const us = globalProxyDatabase.getProxies({
  protocol: 'socks5',
  country: 'US',
  limit: 10
});

// Только рабочие
const working = globalProxyDatabase.getProxies({
  workingOnly: true
});
```

### Случайный рабочий
```javascript
// Любой
const random = globalProxyDatabase.getRandomWorking();

// Только HTTP
const http = globalProxyDatabase.getRandomWorking('http');

// Лучший из Германии
const de = globalProxyDatabase.getBestByCountry('DE', 'socks5');
```

### Проверка прокси
```javascript
// Обновить статус
globalProxyDatabase.updateProxyStatus(
  '192.168.1.1:1080',
  true,  // working
  150    // response time ms
);
```

### Авто-обновление
```javascript
// Включить (каждые 5 минут)
globalProxyDatabase.enableAutoUpdate(300000);

// Выключить
globalProxyDatabase.disableAutoUpdate();
```

### Статистика
```javascript
const stats = globalProxyDatabase.getStats();
console.log(stats);
// {
//   total: 2256,
//   working: 1500,
//   failed: 100,
//   byCountry: { US: 500, DE: 300, ... },
//   byProtocol: { socks5: 2000, http: 256 }
// }
```

---

## 📁 Формат файла данных

`data/proxies.json`:
```json
{
  "proxies": [
    {
      "url": "192.168.1.1:1080",
      "protocol": "socks5",
      "country": "US",
      "speed": "fast",
      "added": 1234567890,
      "lastChecked": 1234567890,
      "working": true,
      "responseTime": 150,
      "failures": 0
    }
  ],
  "lastUpdate": 1234567890,
  "version": 1
}
```

---

## 🔄 Источники прокси

Встроенные API для загрузки:

| Источник | Тип | Протокол |
|----------|-----|----------|
| ProxyList | text | socks5 |
| OpenProxyList | text | socks5 |
| ProxyHTTP | text | http |
| Geonode API | json | socks5 |

---

## ⚙️ Настройки

### Переменные окружения
```bash
# Интервал авто-обновления (мс)
PROXY_DB_UPDATE_INTERVAL=300000

# Максимум прокси в базе
PROXY_DB_MAX_PROXIES=5000

# Параллелизм проверки
PROXY_DB_CHECK_CONCURRENCY=5
```

---

## 🛠️ Обслуживание

### Очистка нерабочих
```javascript
// Удалить прокси с 3+ неудачами
const removed = globalProxyDatabase.cleanupFailed(3);
console.log(`Removed ${removed} proxies`);
```

### Экспорт резервной копии
```javascript
await globalProxyDatabase.exportToFile('backup-proxies.json');
```

### Импорт из резервной копии
```javascript
const count = await globalProxyDatabase.importFromFile(
  'backup-proxies.json',
  'socks5'
);
console.log(`Imported ${count} proxies`);
```

---

## 📊 Рекомендации

1. **Инициализация при запуске**: Вызывайте `init()` при старте приложения
2. **Периодическое обновление**: Включите авто-обновление каждые 5-10 минут
3. **Проверка работоспособности**: Проверяйте прокси раз в 30 минут
4. **Очистка**: Удаляйте нерабочие прокси после 3-5 неудач
5. **Бэкап**: Сохраняйте рабочие прокси в отдельный файл

---

## 📞 Пример полного использования

```javascript
import { globalProxyDatabase } from './utils/proxyDatabase.js';
import { globalProxyManager } from './utils/proxyManager.js';

// Инициализация
await globalProxyDatabase.init();

// Включение авто-обновления
globalProxyDatabase.enableAutoUpdate(300000);

// Получение рабочего прокси
const proxy = globalProxyDatabase.getRandomWorking('socks5');
if (proxy) {
  // Установка в proxy manager
  globalProxyManager.addProxy(proxy.url, proxy.protocol);
  console.log(`Using proxy: ${proxy.url}`);
}

// Проверка всех прокси раз в 30 минут
setInterval(async () => {
  await globalProxyDatabase.checkAllProxies(5);
}, 1800000);
```

---

**Версия**: 1.0  
**Автор**: Sazumi Cloud  
**Лицензия**: MIT
