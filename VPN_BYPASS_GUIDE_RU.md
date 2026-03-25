# 🛡️ Руководство по обходу блокировок Cursor

## Почему блокировка происходит даже с VPN?

Если вы используете VPN (например, Amnezia VPN Казахстан), но Cursor всё равно блокируется, проблема может быть в одном из следующих:

### 1. 🔴 DNS утечка
**Проблема:** VPN меняет ваш IP-адрес, но DNS-запросы продолжают идти через вашего провайдера, который блокирует домены Cursor.

**Решение:**
```bash
# Использовать публичный DNS
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d '{"provider":"cloudflare"}'

# Или включить DNS over HTTPS
curl -X POST http://localhost:3000/api/doh-vpn/integrate
```

### 2. 🔴 WebRTC утечка
**Проблема:** Браузер может показывать ваш реальный IP через WebRTC API.

**Решение:**
- Отключите WebRTC в настройках браузера
- Используйте расширения: WebRTC Leak Prevent
- Примените настройки из файла `data/browser-config/firefox-webrtc-fix.json`

### 3. 🔴 IPv6 утечка
**Проблема:** VPN туннелирует только IPv4, а IPv6 трафик идёт напрямую.

**Решение:**
```bash
# Автоматическое исправление
curl -X POST http://localhost:3000/api/vpn-leak/fix
```

### 4. 🔴 Неправильная конфигурация VPN
**Проблема:** Amnezia может не перехватывать весь трафик.

**Решение:**
```bash
# Настройка полного туннелирования
curl -X POST http://localhost:3000/api/vpn-traffic/quick-setup
```

---

## 📋 Быстрая диагностика

### Запустить полный тест
```bash
curl http://localhost:3000/api/bypass/test/full
```

### Запустить быстрый тест
```bash
curl http://localhost:3000/api/bypass/test/quick
```

### Получить рекомендации
```bash
curl http://localhost:3000/api/bypass/recommendations
```

---

## 🔧 Пошаговое исправление

### Шаг 1: Проверка VPN
```bash
curl http://localhost:3000/api/vpn/status
curl http://localhost:3000/api/amnezia/status
```

**Что искать:**
- `detected: true` - VPN обнаружен
- `countryCode` - не должен быть "RU"
- `isVPN: true` - известный VPN провайдер

### Шаг 2: Исправление DNS утечки
```bash
# Установить Cloudflare DNS
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d '{"provider":"cloudflare"}'

# Включить DoH
curl -X POST http://localhost:3000/api/doh-vpn/integrate
```

### Шаг 3: Настройка VPN туннелирования
```bash
# Включить Kill Switch
curl -X POST http://localhost:3000/api/vpn-traffic/killswitch/enable

# Настроить маршруты
curl -X POST http://localhost:3000/api/vpn-traffic/configure
```

### Шаг 4: Комплексное исправление утечек
```bash
curl -X POST http://localhost:3000/api/vpn-leak/fix
```

### Шаг 5: Проверка результата
```bash
curl http://localhost:3000/api/bypass/test/full
```

---

## 🌐 API Reference

### VPN Manager

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/vpn/status` | GET | Статус VPN подключения |
| `/api/vpn/check` | POST | Проверка VPN с рекомендациями |
| `/api/amnezia/status` | GET | Статус Amnezia VPN |
| `/api/amnezia/recommendations` | GET | Рекомендации для Amnezia |

### DNS Manager

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/dns/status` | GET | Текущий DNS статус |
| `/api/dns/set` | POST | Установить DNS провайдер |
| `/api/dns/restore` | POST | Восстановить DNS |
| `/api/dns/flush` | POST | Очистить DNS кэш |

### VPN Leak Fix

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/vpn-leak/fix` | POST | Комплексное исправление утечек |
| `/api/vpn-leak/restore` | POST | Восстановление настроек |
| `/api/vpn-leak/status` | GET | Статус утечек |

### VPN Traffic Manager

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/vpn-traffic/configure` | POST | Настройка полного туннелирования |
| `/api/vpn-traffic/killswitch/enable` | POST | Включить Kill Switch |
| `/api/vpn-traffic/killswitch/disable` | POST | Отключить Kill Switch |
| `/api/vpn-traffic/status` | GET | Статус туннеля |
| `/api/vpn-traffic/quick-setup` | POST | Быстрая настройка для Cursor |

