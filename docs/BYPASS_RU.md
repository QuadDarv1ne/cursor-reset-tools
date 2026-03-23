# 🔓 Bypass Tools - Документация

Инструменты для обхода региональных ограничений Cursor.

## 📋 Содержание

1. [Прокси Менеджер](#прокси-менеджер)
2. [DNS Менеджер](#dns-менеджер)
3. [IP Менеджер](#ip-менеджер)
4. [Fingerprint Обход](#fingerprint-обход)
5. [Email Интеграция](#email-интеграция)
6. [Мониторинг](#мониторинг)
7. [CLI Режим](#cli-режим)
8. [API Reference](#api-reference)

---

## 🔵 Прокси Менеджер

### Возможности
- Поддержка SOCKS5 и HTTP прокси
- Автоматическая проверка работоспособности
- Ротация прокси
- Сохранение в файл

### Использование через Web UI
1. Откройте `/bypass`
2. В разделе Proxy Manager добавьте прокси в формате `host:port` или `user:pass@host:port`
3. Выберите протокол (SOCKS5/HTTP)
4. Нажмите "Проверить" для тестирования
5. Используйте "Ротация" для смены активного прокси

### Использование через CLI
```bash
# Добавить прокси
npm run cli -- proxy:add 192.168.1.1:1080 --protocol socks5

# Список прокси
npm run cli -- proxy:list

# Проверить все прокси
npm run cli -- proxy:check

# Ротация
npm run cli -- proxy:rotate

# Очистить
npm run cli -- proxy:clear
```

### Использование через API
```javascript
// Добавить прокси
POST /api/proxy/add
{
  "url": "192.168.1.1:1080",
  "protocol": "socks5"
}

// Получить список
GET /api/proxy/list

// Проверить все
POST /api/proxy/check

// Ротация
POST /api/proxy/rotate

// Очистить
DELETE /api/proxy/clear
```

### Загрузка из файла
```javascript
import { globalProxyManager } from './utils/proxyManager.js';

// Загрузка из файла (формат: protocol:host:port)
await globalProxyManager.loadFromFile('proxies.txt', 'socks5');

// Сохранение в файл
await globalProxyManager.saveToFile('proxies.txt');
```

---

## 🟢 DNS Менеджер

### Поддерживаемые DNS провайдеры
| Провайдер | Primary | Secondary |
|-----------|---------|-----------|
| Cloudflare | 1.1.1.1 | 1.0.0.1 |
| Google | 8.8.8.8 | 8.8.4.4 |
| Quad9 | 9.9.9.9 | 149.112.112.112 |
| OpenDNS | 208.67.222.222 | 208.67.220.220 |
| AdGuard | 94.140.14.14 | 94.140.15.15 |

### Использование через CLI
```bash
# Установить DNS
npm run cli -- dns:set cloudflare

# Текущий DNS
npm run cli -- dns:current

# Восстановить (DHCP)
npm run cli -- dns:restore

# Очистить кэш
npm run cli -- dns:flush
```

### API
```javascript
// Получить текущий DNS
GET /api/dns/current

// Установить DNS
POST /api/dns/set
{
  "provider": "cloudflare"
}

// Восстановить
POST /api/dns/restore

// Очистить кэш
POST /api/dns/flush

// Список провайдеров
GET /api/dns/providers
```

---

## 🟡 IP Менеджер

### Возможности
- Проверка текущего IP
- Геолокация (страна, город, провайдер)
- Детект блокировок Cursor API
- История изменений IP

### Использование через CLI
```bash
# Проверка IP
npm run cli -- ip:check --details

# История IP
npm run cli -- ip:history
```

### API
```javascript
// Проверка IP с деталями
GET /api/ip/check?details=true

// История
GET /api/ip/history
```

### Детект блокировок
```javascript
import { globalIPManager } from './utils/ipManager.js';

const blocks = await globalIPManager.detectBlocks();
console.log(blocks.recommendations);
```

---

## 🟣 Fingerprint Обход

### Возможности
- Сброс MAC адреса
- Смена hostname системы
- Очистка DNS кэша

### ⚠️ Требуются права администратора!

### Использование через CLI
```bash
# Полный сброс
npm run cli -- fingerprint:reset

# Только MAC адрес
npm run cli -- fingerprint:mac

# Только hostname
npm run cli -- fingerprint:hostname --name new-hostname

# Информация
npm run cli -- fingerprint:info
```

### API
```javascript
// Информация
GET /api/fingerprint/info

// Полный сброс
POST /api/fingerprint/reset
{
  "changeMAC": true,
  "changeHostname": true,
  "flushDNS": true
}

// Смена MAC
POST /api/fingerprint/mac

// Смена hostname
POST /api/fingerprint/hostname
{
  "name": "new-hostname"
}
```

---

## 📧 Email Интеграция

### Поддерживаемые сервисы
- Guerrilla Mail
- Temp Mail
- Mailinator
- Sazumi Cloud Mail

### Использование через CLI
```bash
# Создать email
npm run cli -- email:create --service guerrillamail

# Проверить почту
npm run cli -- email:check

# Ждать письмо от Cursor
npm run cli -- email:wait --timeout 120000
```

### API
```javascript
// Создать email
POST /api/email/create
{
  "service": "guerrillamail"
}

// Проверить сообщения
GET /api/email/messages

// Ждать письмо
POST /api/email/wait
{
  "subjectContains": "cursor",
  "timeout": 120000
}

// Список сервисов
GET /api/email/services
```

### Извлечение кода подтверждения
```javascript
import { globalEmailManager } from './utils/emailManager.js';

const message = await globalEmailManager.waitForMessage({
  subjectContains: 'cursor',
  timeout: 120000
});

const code = globalEmailManager.extractVerificationCode(message.body);
const link = globalEmailManager.extractVerificationLink(message.body);
```

---

## 📊 Мониторинг

### Возможности
- Проверка доступности Cursor API
- Проверка DNS серверов
- Генерация рекомендаций
- Автоматический мониторинг

### Использование через CLI
```bash
# Проверить статус
npm run cli -- monitor:check

# Запустить мониторинг
npm run cli -- monitor:start --interval 60000

# Остановить
npm run cli -- monitor:stop

# Статус
npm run cli -- monitor:status
```

### API
```javascript
// Полная проверка
GET /api/monitor/check

// Статус
GET /api/monitor/status

// Запустить мониторинг
POST /api/monitor/start
{
  "interval": 60000
}

// Остановить
POST /api/monitor/stop
```

---

## 💻 CLI Режим

### Все команды

#### Proxy
```bash
npm run cli -- proxy:add <host:port> [--protocol socks5|http] [--auth user:pass]
npm run cli -- proxy:list
npm run cli -- proxy:check
npm run cli -- proxy:rotate
npm run cli -- proxy:clear
```

#### DNS
```bash
npm run cli -- dns:set <cloudflare|google|quad9|opendns|adguard|auto>
npm run cli -- dns:current
npm run cli -- dns:restore
npm run cli -- dns:flush
```

#### IP
```bash
npm run cli -- ip:check [--details]
npm run cli -- ip:history
```

#### Fingerprint
```bash
npm run cli -- fingerprint:reset [--no-mac] [--no-hostname] [--no-dns]
npm run cli -- fingerprint:mac
npm run cli -- fingerprint:hostname [--name <newname>]
npm run cli -- fingerprint:info
```

#### Email
```bash
npm run cli -- email:create [--service guerrillamail|tempmail|sazumi|mailinator]
npm run cli -- email:check
npm run cli -- email:wait [--timeout 120000]
```

#### Monitor
```bash
npm run cli -- monitor:check
npm run cli -- monitor:start [--interval 60000]
npm run cli -- monitor:stop
npm run cli -- monitor:status
```

#### Reset
```bash
npm run cli -- reset
npm run cli -- reset:all
```

#### Info
```bash
npm run cli -- info
npm run cli -- help [command]
```

---

## 🔗 API Reference

### Auto Bypass Endpoint

Комбинированный endpoint для автоматического обхода блокировок.

```javascript
POST /api/bypass/auto
{
  "changeProxy": true,
  "changeDNS": true,
  "changeFingerprint": false
}
```

Ответ:
```json
{
  "success": true,
  "ipBefore": { "ip": "1.2.3.4", "country": "RU" },
  "ipAfter": { "ip": "5.6.7.8", "country": "US" },
  "ipChanged": true,
  "proxy": { "success": true, "proxy": "socks5://..." },
  "dns": { "success": true },
  "fingerprint": null,
  "cursorAvailable": true
}
```

---

## 🚀 Быстрый старт

### 1. Проверка статуса
```bash
npm run cli -- monitor:check
```

### 2. Добавление прокси
```bash
npm run cli -- proxy:add 192.168.1.1:1080 --protocol socks5
npm run cli -- proxy:check
```

### 3. Смена DNS
```bash
npm run cli -- dns:set cloudflare
```

### 4. Полный сброс fingerprint
```bash
npm run cli -- fingerprint:reset
```

### 5. Авто-обход
```bash
# Через API
curl -X POST http://localhost:3000/api/bypass/auto \
  -H "Content-Type: application/json" \
  -d '{"changeProxy":true,"changeDNS":true}'
```

---

## ⚠️ Важные замечания

1. **Права администратора** требуются для:
   - Смены DNS
   - Смены MAC адреса
   - Смены hostname

2. **Перезагрузка** может потребоваться после:
   - Смены MAC адреса (Windows)
   - Смены hostname (Windows)

3. **Бэкапы** создаются автоматически перед изменениями

4. **Откат изменений**:
   ```javascript
   import { globalDNSManager } from './utils/dnsManager.js';
   await globalDNSManager.restoreDNS();
   ```

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в `/logs/app.log`
2. Используйте `npm run cli -- help` для справки
3. Откройте issue на GitHub
