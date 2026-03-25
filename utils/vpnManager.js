/**
 * VPN Manager - Управление VPN подключениями
 * Поддержка WireGuard, OpenVPN, Amnezia VPN
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { logger } from './logger.js';

const execPromise = promisify(exec);

/**
 * Конфигурация VPN
 */
export const VPN_CONFIG = {
  wireguard: {
    configDir: {
      win32: 'C:\\Program Files\\WireGuard\\Data\\Configurations',
      darwin: '/usr/local/etc/wireguard',
      linux: '/etc/wireguard'
    },
    binary: {
      win32: 'C:\\Program Files\\WireGuard\\wireguard.exe',
      darwin: '/usr/local/bin/wg',
      linux: '/usr/bin/wg'
    }
  },
  openvpn: {
    configDir: {
      win32: 'C:\\Program Files\\OpenVPN\\config',
      darwin: '/usr/local/etc/openvpn',
      linux: '/etc/openvpn'
    },
    binary: {
      win32: 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe',
      darwin: '/usr/local/bin/openvpn',
      linux: '/usr/sbin/openvpn'
    }
  },
  amnezia: {
    configDir: {
      win32: '%APPDATA%\\AmneziaVPN',
      darwin: '~/Library/Application Support/AmneziaVPN',
      linux: '~/.config/AmneziaVPN'
    },
    binary: {
      win32: 'C:\\Program Files\\AmneziaVPN\\AmneziaVPN.exe',
      darwin: '/Applications/AmneziaVPN.app/Contents/MacOS/AmneziaVPN',
      linux: '/usr/bin/amneziavpn'
    },
    processes: ['amnezia', 'amneziavpn', 'awg', 'openvpn']
  }
};

/**
 * Класс для управления VPN
 */
export class VPNManager {
  constructor() {
    this.platform = os.platform();
    this.currentConnection = null;
    this.connections = new Map();
    this.configPath = path.join(process.cwd(), 'data', 'vpn-configs');
  }

  /**
   * Инициализация менеджера
   */
  async init() {
    logger.info('Initializing VPN Manager...', 'vpn');

    // Создание директории для конфигов
    await fs.ensureDir(this.configPath);

    // Проверка установленных VPN клиентов
    const wireguardInstalled = await this.checkWireGuard();
    const openvpnInstalled = await this.checkOpenVPN();

    logger.info(`WireGuard: ${wireguardInstalled ? 'installed' : 'not installed'}`, 'vpn');
    logger.info(`OpenVPN: ${openvpnInstalled ? 'installed' : 'not installed'}`, 'vpn');

    return { wireguard: wireguardInstalled, openvpn: openvpnInstalled };
  }

