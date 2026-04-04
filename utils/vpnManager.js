/**
 * Enhanced VPN Manager - Улучшенный менеджер VPN с поддержкой AmneziaVPN
 * Обнаружение VPN, интеграция с AmneziaVPN, рекомендации по настройке
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';
import https from 'https';
import http from 'http';
import { logger } from './logger.js';
import { CACHE_CONSTANTS, VPN_CONSTANTS } from './constants.js';

const execPromise = promisify(exec);

// VPN конфигурация
export const VPN_CONFIG = {
  wireguard: {
    name: 'WireGuard',
    binary: {
      win32: 'C:\\Program Files\\WireGuard\\wireguard.exe',
      darwin: '/usr/local/bin/wireguard',
      linux: '/usr/bin/wg'
    }
  },
  openvpn: {
    name: 'OpenVPN',
    binary: {
      win32: 'C:\\Program Files\\OpenVPN\\bin\\openvpn.exe',
      darwin: '/usr/local/bin/openvpn',
      linux: '/usr/sbin/openvpn'
    }
  }
};

class VPNManager {
  constructor() {
    this.detected = false;
    this.vpnType = null;
    this.vpnInfo = {};

    // Платформа
    this.platform = process.platform;

    // Текущее подключение
    this.currentConnection = null;

    // Все подключения
    this.connections = new Map();

    // Путь к конфигурации
    this.configPath = path.join(process.cwd(), 'data', 'vpn-configs');

    // Кэш для IPInfo с TTL для предотвращения частых запросов
    this.ipInfoCache = null;
    this.ipInfoCacheTime = 0;
    this.IP_INFO_CACHE_TTL = CACHE_CONSTANTS.CACHE_CLEANUP_INTERVAL; // 5 минут

    // Поддерживаемые VPN клиенты
    this.vpnClients = {
      amnezia: {
        name: 'AmneziaVPN',
        processes: ['AmneziaVPN', 'AmneziaVPNService'],
        configPaths: {
          win32: [
            path.join(os.homedir(), 'AppData', 'Local', 'AmneziaVPN'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'AmneziaVPN')
          ],
          darwin: [
            path.join(os.homedir(), 'Library', 'Application Support', 'AmneziaVPN')
          ],
          linux: [
            path.join(os.homedir(), '.config', 'AmneziaVPN'),
            '/etc/amneziavpn'
          ]
        }
      },
      openvpn: {
        name: 'OpenVPN',
        processes: ['openvpn', 'openvpn-gui'],
        configPaths: {
          win32: [
            path.join(os.homedir(), 'OpenVPN', 'config'),
            'C:\\Program Files\\OpenVPN\\config'
          ],
          darwin: [
            '/usr/local/etc/openvpn'
          ],
          linux: [
            '/etc/openvpn'
          ]
        }
      },
      wireguard: {
        name: 'WireGuard',
        processes: ['wireguard', 'wg', 'WireGuard'],
        configPaths: {
          win32: [
            path.join(os.homedir(), 'AppData', 'Local', 'WireGuard')
          ],
          darwin: [
            '/etc/wireguard',
            '/usr/local/etc/wireguard'
          ],
          linux: [
            '/etc/wireguard'
          ]
        }
      },
      v2ray: {
        name: 'V2Ray/XRay',
        processes: ['v2ray', 'xray', 'v2rayN'],
        configPaths: {
          win32: [
            path.join(os.homedir(), 'AppData', 'Local', 'v2rayN')
          ],
          darwin: [
            path.join(os.homedir(), '.config', 'v2ray')
          ],
          linux: [
            path.join(os.homedir(), '.config', 'v2ray'),
            '/etc/v2ray'
          ]
        }
      },
      clash: {
        name: 'Clash',
        processes: ['clash', 'clash-for-windows', 'Clash'],
        configPaths: {
          win32: [
            path.join(os.homedir(), '.config', 'clash'),
            path.join(os.homedir(), 'AppData', 'Local', 'clash')
          ],
          darwin: [
            path.join(os.homedir(), '.config', 'clash')
          ],
          linux: [
            path.join(os.homedir(), '.config', 'clash')
          ]
        }
      }
    };

    // AmneziaVPN протоколы
    this.amneziaProtocols = [
      { id: 'awg', name: 'AmneziaWG', recommended: true, obfuscation: true },
      { id: 'openvpn', name: 'OpenVPN over Cloak', recommended: true, obfuscation: true },
      { id: 'xray', name: 'XRay', recommended: true, obfuscation: true },
      { id: 'wireguard', name: 'WireGuard', recommended: false, obfuscation: false },
      { id: 'openvpn-adtls', name: 'OpenVPN over AmneziaTLS', recommended: true, obfuscation: true }
    ];

    // Рекомендуемые конфигурации для Cursor
    this.cursorOptimizedConfigs = {
      preferredProtocol: 'awg',
      preferredCountries: ['NL', 'DE', 'FI', 'CH', 'SG', 'JP'],
      avoidCountries: ['RU', 'BY', 'CN', 'IR'],
      features: {
        killSwitch: true,
        dns: '1.1.1.1',
        splitTunneling: false
      }
    };
  }

  /**
   * Обнаружение активного VPN
   */
  async detectActiveVPN() {
    const result = {
      detected: false,
      type: null,
      name: null,
      ip: null,
      country: null,
      countryCode: null,
      city: null,
      isObfuscated: false,
      protocols: []
    };

    try {
      // 1. Проверяем IP адрес
      const ipInfo = await this.getIPInfo();

      if (ipInfo) {
        result.ip = ipInfo.ip;
        result.country = ipInfo.country;
        result.countryCode = ipInfo.countryCode;
        result.city = ipInfo.city;
      }

      // 2. Проверяем запущенные процессы VPN
      const runningVPNs = await this.detectRunningVPNProcesses();

      if (runningVPNs.length > 0) {
        result.detected = true;
        result.type = runningVPNs[0].type;
        result.name = runningVPNs[0].name;
        result.isObfuscated = this.checkObfuscation(runningVPNs[0].type);
      }

      // 3. Проверяем сетевые интерфейсы
      const interfaces = this.checkVPNInterfaces();
      if (interfaces.length > 0) {
        result.detected = true;
        result.interfaces = interfaces;
      }

      // 4. Проверяем AmneziaVPN отдельно
      const amneziaStatus = await this.getAmneziaStatus();
      if (amneziaStatus.installed) {
        result.amneziaInstalled = true;
        if (amneziaStatus.connected) {
          result.detected = true;
          result.type = 'amnezia';
          result.name = 'AmneziaVPN';
          result.protocol = amneziaStatus.protocol;
          result.isObfuscated = amneziaStatus.isObfuscated;
        }
      }

      this.detected = result.detected;
      this.vpnType = result.type;
      this.vpnInfo = result;

      logger.info(`VPN detection: ${result.detected ? result.name : 'Not detected'}`, 'vpn');

    } catch (error) {
      logger.warn(`VPN detection error: ${error.message}`, 'vpn');
    }

    return result;
  }

  /**
   * Получение информации об IP (с кэшированием)
   */
  async getIPInfo() {
    const now = Date.now();

    // Проверка кэша
    if (this.ipInfoCache && (now - this.ipInfoCacheTime) < this.IP_INFO_CACHE_TTL) {
      return this.ipInfoCache;
    }

    // Запрос к API
    const result = await new Promise(resolve => {
      const timeout = setTimeout(() => resolve(null), VPN_CONSTANTS.VPN_API_TIMEOUT);

      http.get('http://ip-api.com/json/', res => {
        clearTimeout(timeout);
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === 'success') {
              resolve({
                ip: json.query,
                country: json.country,
                countryCode: json.countryCode,
                city: json.city,
                isp: json.isp,
                org: json.org
              });
            } else {
              resolve(null);
            }
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });

    // Сохранение в кэш
    if (result) {
      this.ipInfoCache = result;
      this.ipInfoCacheTime = now;
    }

    return result;
  }

  /**
   * Обнаружение запущенных VPN процессов
   */
  async detectRunningVPNProcesses() {
    const running = [];
    const platform = os.platform();

    try {
      let processList = '';

      if (platform === 'win32') {
        const { stdout } = await execPromise('tasklist 2>nul');
        processList = stdout.toLowerCase();
      } else {
        const { stdout } = await execPromise('ps aux 2>/dev/null || ps -ef 2>/dev/null');
        processList = stdout.toLowerCase();
      }

      for (const [type, client] of Object.entries(this.vpnClients)) {
        for (const proc of client.processes) {
          if (processList.includes(proc.toLowerCase())) {
            running.push({ type, name: client.name, process: proc });
            break;
          }
        }
      }
    } catch (error) {
      logger.debug(`Process detection error: ${error.message}`, 'vpn');
    }

    return running;
  }

  /**
   * Проверка VPN интерфейсов
   */
  checkVPNInterfaces() {
    const interfaces = os.networkInterfaces();
    const vpnInterfaces = [];

    const vpnInterfaceNames = ['tun', 'tap', 'wg', 'ppp', 'utun', 'en0', 'wintun'];

    for (const [name, addrs] of Object.entries(interfaces)) {
      const nameLower = name.toLowerCase();

      if (vpnInterfaceNames.some(vpn => nameLower.includes(vpn))) {
        vpnInterfaces.push({
          name,
          addresses: addrs.filter(a => !a.internal).map(a => ({
            address: a.address,
            family: a.family,
            mac: a.mac
          }))
        });
      }
    }

    return vpnInterfaces;
  }

  /**
   * Проверка обфускации
   */
  checkObfuscation(vpnType) {
    const obfuscatedTypes = ['amnezia', 'v2ray', 'clash'];
    return obfuscatedTypes.includes(vpnType);
  }

  /**
   * Получение статуса AmneziaVPN
   */
  async getAmneziaStatus() {
    const result = {
      installed: false,
      running: false,
      connected: false,
      protocol: null,
      country: null,
      isObfuscated: true
    };

    const platform = os.platform();
    const amnezia = this.vpnClients.amnezia;

    try {
      // Проверка установки
      const configPaths = amnezia.configPaths[platform] || [];

      for (const configPath of configPaths) {
        if (await fs.pathExists(configPath)) {
          result.installed = true;
          result.configPath = configPath;

          // Проверяем конфигурацию
          const config = await this.parseAmneziaConfig(configPath);
          if (config) {
            result.protocol = config.protocol;
            result.country = config.country;
          }
          break;
        }
      }

      // Проверка процесса
      let processList = '';
      if (platform === 'win32') {
        const { stdout } = await execPromise('tasklist 2>nul');
        processList = stdout.toLowerCase();
      } else {
        const { stdout } = await execPromise('ps aux 2>/dev/null || ps -ef 2>/dev/null');
        processList = stdout.toLowerCase();
      }

      for (const proc of amnezia.processes) {
        if (processList.includes(proc.toLowerCase())) {
          result.running = true;
          break;
        }
      }

      // Проверка соединения через API (если доступен)
      try {
        const { stdout } = await execPromise(
          platform === 'win32'
            ? 'curl -s http://127.0.0.1:15015/api/v1/state 2>nul'
            : 'curl -s http://127.0.0.1:15015/api/v1/state 2>/dev/null'
        );

        const state = JSON.parse(stdout);
        result.connected = state.connected || false;
        result.protocol = state.protocol || result.protocol;
      } catch {
        // API недоступен, проверяем через интерфейсы
        const vpnInterfaces = this.checkVPNInterfaces();
        result.connected = vpnInterfaces.length > 0;
      }

    } catch (error) {
      logger.debug(`AmneziaVPN check error: ${error.message}`, 'vpn');
    }

    return result;
  }

  /**
   * Парсинг конфигурации AmneziaVPN
   */
  async parseAmneziaConfig(configPath) {
    try {
      const config = await fs.readFile(path.join(configPath, 'config.json'), 'utf8');
      const json = JSON.parse(config);

      return {
        protocol: json.protocol || json.currentProtocol || 'unknown',
        country: json.countryCode || json.country,
        server: json.server,
        port: json.port
      };
    } catch {
      return null;
    }
  }

  /**
   * Рекомендации по AmneziaVPN для Cursor
   */
  getAmneziaRecommendations() {
    const recommendations = [];

    // Добавляем рекомендации по протоколам
    this.amneziaProtocols
      .filter(p => p.recommended)
      .forEach(protocol => {
        recommendations.push({
          type: 'protocol',
          priority: 'high',
          title: `Используйте ${protocol.name}`,
          description: `${protocol.obfuscation ? 'Обфускация включена' : 'Стандартный протокол'} для лучшей производительности`
        });
      });

    // Добавляем рекомендации по настройкам
    recommendations.push({
      type: 'settings',
      priority: 'high',
      title: 'Включите Kill Switch',
      description: 'Защитит от утечек при разрыве соединения'
    });

    recommendations.push({
      type: 'settings',
      priority: 'medium',
      title: 'Настройте DNS на 1.1.1.1',
      description: 'Предотвратит утечки DNS запросов'
    });

    // Добавляем рекомендации по серверам
    this.cursorOptimizedConfigs.preferredCountries.forEach(country => {
      recommendations.push({
        type: 'server',
        priority: 'low',
        title: `Сервер в ${country}`,
        description: 'Минимальная задержка и стабильное соединение'
      });
    });

    return recommendations;
  }

  /**
   * Генерация конфигурации для Cursor
   */
  generateCursorConfig(protocol = 'awg') {
    return {
      protocol,
      settings: {
        dns: '1.1.1.1',
        killSwitch: true,
        splitTunneling: false,
        autoConnect: true,
        preferredServers: this.cursorOptimizedConfigs.preferredCountries
      },
      optimizations: {
        mtu: 1420,
        keepalive: 25,
        timeout: 30
      }
    };
  }

  /**
   * Проверка оптимальности VPN для Cursor
   */
  async checkVPNForCursor() {
    const vpnStatus = await this.detectActiveVPN();
    const analysis = {
      suitable: false,
      score: 0,
      issues: [],
      recommendations: []
    };

    if (!vpnStatus.detected) {
      analysis.issues.push({
        type: 'no_vpn',
        severity: 'critical',
        message: 'VPN не обнаружен'
      });
      analysis.recommendations.push({
        priority: 'high',
        action: 'install_vpn',
        message: 'Установите AmneziaVPN для обхода блокировок'
      });
      return analysis;
    }

    // Проверка обфускации
    if (!vpnStatus.isObfuscated) {
      analysis.issues.push({
        type: 'no_obfuscation',
        severity: 'high',
        message: 'VPN без обфускации может быть заблокирован'
      });
      analysis.score -= 30;
    } else {
      analysis.score += 40;
    }

    // Проверка страны
    if (vpnStatus.countryCode) {
      if (this.cursorOptimizedConfigs.avoidCountries.includes(vpnStatus.countryCode)) {
        analysis.issues.push({
          type: 'blocked_country',
          severity: 'high',
          message: `Страна ${vpnStatus.country} может иметь ограничения`
        });
        analysis.score -= 20;
      } else if (this.cursorOptimizedConfigs.preferredCountries.includes(vpnStatus.countryCode)) {
        analysis.score += 30;
      }
    }

    // Проверка утечек
    const leakCheck = await this.checkVPNLeaks();
    if (leakCheck.hasLeaks) {
      analysis.issues.push({
        type: 'leak',
        severity: 'critical',
        message: 'Обнаружены утечки через VPN'
      });
      analysis.score -= 40;
    }

    // Финальная оценка
    analysis.suitable = analysis.score >= 50;
    analysis.score = Math.max(0, Math.min(100, analysis.score + 50));

    return analysis;
  }

  /**
   * Проверка утечек через VPN
   */
  async checkVPNLeaks() {
    const result = {
      hasLeaks: false,
      dns: false,
      webrtc: false,
      ipv6: false
    };

    try {
      // Проверка DNS утечек
      const dnsIP = await this.getDNSLeakIP();
      const vpnIP = await this.getVPNIP();

      if (dnsIP && vpnIP && dnsIP !== vpnIP) {
        result.dns = true;
        result.hasLeaks = true;
      }

      // Проверка IPv6
      const interfaces = os.networkInterfaces();
      for (const addrs of Object.values(interfaces)) {
        for (const addr of addrs) {
          if (addr.family === 'IPv6' && !addr.internal && !addr.address.startsWith('fe80:')) {
            result.ipv6 = true;
            result.hasLeaks = true;
          }
        }
      }
    } catch (error) {
      logger.debug(`Leak check error: ${error.message}`, 'vpn');
    }

    return result;
  }

  /**
   * Получение IP через DNS
   */
  async getDNSLeakIP() {
    try {
      const { stdout } = await execPromise('nslookup whoami.akamai.net. 2>nul');
      const match = stdout.match(/Address:\s*(\d+\.\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Получение VPN IP
   */
  async getVPNIP() {
    return new Promise(resolve => {
      const timeout = setTimeout(() => resolve(null), VPN_CONSTANTS.VPN_API_TIMEOUT);

      https.get('https://api.ipify.org?format=json', res => {
        clearTimeout(timeout);
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.ip);
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  }

  /**
   * Инструкция по установке AmneziaVPN
   */
  getInstallationGuide() {
    const platform = os.platform();

    const guides = {
      win32: {
        download: 'https://amnezia.org/ru/downloads',
        steps: [
          'Скачайте AmneziaVPN с официального сайта',
          'Запустите установщик и следуйте инструкциям',
          'Настройте свой сервер или используйте готовый конфиг',
          'Выберите протокол AmneziaWG для лучшей обфускации',
          'Подключитесь к серверу в Нидерландах или Германии'
        ]
      },
      darwin: {
        download: 'https://amnezia.org/ru/downloads',
        steps: [
          'Скачайте AmneziaVPN для macOS',
          'Переместите приложение в Applications',
          'Запустите и разрешите VPN конфигурацию',
          'Настройте подключение через AmneziaWG',
          'Подключитесь к серверу'
        ]
      },
      linux: {
        download: 'https://amnezia.org/ru/downloads',
        steps: [
          'Скачайте .AppImage или используйте Flatpak',
          'chmod +x AmneziaVPN.AppImage',
          'Запустите ./AmneziaVPN.AppImage',
          'Настройте подключение',
          'Подключитесь к серверу'
        ]
      }
    };

    return guides[platform] || guides.win32;
  }

  /**
   * Создать конфигурацию WireGuard
   */
  createWireGuardConfig(config) {
    const { privateKey, address, dns, peers = [] } = config;

    let wgConfig = `[Interface]\n`;
    wgConfig += `PrivateKey = ${privateKey}\n`;
    wgConfig += `Address = ${address}\n`;
    if (dns) {
      wgConfig += `DNS = ${dns}\n`;
    }

    peers.forEach(peer => {
      wgConfig += `\n[Peer]\n`;
      wgConfig += `PublicKey = ${peer.publicKey}\n`;
      if (peer.endpoint) {
        wgConfig += `Endpoint = ${peer.endpoint}\n`;
      }
      if (peer.allowedIPs) {
        wgConfig += `AllowedIPs = ${peer.allowedIPs.join(', ')}\n`;
      }
    });

    return wgConfig;
  }

  /**
   * Создать конфигурацию OpenVPN
   */
  createOpenVPNConfig(config) {
    const { remote, port, proto = 'udp' } = config;

    let ovpnConfig = `client\n`;
    ovpnConfig += `dev tun\n`;
    ovpnConfig += `proto ${proto}\n`;
    ovpnConfig += `remote ${remote} ${port}\n`;
    ovpnConfig += `resolv-retry infinite\n`;
    ovpnConfig += `nobind\n`;
    ovpnConfig += `persist-key\n`;
    ovpnConfig += `persist-tun\n`;
    ovpnConfig += `remote-cert-tls server\n`;
    ovpnConfig += `verb 3\n`;

    return ovpnConfig;
  }

  /**
   * Проверка доступности WireGuard
   */
  async checkWireGuard() {
    const platform = os.platform();
    const binary = VPN_CONFIG.wireguard.binary[platform] || VPN_CONFIG.wireguard.binary.linux;

    try {
      await fs.access(binary);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Проверка доступности OpenVPN
   */
  async checkOpenVPN() {
    const platform = os.platform();
    const binary = VPN_CONFIG.openvpn.binary[platform] || VPN_CONFIG.openvpn.binary.linux;

    try {
      await fs.access(binary);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Проверка доступности AmneziaVPN
   */
  async checkAmneziaVPN() {
    const status = await this.getAmneziaStatus();
    return status.installed;
  }

  /**
   * Быстрое подключение к VPN
   */
  async quickConnect() {
    try {
      // Пытаемся подключиться через AmneziaVPN
      const amneziaStatus = await this.getAmneziaStatus();

      if (amneziaStatus.installed) {
        this.currentConnection = {
          type: 'amnezia',
          connected: amneziaStatus.connected,
          protocol: amneziaStatus.protocol,
          timestamp: Date.now()
        };

        this.connections.set('amnezia', this.currentConnection);

        return {
          success: true,
          connected: amneziaStatus.connected,
          type: 'amnezia'
        };
      }

      // Проверяем другие VPN
      const runningVPNs = await this.detectRunningVPNProcesses();

      if (runningVPNs.length > 0) {
        const vpn = runningVPNs[0];
        this.currentConnection = {
          type: vpn.type,
          connected: true,
          timestamp: Date.now()
        };

        this.connections.set(vpn.type, this.currentConnection);

        return {
          success: true,
          connected: true,
          type: vpn.type
        };
      }

      return {
        success: false,
        connected: false,
        error: 'No VPN clients detected'
      };
    } catch (error) {
      logger.error(`Quick connect error: ${error.message}`, 'vpn');
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Получить статус
   */
  getStatus() {
    return {
      detected: this.detected,
      type: this.vpnType,
      info: this.vpnInfo,
      connected: this.currentConnection?.connected || false,
      currentConnection: this.currentConnection,
      connectionsCount: this.connections.size
    };
  }

  /**
   * Инициализация менеджера
   */
  async init() {
    logger.info('VPN Manager initialized', 'vpn');
    return this;
  }

  /**
   * Остановка менеджера (для graceful shutdown)
   */
  stop() {
    // Очистка кэшей
    this.ipInfoCache.clear();
    this.ipInfoCacheTime = 0;
    logger.info('VPN Manager stopped', 'vpn');
    return true;
  }
}

// Singleton
export const globalVPNManager = new VPNManager();
export default VPNManager;
export { VPNManager };