### Bypass Tester

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/bypass/test/full` | GET | Полный тест всех методов |
| `/api/bypass/test/quick` | GET | Быстрый тест (VPN + Cursor) |
| `/api/bypass/results` | GET | Последние результаты |
| `/api/bypass/recommendations` | GET | Рекомендации в тексте |

### System Proxy

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/system-proxy/configure` | POST | Настроить системный прокси |
| `/api/system-proxy/disable` | POST | Отключить прокси |
| `/api/system-proxy/status` | GET | Статус прокси |
| `/api/system-proxy/restore` | POST | Восстановить настройки |

### DoH-VPN Integration

| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/doh-vpn/integrate` | POST | Интеграция DoH с VPN |
| `/api/doh-vpn/recommendations` | GET | Рекомендации для VPN |

---

## 🎯 Рекомендации для Amnezia VPN

### Оптимальные настройки Amnezia:

1. **Протокол:** Используйте **AmneziaWG** (модифицированный WireGuard)
2. **Maskobka:** Включите для маскировки VPN трафика
3. **DNS:** Настройте через Amnezia (1.1.1.1 или 9.9.9.9)
4. **Kill Switch:** Включите в настройках Amnezia

### Команды для проверки:

```bash
# Проверка Amnezia
curl http://localhost:3000/api/amnezia/status

# Получить рекомендации
curl http://localhost:3000/api/amnezia/recommendations

# Интеграция с DoH
curl -X POST http://localhost:3000/api/doh-vpn/integrate
```

---

## 🧩 Примеры использования

### Пример 1: Полная настройка для Cursor
```bash
# 1. Проверка VPN
curl http://localhost:3000/api/vpn/status

# 2. Настройка DNS
curl -X POST http://localhost:3000/api/dns/set -H "Content-Type: application/json" -d '{"provider":"cloudflare"}'

# 3. Включение DoH
curl -X POST http://localhost:3000/api/doh-vpn/integrate

# 4. Настройка туннелирования
curl -X POST http://localhost:3000/api/vpn-traffic/quick-setup

# 5. Исправление утечек
curl -X POST http://localhost:3000/api/vpn-leak/fix

# 6. Финальная проверка
curl http://localhost:3000/api/bypass/test/full
```

### Пример 2: Диагностика проблемы
```bash
# Запустить тест
curl http://localhost:3000/api/bypass/test/full | jq

# Получить рекомендации
curl http://localhost:3000/api/bypass/recommendations | jq -r '.text'
```

### Пример 3: Настройка системного прокси
```bash
# Настройка HTTP прокси
curl -X POST http://localhost:3000/api/system-proxy/configure \
  -H "Content-Type: application/json" \
  -d '{"host":"127.0.0.1","port":1080,"protocol":"socks5"}'

# Проверка статуса
curl http://localhost:3000/api/system-proxy/status

# Отключение
curl -X POST http://localhost:3000/api/system-proxy/disable
```

---

## 📊 Интерпретация результатов теста

### Баллы теста:
- **80-100:** Отлично - Cursor должен работать
- **60-79:** Хорошо - возможны небольшие проблемы
- **40-59:** Удовлетворительно - рекомендуются улучшения
- **0-39:** Плохо - требуется настройка

### Компоненты:
- **VPN Score:** Наличие и качество VPN
- **DNS Score:** Использование публичного DNS
- **DoH Score:** Доступность DNS over HTTPS
- **Proxy Score:** Наличие рабочих прокси
- **Leak Score:** Защита от утечек
- **Cursor Score:** Доступность Cursor

---

## ⚠️ Важные замечания

1. **Порядок применения:** Сначала включите VPN, затем применяйте настройки DNS/DoH
2. **Перезапуск приложений:** После настройки может потребоваться перезапуск Cursor
3. **Kill Switch:** Будьте осторожны - при отключении VPN интернет пропадёт
4. **IPv6:** Если не используется - отключите для предотвращения утечек

---

## 🔗 Дополнительные ресурсы

- [Cloudflare DNS](https://1.1.1.1/)
- [DNS Leak Test](https://www.dnsleaktest.com/)
- [WebRTC Leak Test](https://browserleaks.com/webrtc)
- [Amnezia VPN](https://amnezia.org/)

---

## 📝 Changelog

### Версия 2.6.0
- ✅ Добавлен VPN Leak Fix Manager
- ✅ Добавлен VPN Traffic Manager
- ✅ Добавлен Bypass Tester
- ✅ Добавлен System Proxy Manager
- ✅ Улучшена поддержка Amnezia VPN
- ✅ Интеграция DoH с VPN
- ✅ Новые API endpoints для всех функций