  /**
   * Проверка установки WireGuard
   */
  async checkWireGuard() {
    try {
      const binary = VPN_CONFIG.wireguard.binary[this.platform];
      await execPromise(`"${binary}" --version 2>&1 || wg --version 2>&1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Проверка установки OpenVPN
   */
  async checkOpenVPN() {
    try {
      const binary = VPN_CONFIG.openvpn.binary[this.platform];
      await execPromise(`"${binary}" --version 2>&1 || openvpn --version 2>&1`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Создание WireGuard конфигурации
   * @param {Object} config - Конфигурация
   * @returns {string} - Путь к файлу конфигурации
   */
  createWireGuardConfig(config) {
    const {
      name,
      privateKey,
      address,
      dns = '1.1.1.1',
      peers = []
    } = config;

    let wgConfig = `[Interface]\n`;
    wgConfig += `PrivateKey = ${privateKey}\n`;
    wgConfig += `Address = ${address}\n`;
    wgConfig += `DNS = ${dns}\n`;

    for (const peer of peers) {
      wgConfig += `\n[Peer]\n`;
      wgConfig += `PublicKey = ${peer.publicKey}\n`;
      if (peer.presharedKey) {
        wgConfig += `PresharedKey = ${peer.presharedKey}\n`;
      }
      wgConfig += `Endpoint = ${peer.endpoint}\n`;
      wgConfig += `AllowedIPs = ${peer.allowedIPs || '0.0.0.0/0'}\n`;
      if (peer.persistentKeepalive) {
        wgConfig += `PersistentKeepalive = ${peer.persistentKeepalive}\n`;
      }
    }

    const configFile = path.join(this.configPath, `${name}.conf`);

    fs.writeFileSync(configFile, wgConfig);
    logger.info(`WireGuard config created: ${configFile}`, 'vpn');

    return configFile;
  }

  /**
   * Импорт WireGuard конфигурации
   * @param {string} configFile - Путь к файлу
   * @returns {Promise<boolean>}
   */
  async importWireGuardConfig(configFile) {
    try {
      if (this.platform === 'win32') {
        const binary = VPN_CONFIG.wireguard.binary[this.platform];
        await execPromise(`"${binary}" /installtunnelservice "${configFile}"`);
      } else {
        // Для Linux/macOS копируем в системную директорию
        const dest = path.join(VPN_CONFIG.wireguard.configDir[this.platform], path.basename(configFile));
        await fs.copy(configFile, dest);
        await fs.chmod(dest, 0o600);
      }

      logger.info(`WireGuard config imported: ${configFile}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`WireGuard import failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Подключение WireGuard
   * @param {string} tunnelName - Имя туннеля
   * @returns {Promise<boolean>}
   */
  async connectWireGuard(tunnelName) {
    try {
      if (this.platform === 'win32') {
        const binary = VPN_CONFIG.wireguard.binary[this.platform];
        await execPromise(`"${binary}" /settunnelstate "${tunnelName}" on`);
      } else if (this.platform === 'darwin') {
        await execPromise(`sudo wg-quick up ${tunnelName}`);
      } else {
        await execPromise(`sudo wg-quick up ${tunnelName}`);
      }

      this.currentConnection = { type: 'wireguard', name: tunnelName };
      logger.info(`WireGuard connected: ${tunnelName}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`WireGuard connect failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Отключение WireGuard
   * @param {string} tunnelName - Имя туннеля
   * @returns {Promise<boolean>}
   */
  async disconnectWireGuard(tunnelName) {
    try {
      if (this.platform === 'win32') {
        const binary = VPN_CONFIG.wireguard.binary[this.platform];
        await execPromise(`"${binary}" /settunnelstate "${tunnelName}" off`);
      } else if (this.platform === 'darwin') {
        await execPromise(`sudo wg-quick down ${tunnelName}`);
      } else {
        await execPromise(`sudo wg-quick down ${tunnelName}`);
      }

      this.currentConnection = null;
      logger.info(`WireGuard disconnected: ${tunnelName}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`WireGuard disconnect failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Создание OpenVPN конфигурации
   * @param {Object} config - Конфигурация
   * @returns {string} - Путь к файлу конфигурации
   */
  createOpenVPNConfig(config) {
    const {
      name,
      remote,
      port = 1194,
      proto = 'udp',
      dev = 'tun',
      ca,
      cert,
      key,
      tlsAuth,
      cipher = 'AES-256-GCM',
      auth = 'SHA256',
      compress = 'lz4-v2'
    } = config;

    let ovpnConfig = `client\ndev ${dev}\nproto ${proto}\n`;
    ovpnConfig += `remote ${remote} ${port}\n`;
    ovpnConfig += `resolv-retry infinite\nnobind\npersist-key\npersist-tun\n`;
    ovpnConfig += `cipher ${cipher}\nauth ${auth}\ncomp-lzo\nverb 3\n`;

    if (compress) {
      ovpnConfig += `compress ${compress}\n`;
    }

    // Вставка сертификатов
    if (ca) {
      ovpnConfig += `<ca>\n${ca}\n</ca>\n`;
    }
    if (cert) {
      ovpnConfig += `<cert>\n${cert}\n</cert>\n`;
    }
    if (key) {
      ovpnConfig += `<key>\n${key}\n</key>\n`;
    }
    if (tlsAuth) {
      ovpnConfig += `<tls-auth>\n${tlsAuth}\n</tls-auth>\nkey-direction 1\n`;
    }

    const configFile = path.join(this.configPath, `${name}.ovpn`);
    fs.writeFileSync(configFile, ovpnConfig);
    logger.info(`OpenVPN config created: ${configFile}`, 'vpn');

    return configFile;
  }

  /**
   * Подключение OpenVPN
   * @param {string} configFile - Путь к конфигурации
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async connectOpenVPN(configFile, options = {}) {
    const { authUserPass } = options;

    try {
      const binary = VPN_CONFIG.openvpn.binary[this.platform];
      const args = [`--config "${configFile}"`, '--daemon'];

      if (authUserPass) {
        const authFile = path.join(this.configPath, 'auth.txt');
        fs.writeFileSync(authFile, authUserPass);
        args.push(`--auth-user-pass "${authFile}"`);
      }

      const command = `"${binary}" ${args.join(' ')}`;

      // Запуск в фоне
      exec(command, error => {
        if (error) {
          logger.error(`OpenVPN error: ${error.message}`, 'vpn');
        }
      });

      // Ожидание подключения
      await new Promise(resolve => setTimeout(resolve, 5000));

      this.currentConnection = { type: 'openvpn', config: configFile };
      logger.info(`OpenVPN connected: ${configFile}`, 'vpn');

      return { success: true, pid: null };
    } catch (error) {
      logger.error(`OpenVPN connect failed: ${error.message}`, 'vpn');
      return { success: false, error: error.message };
    }
  }

  /**
   * Отключение OpenVPN
   * @returns {Promise<boolean>}
   */
  async disconnectOpenVPN() {
    try {
      if (this.platform === 'win32') {
        await execPromise('taskkill /F /IM openvpn.exe');
      } else {
        await execPromise('sudo pkill openvpn');
      }

      this.currentConnection = null;
      logger.info('OpenVPN disconnected', 'vpn');
      return true;
    } catch (error) {
      logger.error(`OpenVPN disconnect failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Отключение любого VPN
   * @returns {Promise<boolean>}
   */
  async disconnect() {
    if (this.currentConnection?.type === 'wireguard') {
      return this.disconnectWireGuard(this.currentConnection.name);
    } else if (this.currentConnection?.type === 'openvpn') {
      return this.disconnectOpenVPN();
    }
    return true;
  }

  /**
   * Проверка статуса подключения
   * @returns {Promise<Object>}
   */
  async getStatus() {
    const status = {
      connected: !!this.currentConnection,
      type: this.currentConnection?.type || null,
      name: this.currentConnection?.name || null,
      ip: null,
      country: null
    };

    if (this.currentConnection) {
      try {
        // Получение внешнего IP
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();

        status.ip = data.ip;
        status.country = data.country_name;
      } catch (error) {
        logger.debug(`Failed to get VPN status: ${error.message}`, 'vpn');
      }
    }

    return status;
  }

  /**
   * Проверка любого активного VPN подключения (включая Amnezia, NordVPN, и др.)
   * @returns {Promise<Object>}
   */
  async detectActiveVPN() {
    const result = {
      detected: false,
      type: null,
      name: null,
      ip: null,
      country: null,
      countryCode: null,
      isp: null,
      isVPN: false,
      isProxy: false,
      isTor: false,
      threat: null,
      vpnMethod: null,
      details: {}
    };

    try {
      const fetch = (await import('node-fetch')).default;

      // Параллельный запрос к нескольким сервисам для надёжности
      const services = [
        { name: 'ipapi', url: 'https://ipapi.co/json/', timeout: 5000 },
        { name: 'ipwho', url: 'https://ipwho.is/', timeout: 5000 },
        { name: 'ipinfo', url: 'https://ipinfo.io/json', timeout: 5000 }
      ];

      let ipData = null;
      let usedService = null;

      for (const service of services) {
        try {
          const response = await fetch(service.url, { timeout: service.timeout });
          if (response.ok) {
            ipData = await response.json();
            usedService = service.name;
            break;
          }
        } catch (error) {
          logger.debug(`IP service ${service.name} failed: ${error.message}`, 'vpn');
          continue;
        }
      }

      if (!ipData) {
        logger.warn('All IP services failed, VPN may be blocking access', 'vpn');
        result.detected = true;
        result.type = 'blocked_ip_services';
        result.vpnMethod = 'blocked_services';
        return result;
      }

      result.ip = ipData.ip || ipData.query;
      result.country = ipData.country_name || ipData.country;
      result.countryCode = ipData.country_code || ipData.countryCode;
      result.isp = ipData.org || ipData.isp || ipData.asn;
      result.details = ipData;

      // Метод 1: Проверка на известные VPN провайдеры по ISP
      const vpnProviders = [
        'Mullvad', 'NordVPN', 'ExpressVPN', 'Surfshark',
        'ProtonVPN', 'CyberGhost', 'PIA', 'Windscribe',
        'Amnezia', 'WireGuard', 'OpenVPN', 'TunnelBear',
        'Hotspot Shield', 'Betternet', 'Psiphon', 'Lantern',
        'Astrill', 'VyprVPN', 'IPVanish', 'StrongVPN',
        'Private Internet Access', 'Cyberghost', 'Kaspersky'
      ];

      const ispLower = (result.isp || '').toLowerCase();
      result.isVPN = vpnProviders.some(v => ispLower.includes(v.toLowerCase()));

      // Метод 2: Проверка через ipapi.co (если доступно поле vpn)
      if (ipData.vpn !== undefined) {
        result.isVPN = result.isVPN || ipData.vpn;
      }

      // Метод 3: Проверка на прокси
      if (ipData.proxy !== undefined) {
        result.isProxy = ipData.proxy;
      }

      // Метод 4: Проверка на Tor
      if (ipData.tor !== undefined) {
        result.isTor = ipData.tor;
      }

      // Метод 5: Проверка на угрозы
      if (ipData.threat !== undefined) {
        result.threat = ipData.threat;
      }

      // Метод 6: Проверка через IP (некоторые страны = VPN)
      const vpnCountries = ['KZ', 'SG', 'NL', 'DE', 'US', 'GB', 'FR', 'FI', 'SE', 'NO', 'DK', 'CH', 'AT', 'BE', 'IT', 'ES', 'PT', 'PL', 'CZ', 'RO', 'HU', 'BG', 'HR', 'SK', 'SI', 'LT', 'LV', 'EE', 'CY', 'MT', 'LU', 'IS', 'IE', 'NZ', 'AU', 'JP', 'KR', 'TW', 'HK', 'AE', 'IL', 'TR', 'ZA', 'BR', 'MX', 'AR', 'CL', 'CO', 'PE'];
      const isForeignIP = vpnCountries.includes(result.countryCode);

      // Метод 7: Проверка через процессы (Windows)
      let processDetected = false;
      if (this.platform === 'win32') {
        processDetected = await this._checkVPNProcesses();
      }

      // Метод 8: Проверка через сетевые интерфейсы
      const interfaceDetected = await this._checkVPNInterfaces();

      // Итоговое определение
      result.detected = result.isVPN || result.isProxy || result.isTor || isForeignIP || processDetected || interfaceDetected;

      if (result.isVPN) {
        result.type = 'known_vpn';
        result.vpnMethod = 'isp_match';
      } else if (result.isProxy) {
        result.type = 'proxy';
        result.vpnMethod = 'proxy_detected';
      } else if (result.isTor) {
        result.type = 'tor';
        result.vpnMethod = 'tor_detected';
      } else if (processDetected) {
        result.type = 'vpn_process';
        result.vpnMethod = 'process_detected';
      } else if (interfaceDetected) {
        result.type = 'vpn_interface';
        result.vpnMethod = 'interface_detected';
      } else if (isForeignIP) {
        result.type = 'foreign_ip';
        result.vpnMethod = 'geo_location';
      } else {
        result.type = 'local';
        result.vpnMethod = 'none';
      }

      result.name = result.isp || result.type;
      result.usedService = usedService;

      logger.info(`VPN detection (${usedService}): ${JSON.stringify({ detected: result.detected, type: result.type, country: result.country, vpn: result.isVPN })}`, 'vpn');

      return result;
    } catch (error) {
      logger.debug(`VPN detection failed: ${error.message}`, 'vpn');
      result.detected = false;
      result.error = error.message;
      return result;
    }
  }

  /**
   * Проверка процессов VPN (Windows)
   * @private
   */
  async _checkVPNProcesses() {
    if (this.platform !== 'win32') {
      return false;
    }

    try {
      const { stdout } = await execPromise('tasklist /FI "STATUS eq RUNNING" 2>nul');
      const processes = stdout.toLowerCase();

      const vpnProcesses = [
        'amnezia', 'wireguard', 'openvpn', 'nordvpn',
        'expressvpn', 'surfshark', 'protonvpn', 'cyberghost',
        'pia', 'windscribe', 'tunnelbear', 'hotspot',
        'betternet', 'psiphon', 'lantern', 'astrill',
        'vyprvpn', 'ipvanish', 'strongvpn', 'kaspersky'
      ];

      const processFound = vpnProcesses.some(proc => processes.includes(proc));

      // Дополнительная проверка для Amnezia через PowerShell
      if (!processFound) {
        try {
          const { stdout: psOutput } = await execPromise(
            'Get-Process | Where-Object {$_.ProcessName -like "*amnezia*" -or $_.ProcessName -like "*awg*"}',
            { shell: 'powershell.exe' }
          );
          return psOutput.trim().length > 0;
        } catch (e) {
          return false;
        }
      }

      return processFound;
    } catch (error) {
      return false;
    }
  }

  /**
   * Проверка сетевых интерфейсов на наличие VPN
   * @private
   */
  async _checkVPNInterfaces() {
    try {
      const interfaces = os.networkInterfaces();

      for (const [name, iface] of Object.entries(interfaces)) {
        const nameLower = name.toLowerCase();
        // Проверка имён интерфейсов (WireGuard, TAP, TUN)
        if (nameLower.includes('wireguard') ||
            nameLower.includes('wg') ||
            nameLower.includes('tun') ||
            nameLower.includes('tap') ||
            nameLower.includes('vpn') ||
            nameLower.includes('amnezia')) {
          return true;
        }

        // Проверка IP адресов интерфейсов
        if (iface) {
          for (const addr of iface) {
            // WireGuard использует специфические диапазоны
            if (addr.address && addr.address.startsWith('10.')) {
              // Дополнительная проверка - если шлюз отличается от стандартного
              return false; // Нужна дополнительная проверка
            }
          }
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получение списка конфигураций
   * @returns {Promise<Array>}
   */
  async getConfigs() {
    try {
      const files = await fs.readdir(this.configPath);
      const configs = [];

      for (const file of files) {
        if (file.endsWith('.conf')) {
          configs.push({
            name: file.replace('.conf', ''),
            type: 'wireguard',
            path: path.join(this.configPath, file)
          });
        } else if (file.endsWith('.ovpn')) {
          configs.push({
            name: file.replace('.ovpn', ''),
            type: 'openvpn',
            path: path.join(this.configPath, file)
          });
        }
      }

      return configs;
    } catch (error) {
      return [];
    }
  }

  /**
   * Удаление конфигурации
   * @param {string} name - Имя конфигурации
   * @returns {Promise<boolean>}
   */
  async deleteConfig(name) {
    try {
      const confFile = path.join(this.configPath, `${name}.conf`);
      const ovpnFile = path.join(this.configPath, `${name}.ovpn`);

      if (await fs.pathExists(confFile)) {
        await fs.remove(confFile);
      }
      if (await fs.pathExists(ovpnFile)) {
        await fs.remove(ovpnFile);
      }

      logger.info(`VPN config deleted: ${name}`, 'vpn');
      return true;
    } catch (error) {
      logger.error(`Delete config failed: ${error.message}`, 'vpn');
      return false;
    }
  }

  /**
   * Генерация ключей WireGuard
   * @returns {Promise<Object>}
   */
  async generateWireGuardKeys() {
    try {
      if (this.platform === 'win32') {
        // Windows требует установленный WireGuard для генерации ключей
        const { stdout: privateKey } = await execPromise('wgen privatekey');
        const { stdout: publicKey } = await execPromise(`echo ${privateKey.trim()} | wgen publickey`);

        return {
          privateKey: privateKey.trim(),
          publicKey: publicKey.trim()
        };
      }
      const { stdout: privateKey } = await execPromise('wg genkey');
      const { stdout: publicKey } = await execPromise(`echo ${privateKey.trim()} | wg pubkey`);

      return {
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim()
      };

    } catch (error) {
      logger.error(`Key generation failed: ${error.message}`, 'vpn');
      return null;
    }
  }

  /**
   * Быстрое подключение к бесплатному VPN
   * @returns {Promise<Object>}
   */
  async quickConnect() {
    logger.info('Quick connect initiated...', 'vpn');

    // Проверка доступных VPN
    const wireguard = await this.checkWireGuard();
    const openvpn = await this.checkOpenVPN();
    const amnezia = await this.checkAmneziaVPN();

    if (!wireguard && !openvpn && !amnezia) {
      return {
        success: false,
        error: 'No VPN client installed. Install WireGuard, OpenVPN or Amnezia VPN.'
      };
    }

    // Отключение текущего подключения
    if (this.currentConnection) {
      await this.disconnect();
    }

    // Получение статуса
    const status = await this.getStatus();

    return {
      success: true,
      message: 'Quick connect completed',
      ...status
    };
  }

  /**
   * Проверка установки Amnezia VPN
   */
  async checkAmneziaVPN() {
    try {
      const binary = VPN_CONFIG.amnezia.binary[this.platform];

      if (this.platform === 'win32') {
        // Проверка через PowerShell
        try {
          const { stdout } = await execPromise(
            `Test-Path "${binary}"`,
            { shell: 'powershell.exe' }
          );
          return stdout.trim().toLowerCase() === 'true';
        } catch (e) {
          return false;
        }
      } else {
        await execPromise(`"${binary}" --version 2>&1 || true`);
        return true;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Получение статуса Amnezia VPN
   */
  async getAmneziaStatus() {
    const result = {
      installed: await this.checkAmneziaVPN(),
      running: false,
      connected: false,
      config: null
    };

    if (!result.installed) {
      return result;
    }

    // Проверка запущенных процессов
    try {
      if (this.platform === 'win32') {
        const { stdout } = await execPromise(
          'Get-Process | Where-Object {$_.ProcessName -like "*amnezia*"}',
          { shell: 'powershell.exe' }
        );
        result.running = stdout.trim().length > 0;
      } else {
        const { stdout } = await execPromise('pgrep -l amnezia || true');
        result.running = stdout.trim().length > 0;
      }
    } catch (e) {
      result.running = false;
    }

    // Проверка подключения через detectActiveVPN
    const activeVPN = await this.detectActiveVPN();
    result.connected = activeVPN.detected && (
      activeVPN.type?.includes('amnezia') ||
      activeVPN.vpnMethod?.includes('amnezia') ||
      activeVPN.isp?.toLowerCase().includes('amnezia')
    );

    return result;
  }

  /**
   * Рекомендации для Amnezia VPN
   */
  getAmneziaRecommendations() {
    const recommendations = [];

    // Amnezia использует WireGuard протокол по умолчанию
    recommendations.push({
      type: 'amnezia',
      title: 'Amnezia VPN обнаружен',
      description: 'Amnezia использует модифицированный WireGuard для обхода блокировок',
      tips: [
        'Используйте протокол AmneziaWG для лучшей производительности',
        'Включите "Maskobka" для маскировки VPN трафика',
        'Настройте DNS через Amnezia (1.1.1.1 или 9.9.9.9)',
        'Включите Kill Switch в настройках Amnezia'
      ]
    });

    return recommendations;
  }
}

// Глобальный экземпляр
export const globalVPNManager = new VPNManager();

export default VPNManager;
