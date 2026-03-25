# 🚀 Полное руководство по обходу блокировок Cursor

## ✅ Ваш текущий статус

Проверка от 25 марта 2026:

| Компонент | Статус | Детали |
|-----------|--------|--------|
| **VPN** | ✅ **Активен** | Казахстан (G-Core Labs S.A.) |
| **DNS** | ✅ **Cloudflare** | 1.1.1.1, 1.0.0.1 |
| **DNS утечка** | ✅ **Нет** | Публичный DNS используется |
| **IPv6 утечка** | ✅ **Нет** | IPv6 не активен |
| **WebRTC** | ⚠️ **Требует проверки** | Браузер может показывать IP |

---

## 🔍 Почему Cursor всё ещё блокирует?

### Главная причина: Machine ID

Cursor идентифицирует ваше устройство по **уникальному Machine ID**, который хранится в:

```
%APPDATA%\Cursor\machineId  (Windows)
```

**Даже с VPN** Cursor видит тот же Machine ID и блокирует доступ!

---

## 📋 Пошаговая инструкция по обходу

### Шаг 1: Закройте Cursor полностью

```bash
# Проверьте что Cursor не запущен
taskkill /F /IM cursor.exe 2>nul || true
```

### Шаг 2: Сбросьте Machine ID

**Вариант A: Через веб-интерфейс**

1. Запустите сервер:
   ```bash
   npm start
   ```
2. Откройте в браузере: `http://localhost:3000`
3. Нажмите **"Reset Machine ID"**

**Вариант B: Через CLI**

```bash
npm run cli
```

### Шаг 3: Проверка VPN статуса

```bash
curl http://localhost:3000/api/vpn/status
```

Или через PowerShell:
```powershell
Invoke-RestMethod http://localhost:3000/api/vpn/status
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "detected": true,
  "country": "Kazakhstan",
  "countryCode": "KZ",
  "isVPN": true
}
```

### Шаг 4: Проверка утечек

```bash
curl http://localhost:3000/api/leak/check
```

**Ожидаемый результат:**
```json
{
  "overall": {
    "dnsLeak": false,
    "webrtcRisk": true,
    "ipv6Leak": false,
    "safe": true
  }
}
```

### Шаг 5: Исправление WebRTC утечки (для браузера)

