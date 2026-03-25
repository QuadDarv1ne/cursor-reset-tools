# Руководство по обходу блокировок Cursor

## Почему VPN не всегда помогает?

Даже с включенным VPN (например, Amnezia VPN - Казахстан), Cursor может блокировать доступ. Вот основные причины:

### 1. DNS утечка
**Проблема:** VPN меняет ваш IP, но DNS запросы могут идти через провайдера.
**Решение:** Используйте DNS over HTTPS (DoH) или смените системный DNS на Cloudflare (1.1.1.1).

### 2. WebRTC утечка
**Проблема:** Браузер может показывать реальный IP через WebRTC.
**Решение:** Установите расширение "WebRTC Leak Prevent" или отключите WebRTC.

### 3. IPv6 утечка
**Проблема:** VPN может туннелировать только IPv4 трафик.
**Решение:** Отключите IPv6 в настройках сетевого адаптера.

### 4. Блокировка по отпечатку
**Проблема:** Cursor использует Machine ID и другие идентификаторы.
**Решение:** Сбросьте Machine ID через этот инструмент.

---

## Новые функции

### 🔍 Проверка VPN статуса

**API:** `GET /api/vpn/status`

Проверяет активное VPN подключение:
- Определяет тип VPN (Amnezia, WireGuard, NordVPN, и др.)
- Показывает страну и IP
- Обнаруживает прокси и Tor

**Пример ответа:**
```json
{
  "success": true,
  "detected": true,
  "type": "known_vpn",
  "country": "Kazakhstan",
  "countryCode": "KZ",
  "ip": "xxx.xxx.xxx.xxx",
  "isp": "Amnezia VPN",
  "isVPN": true
}
```

### 🛡️ Комплексная проверка

**API:** `POST /api/vpn/check`

Полная диагностика:
- Проверка VPN
- Проверка DNS
- Рекомендации по обходу

**API:** `GET /api/leak/check`

Проверка утечек:
- DNS leak test
- IPv6 leak test
- WebRTC рекомендации

### 🌐 Управление DNS

**Просмотр текущего DNS:**
```bash
GET /api/dns/status
```

**Установка DNS:**
```bash
POST /api/dns/set
{
  "provider": "cloudflare"  // cloudflare, google, quad9, opendns, adguard
}
```

**Восстановление DHCP:**
```bash
POST /api/dns/restore
```

**Очистка DNS кэша:**
```bash
POST /api/dns/flush
```

### 🔀 Управление прокси

**Добавить прокси:**
```bash
POST /api/proxy/add
{
  "url": "user:pass@host:port",
  "protocol": "socks5"  // socks5, http, https
}
```

**Ротация прокси:**
```bash
POST /api/proxy/rotate
```

**Статус прокси:**
```bash
GET /api/proxy/status
```

**Отключить прокси:**
```bash
POST /api/proxy/clear
```

### 🔐 DNS over HTTPS (DoH)

**Резолвинг домена:**
```bash
GET /api/doh/resolve?domain=cursor.sh&provider=cloudflare
```

**Доступные провайдеры:**
```bash
GET /api/doh/providers
```

---

## Рекомендуемый порядок действий

### Если VPN включен, но Cursor не работает:

1. **Проверьте VPN статус**
   ```bash
   GET /api/vpn/status
   ```
   Убедитесь что VPN обнаружен и показывает нужную страну.

2. **Проверьте утечки**
   ```bash
   GET /api/leak/check
   ```
   Исправьте найденные утечки.

3. **Смените DNS**
   ```bash
   POST /api/dns/set
   { "provider": "cloudflare" }
   ```

4. **Включите DoH** (опционально)
   Используйте DoH для дополнительного обхода DNS блокировок.

5. **Добавьте прокси** (если VPN не помогает)
   ```bash
   POST /api/proxy/add
   { "url": "proxy-host:port", "protocol": "socks5" }
   ```

6. **Сбросьте Machine ID**
   Используйте основную функцию сброса Machine ID.

---

## Доступные DNS провайдеры

| Провайдер | Primary DNS | Secondary DNS |
|-----------|-------------|---------------|
| Cloudflare | 1.1.1.1 | 1.0.0.1 |
| Google | 8.8.8.8 | 8.8.4.4 |
| Quad9 | 9.9.9.9 | 149.112.112.112 |
| OpenDNS | 208.67.222.222 | 208.67.220.220 |
| AdGuard | 94.140.14.14 | 94.140.15.15 |

---

## Проверка WebRTC (вручную)

1. Откройте браузер в режиме инкогнито
2. Перейдите на https://browserleaks.com/webrtc
3. Сравните показанные IP с вашим VPN IP
4. Если видите реальный IP - установите WebRTC Leak Prevent

---

## Автоматический обход

**API:** `GET /api/smart/status`

Получить статус умной системы обхода:
- Веса методов (VPN, Proxy, DoH, DNS)
- Лучший метод
- Рекомендации

**API:** `POST /api/smart/apply`

Автоматически применить лучший метод обхода.

**API:** `POST /api/smart/test`

Протестировать все методы обхода.

---

## Примеры использования

### PowerShell (Windows)

```powershell
# Проверка VPN статуса
Invoke-RestMethod -Uri "http://localhost:3000/api/vpn/status"

# Установка DNS
Invoke-RestMethod -Uri "http://localhost:3000/api/dns/set" -Method Post -ContentType "application/json" -Body '{"provider":"cloudflare"}'

# Проверка утечек
Invoke-RestMethod -Uri "http://localhost:3000/api/leak/check"

# Применение лучшего метода обхода
Invoke-RestMethod -Uri "http://localhost:3000/api/smart/apply" -Method Post
```

### cURL

```bash
# Проверка VPN
curl http://localhost:3000/api/vpn/status

# Установка DNS
curl -X POST http://localhost:3000/api/dns/set \
  -H "Content-Type: application/json" \
  -d '{"provider":"cloudflare"}'

# Проверка утечек
curl http://localhost:3000/api/leak/check
```

---

## Решение проблем

### "VPN не обнаружен"
- Убедитесь что VPN подключение активно
- Проверьте что IP сменился (https://ipapi.co/json/)
- Перезапустите VPN клиент

### "DNS недоступны"
- Брандмауэр может блокировать DNS
- Попробуйте DoH вместо системного DNS
- Проверьте настройки антивируса

### "Cursor всё ещё блокирует"
1. Закройте Cursor полностью
2. Сбросьте Machine ID
3. Очистите кэш DNS
4. Попробуйте другой VPN сервер
5. Используйте прокси в дополнение к VPN

---

## Поддерживаемые VPN клиенты

Автоматически определяются:
- Amnezia VPN
- WireGuard
- OpenVPN
- NordVPN
- ExpressVPN
- Surfshark
- ProtonVPN
- CyberGhost
- Windscribe
- И другие

---

**⚠️ Важно:** Этот инструмент для образовательных целей. Поддержите разработчиков Cursor покупкой лицензии если продукт вам полезен.
