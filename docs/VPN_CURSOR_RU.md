# 🔐 VPN & Cursor Registrar - Документация

Комплексное решение для обхода блокировок и автоматической регистрации Cursor.

---

## 📋 Содержание

1. [VPN Manager](#vpn-manager)
2. [Cursor Registrar](#cursor-registrar)
3. [CLI Команды](#cli-команды)
4. [API Reference](#api-reference)

---

## 🔵 VPN Manager

### Возможности
- **WireGuard** - современный VPN протокол
- **OpenVPN** - классический VPN протокол
- **Быстрое подключение** - авто-выбор доступного VPN
- **Управление конфигурациями** - создание, импорт, удаление

### Установка VPN клиентов

#### Windows
**WireGuard:**
```
https://www.wireguard.com/install/wireguard-installer.exe
```

**OpenVPN:**
```
https://openvpn.net/community-downloads/
```

#### macOS
```bash
# WireGuard
brew install wireguard-tools

# OpenVPN
brew install openvpn
```

#### Linux
```bash
# Ubuntu/Debian
sudo apt install wireguard openvpn

# Fedora/RHEL
sudo dnf install wireguard-tools openvpn
```

---

### CLI Команды VPN

#### Инициализация
```bash
npm run cli -- vpn:init
```
Проверяет установленные VPN клиенты.

#### Статус
```bash
npm run cli -- vpn:status
```
Показывает текущее подключение и внешний IP.

#### Быстрое подключение
```bash
npm run cli -- vpn:quick
```
Автоматическое подключение к доступному VPN.

#### Отключение
```bash
npm run cli -- vpn:disconnect
```
Отключает любой активный VPN.

#### Список конфигураций
```bash
npm run cli -- vpn:configs
```
Показывает доступные VPN конфигурации.

---

### API Endpoints

#### Инициализация
```bash
GET /api/vpn/init
```

#### Статус
```bash
GET /api/vpn/status
```

Ответ:
```json
{
  "success": true,
  "connected": true,
  "type": "wireguard",
  "ip": "185.123.45.67",
  "country": "Netherlands"
}
```

#### Конфигурации
```bash
GET /api/vpn/configs
```

#### Создание WireGuard конфигурации
```bash
POST /api/vpn/wireguard/create
{
  "name": "my-vpn",
  "privateKey": "<generated>",
  "address": "10.0.0.2/32",
  "dns": "1.1.1.1",
  "peers": [{
    "publicKey": "<server-key>",
    "endpoint": "vpn.example.com:51820",
    "allowedIPs": "0.0.0.0/0"
  }]
}
```

#### Подключение WireGuard
```bash
POST /api/vpn/wireguard/connect
{
  "tunnelName": "my-vpn"
}
```

#### Отключение WireGuard
```bash
POST /api/vpn/wireguard/disconnect
{
  "tunnelName": "my-vpn"
}
```

#### Создание OpenVPN конфигурации
```bash
POST /api/vpn/openvpn/create
{
  "name": "my-openvpn",
  "remote": "vpn.example.com",
  "port": 1194,
  "proto": "udp",
  "ca": "-----BEGIN CERTIFICATE-----...",
  "cert": "-----BEGIN CERTIFICATE-----...",
  "key": "-----BEGIN PRIVATE KEY-----..."
}
```

#### Подключение OpenVPN
```bash
POST /api/vpn/openvpn/connect
{
  "configFile": "/path/to/config.ovpn",
  "authUserPass": "username\npassword"
}
```

#### Отключение VPN
```bash
POST /api/vpn/disconnect
```

#### Быстрое подключение
```bash
POST /api/vpn/quick-connect
```

#### Удаление конфигурации
```bash
DELETE /api/vpn/config/:name
```

---

## 🟢 Cursor Registrar

### Возможности
- **Автоматическая регистрация** - полный цикл
- **Email интеграция** - временные почты
- **Подтверждение** - авто-верификация
- **Проверка статуса** - Pro/Trial/Free

### CLI Команды

#### Регистрация
```bash
npm run cli -- cursor:register --email-service guerrillamail
```

#### Авто-регистрация
```bash
npm run cli -- cursor:auto-register --email-service guerrillamail
```
Полный цикл: email → регистрация → подтверждение → проверка статуса.

#### Вход
```bash
npm run cli -- cursor:signin user@example.com
```

#### Профиль
```bash
npm run cli -- cursor:profile
```

#### Статус подписки
```bash
npm run cli -- cursor:subscription
```

#### Выход
```bash
npm run cli -- cursor:signout
```

#### Текущая сессия
```bash
npm run cli -- cursor:session
```

---

### API Endpoints

#### Текущая сессия
```bash
GET /api/cursor/session
```

#### Регистрация
```bash
POST /api/cursor/register
{
  "emailService": "guerrillamail",
  "autoVerify": true,
  "timeout": 120000
}
```

Ответ:
```json
{
  "success": true,
  "email": "temp123@guerrillamail.com",
  "verified": true,
  "token": "eyJhbGc..."
}
```

#### Авто-регистрация
```bash
POST /api/cursor/auto-register
{
  "emailService": "guerrillamail",
  "checkProStatus": true,
  "timeout": 180000
}
```

Ответ:
```json
{
  "success": true,
  "email": "temp123@guerrillamail.com",
  "verified": true,
  "isPro": false,
  "isTrial": true,
  "steps": [
    "Creating email...",
    "Email verified ✓",
    "Checking Pro status...",
    "Status: trial ✓"
  ]
}
```

#### Вход (запрос кода)
```bash
POST /api/cursor/signin
{
  "email": "user@example.com"
}
```

#### Вход (с кодом)
```bash
POST /api/cursor/signin
{
  "email": "user@example.com",
  "code": "123456"
}
```

#### Профиль
```bash
GET /api/cursor/profile
```

#### Подписка
```bash
GET /api/cursor/subscription
```

Ответ:
```json
{
  "success": true,
  "tier": "trial",
  "isPro": false,
  "isTrial": true
}
```

#### Выход
```bash
POST /api/cursor/signout
```

#### Установка токена
```bash
POST /api/cursor/set-token
{
  "token": "eyJhbGc..."
}
```

#### Очистка сессии
```bash
DELETE /api/cursor/clear
```

---

## 💻 Примеры использования

### Полная автоматизация через CLI

```bash
# 1. Инициализация VPN
npm run cli -- vpn:init

# 2. Быстрое подключение VPN
npm run cli -- vpn:quick

# 3. Проверка статуса
npm run cli -- vpn:status

# 4. Авто-регистрация Cursor
npm run cli -- cursor:auto-register --email-service guerrillamail

# 5. Проверка подписки
npm run cli -- cursor:subscription
```

### Программное использование

```javascript
import { globalVPNManager } from './utils/vpnManager.js';
import { globalCursorRegistrar } from './utils/cursorRegistrar.js';

// Подключение VPN
await globalVPNManager.init();
const vpnStatus = await globalVPNManager.quickConnect();
console.log(`VPN: ${vpnStatus.country}`);

// Регистрация Cursor
const result = await globalCursorRegistrar.autoRegister({
  emailService: 'guerrillamail',
  checkProStatus: true
});

if (result.success) {
  console.log(`Email: ${result.email}`);
  console.log(`Status: ${result.isTrial ? 'Trial' : 'Free'}`);
}
```

### Комбинированный обход блокировок

```javascript
// 1. Смена прокси
import { globalProxyDatabase } from './utils/proxyDatabase.js';
await globalProxyDatabase.init();
const proxy = globalProxyDatabase.getRandomWorking('socks5');

// 2. Подключение VPN
import { globalVPNManager } from './utils/vpnManager.js';
await globalVPNManager.quickConnect();

// 3. Смена DNS
import { globalDNSManager } from './utils/dnsManager.js';
await globalDNSManager.setDNS('cloudflare');

// 4. Регистрация Cursor
import { globalCursorRegistrar } from './utils/cursorRegistrar.js';
const result = await globalCursorRegistrar.autoRegister();
```

---

## 🔧 Настройка WireGuard

### Генерация ключей

```bash
# Linux/macOS
wg genkey | tee privatekey | wg pubkey > publickey

# Windows (через PowerShell)
cd "C:\Program Files\WireGuard"
.\wgen.exe genkey | tee privatekey | .\wgen.exe pubkey > publickey
```

### Конфигурация сервера

```ini
[Interface]
Address = 10.0.0.1/24
SaveConfig = true
PrivateKey = <server-private-key>
ListenPort = 51820

[Peer]
PublicKey = <client-public-key>
AllowedIPs = 10.0.0.2/32
```

### Конфигурация клиента

```ini
[Interface]
Address = 10.0.0.2/32
PrivateKey = <client-private-key>
DNS = 1.1.1.1

[Peer]
PublicKey = <server-public-key>
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0
```

---

## 🔧 Настройка OpenVPN

### Базовая конфигурация

```openvpn
client
dev tun
proto udp
remote vpn.example.com 1194
resolv-retry infinite
nobind
persist-key
persist-tun
ca ca.crt
cert client.crt
key client.key
cipher AES-256-GCM
auth SHA256
comp-lzo
verb 3
```

### Генерация сертификатов

```bash
# Инициализация PKI
easyrsa init-pki

# Создание CA
easyrsa build-ca

# Генерация серверного сертификата
easyrsa gen-req server nopass
easyrsa sign-req server server

# Генерация клиентского сертификата
easyrsa gen-req client nopass
easyrsa sign-req client client

# Генерация TLS auth key
openvpn --genkey --secret ta.key
```

---

## ⚠️ Важные замечания

### VPN
1. **Права администратора** требуются для подключения VPN
2. **WireGuard** быстрее и современнее OpenVPN
3. **OpenVPN** совместим со старыми серверами

### Cursor Registrar
1. **Временные email** могут блокироваться Cursor
2. **Рекомендуется** использовать платные email сервисы
3. **Trial период** может требовать карту

---

## 📊 Сравнение VPN протоколов

| Характеристика | WireGuard | OpenVPN |
|---------------|-----------|---------|
| Скорость | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Безопасность | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Простота | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Совместимость | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Размер кода | 4000 строк | 600000 строк |

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи в `/logs/app.log`
2. Убедитесь что VPN клиент установлен
3. Проверьте доступность email сервисов
4. Откройте issue на GitHub

---

**Версия**: 1.0  
**Автор**: Sazumi Cloud  
**Лицензия**: MIT