1. Откройте браузер в режиме инкогнито
2. Перейдите на https://browserleaks.com/webrtc
3. Сравните показанные IP с вашим VPN IP (5.189.202.36)
4. Если видите другой IP — установите расширение:
   - **Chrome**: [WebRTC Leak Prevent](https://chrome.google.com/webstore/detail/webrtc-leak-prevent)
   - **Firefox**: Установите `media.peerconnection.enabled = false` в `about:config`

### Шаг 6: Применение лучшего метода обхода

```bash
curl -X POST http://localhost:3000/api/smart/apply
```

Это автоматически применит лучший доступный метод.

### Шаг 7: Запустите Cursor

1. **Убедитесь что VPN подключён**
2. Запустите Cursor
3. Войдите под новым аккаунтом (если требуется)

---

## 🛠️ Дополнительные инструменты

### Смена DNS сервера

Если Cloudflare не работает:

```bash
# Google DNS
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d "{\"provider\":\"google\"}"

# Quad9
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d "{\"provider\":\"quad9\"}"

# AdGuard (блокирует рекламу)
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d "{\"provider\":\"adguard\"}"
```

### Очистка DNS кэша

```bash
curl -X POST http://localhost:3000/api/dns/flush
```

### Использование прокси (если VPN не помогает)

**Добавить прокси:**
```bash
curl -X POST http://localhost:3000/api/proxy/add -H "Content-Type: application/json" -d "{\"url\":\"host:port\",\"protocol\":\"socks5\"}"
```

**Ротация прокси:**
```bash
curl -X POST http://localhost:3000/api/proxy/rotate
```

**Статус прокси:**
```bash
curl http://localhost:3000/api/proxy/status
```

### DoH (DNS over HTTPS)

DoH шифрует DNS запросы для дополнительной защиты:

```bash
# Резолвинг домена через DoH
curl "http://localhost:3000/api/doh/resolve?domain=cursor.sh&provider=cloudflare"

# Доступные провайдеры DoH
curl http://localhost:3000/api/doh/providers
```

---

## 🎯 Комплексное исправление утечек

Автоматическое исправление всех утечек:

```bash
curl -X POST http://localhost:3000/api/vpn-leak/fix
```

Это:
- Установит Cloudflare DNS
- Включит DoH
- Создаст конфигурацию для отключения WebRTC
- Проверит IPv6 утечки

---

## 🔐 Настройка VPN трафика для Cursor

Принудительное туннелирование всего трафика через VPN:

```bash
# Быстрая настройка для Cursor
curl -X POST http://localhost:3000/api/vpn-traffic/quick-setup

# Полная настройка туннеля
curl -X POST http://localhost:3000/api/vpn-traffic/configure

# Включение Kill Switch (блокировка без VPN)
curl -X POST http://localhost:3000/api/vpn-traffic/killswitch/enable
```

---

## 📊 Проверка статуса обхода

### Тест всех методов

```bash
curl -X POST http://localhost:3000/api/smart/test
```

**Результат покажет:**
- Прямое подключение
- Прокси
- DoH
- DNS
- VPN

### Рекомендации системы

```bash
curl http://localhost:3000/api/smart/status
```

---

## 🚨 Решение проблем

### "VPN не обнаружен"

1. Убедитесь что Amnezia VPN подключён
2. Проверьте IP: https://ipapi.co/json/
3. Перезапустите VPN клиент

### "DNS недоступны"

Проверьте брандмауэр:
```bash
# Windows - разрешите DNS
netsh advfirewall firewall add rule name="DNS Out" dir=out action=allow protocol=UDP localport=53
```

### "Cursor всё ещё блокирует"

1. **Закройте Cursor полностью**
2. **Сбросьте Machine ID** (обязательно!)
3. Очистите кэш DNS: `ipconfig /flushdns`
4. Попробуйте другой VPN сервер (не Казахстан)
5. Используйте прокси в дополнение к VPN

### "DoH не работает"

Проблема с сертификатами? Используйте системный DNS:
```bash
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d "{\"provider\":\"cloudflare\"}"
```

---

## 📝 Чек-лист перед запуском Cursor

- [ ] VPN подключён (Казахстан или другая страна)
- [ ] DNS установлен (1.1.1.1 Cloudflare)
- [ ] Machine ID сброшен
- [ ] WebRTC проверен (нет утечки)
- [ ] Cursor полностью закрыт перед сбросом
- [ ] DNS кэш очищен

---

## 🔄 Автоматизация

### PowerShell скрипт для полного сброса

```powershell
# Остановить Cursor
taskkill /F /IM cursor.exe 2>$null

# Сбросить Machine ID
Invoke-RestMethod -Uri "http://localhost:3000/reset" -Method Post

# Очистить DNS кэш
ipconfig /flushdns

# Проверить VPN статус
$vpn = Invoke-RestMethod http://localhost:3000/api/vpn/status
Write-Host "VPN: $($vpn.country) ($($vpn.countryCode))"

# Проверить утечки
$leaks = Invoke-RestMethod http://localhost:3000/api/leak/check
Write-Host "DNS Leak: $($leaks.overall.dnsLeak)"
Write-Host "IPv6 Leak: $($leaks.overall.ipv6Leak)"

# Применить лучший метод
Invoke-RestMethod -Uri "http://localhost:3000/api/smart/apply" -Method Post

Write-Host "Готово! Можно запускать Cursor"
```

---

## 🌐 Рекомендуемые страны для VPN

Для обхода блокировок Cursor рекомендуется использовать:

1. **Германия (DE)** - стабильно работает
2. **Нидерланды (NL)** - хорошая скорость
3. **Финляндия (FI)** - низкий пинг
4. **США (US)** - если нужна американская версия
5. **Великобритания (GB)** - стабильно

**Избегайте:**
- Россия (RU)
- Беларусь (BY)
- Китай (CN)
- Иран (IR)

---

## 📞 Поддержка

Если ничего не помогает:

1. Проверьте логи сервера
2. Запустите полный тест: `curl http://localhost:3000/api/bypass/test/full`
3. Проверьте рекомендации: `curl http://localhost:3000/api/bypass/recommendations`

---

## ⚠️ Отказ от ответственности

Этот инструмент для **образовательных целей**. Поддержите разработчиков Cursor, приобретя лицензию, если продукт вам полезен.

---

**Сделано с ❤️ от Sazumi Cloud**
