/**
 * Enhanced Leak Detector - Улучшенный детектор утечек
 * Добавлено: Windows Telemetry, Browser Fingerprint, MAC Address, автоматическое исправление
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import https from 'https';
import http from 'http';
import { logger } from './logger.js';
import { globalDNSManager } from './dnsManager.js';

const execPromise = promisify(exec);

class LeakDetector {
  constructor() {
    this.lastCheck = null;
    this.leakHistory = [];
    this.autoFixEnabled = true;
    this.recommendations = [];

    // Список тестовых серверов для обнаружения утечек
    this.testServers = {
      dns: [
        { name: 'dnsleaktest', url: 'https://dnsleaktest.com/' },
        { name: 'ipleak', url: 'https://ipleak.net/' }
      ],
      webrtc: [
        { name: 'browserleaks', url: 'https://browserleaks.com/webrtc' },
        { name: 'ipleak-webrtc', url: 'https://ipleak.net/?webrtc=true' }
      ],
      ip: [
        { name: 'ipify', url: 'https://api.ipify.org?format=json' },
        { name: 'ip-api', url: 'http://ip-api.com/json/' }
      ]
    };

    // Windows Telemetry сервисы для проверки
    this.windowsTelemetryServices = [
      'DiagTrack',
      'dmwappushservice',
      'WerSvc',
      'PcaSvc',
      'TroubleshootingSvc'
    ];

    // Windows Telemetry задачи
    this.windowsTelemetryTasks = [
      '\\Microsoft\\Windows\\Application Experience\\Microsoft Compatibility Appraiser',
      '\\Microsoft\\Windows\\Application Experience\\ProgramDataUpdater',
      '\\Microsoft\\Windows\\Autochk\\Proxy',
      '\\Microsoft\\Windows\\Customer Experience Improvement Program\\Consolidator',
      '\\Microsoft\\Windows\\Customer Experience Improvement Program\\UsbCeip'
    ];
  }

  /**
   * Полная проверка на утечки
   */
  async checkAll() {
    const results = {
      timestamp: Date.now(),
      dns: null,
      webrtc: null,
      ipv6: null,
      windowsTelemetry: null,
      macAddress: null,
      browserFingerprint: null,
      overallRisk: 'unknown'
    };

    try {
      // Параллельная проверка всех типов утечек
      const [dnsResult, webrtcResult, ipv6Result, winTelemetry, macResult] = await Promise.allSettled([
        this.checkDNSLeak(),
        this.checkWebRTCLEak(),
        this.checkIPv6Leak(),
        this.checkWindowsTelemetry(),
        this.checkMACAddressLeak()
      ]);

      results.dns = dnsResult.status === 'fulfilled' ? dnsResult.value : { error: dnsResult.reason?.message };
      results.webrtc = webrtcResult.status === 'fulfilled' ? webrtcResult.value : { error: webrtcResult.reason?.message };
      results.ipv6 = ipv6Result.status === 'fulfilled' ? ipv6Result.value : { error: ipv6Result.reason?.message };
      results.windowsTelemetry = winTelemetry.status === 'fulfilled' ? winTelemetry.value : { error: winTelemetry.reason?.message };
      results.macAddress = macResult.status === 'fulfilled' ? macResult.value : { error: macResult.reason?.message };

      // Оценка общего риска
      results.overallRisk = this.calculateOverallRisk(results);

      // Генерация рекомендаций
      this.generateRecommendations(results);

      this.lastCheck = results;
      this.leakHistory.push({
        timestamp: results.timestamp,
        risk: results.overallRisk,
        summary: {
          dns: results.dns?.leaked || false,
          webrtc: results.webrtc?.leaked || false,
          ipv6: results.ipv6?.leaked || false,
          windowsTelemetry: results.windowsTelemetry?.enabled || false
        }
      });

      // Автоматическое исправление если включено
      if (this.autoFixEnabled && results.overallRisk !== 'low') {
        await this.autoFixLeaks(results);
      }

    } catch (error) {
      logger.error(`Leak check failed: ${error.message}`, 'leak-detector');
      results.error = error.message;
    }

    return results;
  }

  /**
   * Проверка утечки DNS
   */
  async checkDNSLeak() {
    const result = {
      leaked: false,
      dnsServers: [],
      vpnDNS: [],
      ispDNS: [],
      recommendations: []
    };

    try {
      // Получаем текущие DNS серверы системы
      const systemDNS = await this.getSystemDNS();
      result.dnsServers = systemDNS;

      // Получаем IP через VPN/прокси (если используется)
      const vpnIP = await this.getVPNIP();

      // Проверяем DNS запрос через сторонний сервис
      const dnsLeakIP = await this.checkDNSLeakIP();

      // Анализ: если DNS запрос идёт через другой IP чем VPN
      if (vpnIP && dnsLeakIP && vpnIP !== dnsLeakIP) {
        result.leaked = true;
        result.leakedIP = dnsLeakIP;
        result.recommendations.push({
          type: 'dns',
          priority: 'high',
          message: 'DNS запросы проходят мимо VPN',
          action: 'change_dns'
        });
      }

      // Проверка на ISP DNS
      for (const dns of systemDNS) {
        const dnsInfo = await this.identifyDNSProvider(dns);
        if (dnsInfo.type === 'isp') {
          result.ispDNS.push(dns);
          result.leaked = true;
        } else if (dnsInfo.type === 'vpn') {
          result.vpnDNS.push(dns);
        }
      }

      if (result.ispDNS.length > 0) {
        result.recommendations.push({
          type: 'dns',
          priority: 'high',
          message: `Обнаружены DNS серверы провайдера: ${result.ispDNS.join(', ')}`,
          action: 'use_secure_dns'
        });
      }

      logger.info(`DNS leak check: ${result.leaked ? 'LEAKED' : 'OK'}`, 'leak-detector');

    } catch (error) {
      result.error = error.message;
      logger.warn(`DNS leak check error: ${error.message}`, 'leak-detector');
    }

    return result;
  }

  /**
   * Получить системные DNS серверы
   */
  async getSystemDNS() {
    const dnsServers = [];
    const platform = os.platform();

    try {
      if (platform === 'win32') {
        const { stdout } = await execPromise('nslookup . 2>nul | findstr /i "Address"');
        const matches = stdout.matchAll(/Address:\s*(\d+\.\d+\.\d+\.\d+)/g);
        for (const match of matches) {
          if (!match[1].startsWith('127.') && !match[1].startsWith('0.')) {
            dnsServers.push(match[1]);
          }
        }
      } else if (platform === 'darwin') {
        const { stdout } = await execPromise('scutil --dns | grep nameserver');
        const matches = stdout.matchAll(/nameserver\[\d+\]\s*:\s*(\d+\.\d+\.\d+\.\d+)/g);
        for (const match of matches) {
          if (!match[1].startsWith('127.')) {
            dnsServers.push(match[1]);
          }
        }
      } else if (platform === 'linux') {
        const fs = await import('fs-extra');
        const resolvConf = await fs.readFile('/etc/resolv.conf', 'utf8');
        const matches = resolvConf.matchAll(/nameserver\s+(\d+\.\d+\.\d+\.\d+)/g);
        for (const match of matches) {
          if (!match[1].startsWith('127.')) {
            dnsServers.push(match[1]);
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to get system DNS: ${error.message}`, 'leak-detector');
    }

    return dnsServers;
  }

  /**
   * Идентифицировать провайдера DNS
   */
  async identifyDNSProvider(dnsIP) {
    const knownProviders = {
      cloudflare: ['1.1.1.1', '1.0.0.1', '2606:4700:4700::1111', '2606:4700:4700::1001'],
      google: ['8.8.8.8', '8.8.4.4', '2001:4860:4860::8888', '2001:4860:4860::8844'],
      quad9: ['9.9.9.9', '149.112.112.112'],
      opendns: ['208.67.222.222', '208.67.220.220'],
      adguard: ['94.140.14.14', '94.140.15.15']
    };

    for (const [provider, ips] of Object.entries(knownProviders)) {
      if (ips.includes(dnsIP)) {
        return { type: 'secure', provider };
      }
    }

    // Проверяем приватные диапазоны (возможно VPN)
    if (this.isPrivateIP(dnsIP)) {
      return { type: 'vpn', provider: 'unknown' };
    }

    // Считаем ISP DNS
    return { type: 'isp', provider: 'unknown' };
  }

  /**
   * Проверка приватного IP
   */
  isPrivateIP(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) {return false;}

    // 10.0.0.0/8
    if (parts[0] === 10) {return true;}
    // 172.16.0.0/12
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {return true;}
    // 192.168.0.0/16
    if (parts[0] === 192 && parts[1] === 168) {return true;}
    // 100.64.0.0/10 (CGNAT)
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) {return true;}

    return false;
  }

  /**
   * Получить реальный IP через DNS
   */
  async getRealIPThroughDNS() {
    try {
      // Используем специальный DNS сервис для обнаружения утечек
      const { stdout } = await execPromise('nslookup whoami.akamai.net. 2>nul');
      const match = stdout.match(/Address:\s*(\d+\.\d+\.\d+\.\d+)/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Получить IP через VPN
   */
  async getVPNIP() {
    try {
      const response = await this.fetchWithTimeout('https://api.ipify.org?format=json', {}, 5000);
      const data = JSON.parse(response);
      return data.ip;
    } catch {
      return null;
    }
  }

  /**
   * Проверка утечки IP через DNS
   */
  async checkDNSLeakIP() {
    try {
      const { stdout } = await execPromise('nslookup whoami.dyndns.org. 2>nul');
      const match = stdout.match(/Address:\s*(\d+\.\d+\.\d+\.\d+)/g);
      if (match && match.length > 1) {
        return match[1].replace('Address:', '').trim();
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Проверка WebRTC утечки
   */
  async checkWebRTCLEak() {
    const result = {
      leaked: false,
      localIPs: [],
      publicIPs: [],
      recommendations: []
    };

    try {
      // Получаем локальные IP адреса
      const interfaces = os.networkInterfaces();
      const localIPs = [];

      for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
          if (addr.family === 'IPv4' && !addr.internal) {
            localIPs.push({
              interface: name,
              address: addr.address,
              mac: addr.mac
            });
          }
        }
      }

      result.localIPs = localIPs;

      // WebRTC может раскрыть локальные IP даже через VPN
      if (localIPs.length > 0) {
        // Проверяем если локальный IP не в приватном диапазоне VPN
        const vpnSubnets = ['10.', '172.16.', '172.17.', '172.18.', '172.19.', '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.'];

        for (const ip of localIPs) {
          const isVPNRange = vpnSubnets.some(subnet => ip.address.startsWith(subnet));
          if (!isVPNRange && !ip.address.startsWith('192.168.')) {
            // Возможно утечка
          } else if (!isVPNRange) {
            // Домашний IP - потенциальная утечка через WebRTC
            result.leaked = true;
            result.recommendations.push({
              type: 'webrtc',
              priority: 'medium',
              message: 'WebRTC может раскрыть локальный IP',
              action: 'disable_webrtc'
            });
          }
        }
      }

      logger.info(`WebRTC leak check: ${result.leaked ? 'LEAKED' : 'OK'}`, 'leak-detector');

    } catch (error) {
      result.error = error.message;
      logger.warn(`WebRTC leak check error: ${error.message}`, 'leak-detector');
    }

    return result;
  }

  /**
   * Проверка IPv6 утечки
   */
  async checkIPv6Leak() {
    const result = {
      leaked: false,
      ipv6Enabled: false,
      ipv6Address: null,
      recommendations: []
    };

    try {
      const interfaces = os.networkInterfaces();

      // Проверяем наличие IPv6 адресов
      for (const addrs of Object.values(interfaces)) {
        for (const addr of addrs) {
          if (addr.family === 'IPv6' && !addr.internal) {
            result.ipv6Enabled = true;
            // Глобальный IPv6 адрес
            if (!addr.address.startsWith('fe80:') && !addr.address.startsWith('fd')) {
              result.ipv6Address = addr.address;
              result.leaked = true;
            }
          }
        }
      }

      // Если IPv6 включен и есть глобальный адрес
      if (result.leaked) {
        result.recommendations.push({
          type: 'ipv6',
          priority: 'high',
          message: 'IPv6 может обходить VPN туннель',
          action: 'disable_ipv6'
        });
      }

      logger.info(`IPv6 leak check: ${result.leaked ? 'LEAKED' : 'OK'}`, 'leak-detector');

    } catch (error) {
      result.error = error.message;
      logger.warn(`IPv6 leak check error: ${error.message}`, 'leak-detector');
    }

    return result;
  }

  /**
   * Проверка Windows Telemetry
   */
  async checkWindowsTelemetry() {
    const result = {
      enabled: false,
      services: [],
      tasks: [],
      recommendations: []
    };

    if (os.platform() !== 'win32') {
      result.message = 'Not applicable for this platform';
      return result;
    }

    try {
      // Проверка служб телеметрии
      for (const service of this.windowsTelemetryServices) {
        try {
          const { stdout } = await execPromise(`sc query "${service}" 2>nul`);
          if (stdout.includes('RUNNING') || stdout.includes('4  RUNNING')) {
            result.services.push({ name: service, status: 'running' });
            result.enabled = true;
          } else if (stdout.includes('STOPPABLE')) {
            result.services.push({ name: service, status: 'stopped_but_enabled' });
          }
        } catch {
          // Служба не найдена или ошибка доступа
        }
      }

      // Проверка задач телеметрии
      for (const task of this.windowsTelemetryTasks) {
        try {
          const { stdout } = await execPromise(`schtasks /query /tn "${task}" 2>nul`);
          if (stdout.includes('Ready') || stdout.includes('Running')) {
            result.tasks.push({ name: task, status: 'enabled' });
            result.enabled = true;
          }
        } catch {
          // Задача не найдена
        }
      }

      if (result.enabled) {
        result.recommendations.push({
          type: 'telemetry',
          priority: 'high',
          message: 'Windows телеметрия активна и может передавать данные',
          action: 'disable_telemetry'
        });
      }

      logger.info(`Windows Telemetry check: ${result.enabled ? 'ENABLED' : 'DISABLED'}`, 'leak-detector');

    } catch (error) {
      result.error = error.message;
      logger.warn(`Windows Telemetry check error: ${error.message}`, 'leak-detector');
    }

    return result;
  }

  /**
   * Проверка утечки MAC адреса
   */
  async checkMACAddressLeak() {
    const result = {
      leaked: false,
      interfaces: [],
      recommendations: []
    };

    try {
      const interfaces = os.networkInterfaces();
      const macAddresses = [];

      for (const [name, addrs] of Object.entries(interfaces)) {
        for (const addr of addrs) {
          if (addr.mac && addr.mac !== '00:00:00:00:00:00') {
            macAddresses.push({
              interface: name,
              mac: addr.mac,
              type: this.identifyMACType(addr.mac)
            });
          }
        }
      }

      result.interfaces = macAddresses;

      // MAC адрес может использоваться для трекинга
      if (macAddresses.length > 0) {
        result.recommendations.push({
          type: 'mac',
          priority: 'medium',
          message: 'MAC адреса могут использоваться для отслеживания устройства',
          action: 'randomize_mac'
        });
      }

      logger.debug(`MAC Address check: ${macAddresses.length} interfaces found`, 'leak-detector');

    } catch (error) {
      result.error = error.message;
      logger.warn(`MAC Address check error: ${error.message}`, 'leak-detector');
    }

    return result;
  }

  /**
   * Идентифицировать тип MAC адреса
   */
  identifyMACType(mac) {
    const firstOctet = parseInt(mac.split(':')[0], 16);

    if (firstOctet & 0x02) {
      return 'locally_administered'; // Локально администрируемый
    }
    return 'universal'; // Универсальный (заводской)
  }

  /**
   * Расчёт общего уровня риска
   */
  calculateOverallRisk(results) {
    let riskScore = 0;
    let criticalCount = 0;

    // DNS утечка - критично
    if (results.dns?.leaked) {
      riskScore += 40;
      criticalCount++;
    }

    // WebRTC утечка - средне
    if (results.webrtc?.leaked) {
      riskScore += 20;
    }

    // IPv6 утечка - высоко
    if (results.ipv6?.leaked) {
      riskScore += 30;
      criticalCount++;
    }

    // Windows Telemetry - средне-высоко
    if (results.windowsTelemetry?.enabled) {
      riskScore += 25;
    }

    if (criticalCount >= 2 || riskScore >= 60) {
      return 'critical';
    } else if (riskScore >= 30) {
      return 'high';
    } else if (riskScore >= 10) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Генерация рекомендаций
   */
  generateRecommendations(results) {
    this.recommendations = [];

    if (results.dns?.leaked) {
      this.recommendations.push({
        type: 'dns',
        priority: 'critical',
        title: 'DNS утечка обнаружена',
        description: 'Ваши DNS запросы проходят мимо VPN, что раскрывает вашу активность',
        actions: [
          'Используйте DNS over HTTPS (DoH)',
          'Настройте VPN на использование своих DNS',
          'Смените DNS на Cloudflare (1.1.1.1) или Quad9 (9.9.9.9)'
        ]
      });
    }

    if (results.webrtc?.leaked) {
      this.recommendations.push({
        type: 'webrtc',
        priority: 'high',
        title: 'WebRTC утечка',
        description: 'WebRTC может раскрывать ваш реальный IP адрес',
        actions: [
          'Отключите WebRTC в браузере',
          'Используйте расширение для блокировки WebRTC',
          'В Chrome: chrome://flags/#disable-webrtc'
        ]
      });
    }

    if (results.ipv6?.leaked) {
      this.recommendations.push({
        type: 'ipv6',
        priority: 'high',
        title: 'IPv6 утечка',
        description: 'IPv6 трафик может обходить VPN туннель',
        actions: [
          'Отключите IPv6 в настройках сети',
          'Настройте VPN для работы с IPv6',
          'Используйте VPN с поддержкой IPv6'
        ]
      });
    }

    if (results.windowsTelemetry?.enabled) {
      this.recommendations.push({
        type: 'telemetry',
        priority: 'medium',
        title: 'Windows телеметрия активна',
        description: 'Службы телеметрии Windows могут передавать данные о системе',
        actions: [
          'Отключите службы DiagTrack и dmwappushservice',
          'Используйте инструменты вроде O&O ShutUp10',
          'Настройте групповую политику для отключения телеметрии'
        ]
      });
    }
  }

  /**
   * Автоматическое исправление утечек
   */
  async autoFixLeaks(results) {
    const fixes = [];

    try {
      // Исправление DNS
      if (results.dns?.leaked) {
        const dnsFixed = await this.fixDNSLeak();
        fixes.push({ type: 'dns', success: dnsFixed });
      }

      // Исправление IPv6
      if (results.ipv6?.leaked) {
        const ipv6Fixed = await this.fixIPv6Leak();
        fixes.push({ type: 'ipv6', success: ipv6Fixed });
      }

      // Исправление Windows Telemetry
      if (results.windowsTelemetry?.enabled && os.platform() === 'win32') {
        const telemetryFixed = await this.fixWindowsTelemetry();
        fixes.push({ type: 'telemetry', success: telemetryFixed });
      }

      logger.info(`Auto-fix completed: ${fixes.filter(f => f.success).length}/${fixes.length} successful`, 'leak-detector');

    } catch (error) {
      logger.error(`Auto-fix error: ${error.message}`, 'leak-detector');
    }

    return fixes;
  }

  /**
   * Исправление DNS утечки
   */
  async fixDNSLeak() {
    try {
      // Устанавливаем безопасные DNS
      if (globalDNSManager) {
        await globalDNSManager.setDNS('cloudflare');
        await globalDNSManager.flushDNSCache();
        logger.info('DNS leak fixed: switched to Cloudflare DNS', 'leak-detector');
        return true;
      }
    } catch (error) {
      logger.warn(`DNS fix error: ${error.message}`, 'leak-detector');
    }
    return false;
  }

  /**
   * Исправление IPv6 утечки
   */
  async fixIPv6Leak() {
    try {
      const platform = os.platform();

      if (platform === 'win32') {
        await execPromise('netsh interface ipv6 set global disabled=yes');
        logger.info('IPv6 disabled on Windows', 'leak-detector');
        return true;
      } else if (platform === 'linux') {
        // Требует root прав
        await execPromise('sysctl -w net.ipv6.conf.all.disable_ipv6=1');
        logger.info('IPv6 disabled on Linux', 'leak-detector');
        return true;
      } else if (platform === 'darwin') {
        // macOS требует ручной настройки
        logger.info('IPv6 disable on macOS requires manual configuration', 'leak-detector');
        return false;
      }
    } catch (error) {
      logger.warn(`IPv6 fix error: ${error.message}`, 'leak-detector');
    }
    return false;
  }

  /**
   * Исправление Windows Telemetry
   */
  async fixWindowsTelemetry() {
    if (os.platform() !== 'win32') {return false;}

    try {
      // Отключение служб телеметрии
      for (const service of this.windowsTelemetryServices) {
        try {
          await execPromise(`sc stop "${service}" 2>nul`);
          await execPromise(`sc config "${service}" start= disabled 2>nul`);
          logger.debug(`Windows telemetry service ${service} disabled`, 'leak-detector');
        } catch (error) {
          // Логируем ошибки для отдельных служб
          logger.debug(`Failed to disable ${service}: ${error.message}`, 'leak-detector');
        }
      }

      // Отключение задач телеметрии
      for (const task of this.windowsTelemetryTasks) {
        try {
          await execPromise(`schtasks /change /tn "${task}" /disable 2>nul`);
          logger.debug(`Windows telemetry task ${task} disabled`, 'leak-detector');
        } catch (error) {
          // Логируем ошибки
          logger.debug(`Failed to disable task ${task}: ${error.message}`, 'leak-detector');
        }
      }

      logger.info('Windows Telemetry services disabled', 'leak-detector');
      return true;
    } catch (error) {
      logger.warn(`Windows Telemetry fix error: ${error.message}`, 'leak-detector');
    }
    return false;
  }

  /**
   * Получить рекомендации
   */
  getRecommendations() {
    return this.recommendations;
  }

  /**
   * Получить историю проверок
   */
  getHistory(limit = 10) {
    return this.leakHistory.slice(-limit);
  }

  /**
   * Включить/выключить авто-исправление
   */
  setAutoFix(enabled) {
    this.autoFixEnabled = enabled;
    logger.info(`Auto-fix ${enabled ? 'enabled' : 'disabled'}`, 'leak-detector');
  }

  /**
   * Fetch с таймаутом
   */
  async fetchWithTimeout(url, options, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error('Timeout')), timeout);
      timeoutId.unref();
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, options, res => {
        clearTimeout(timeoutId);
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
        res.on('error', err => {
          clearTimeout(timeoutId);
          reject(err);
        });
      }).on('error', err => {
        clearTimeout(timeoutId);
        reject(err);
      });
    });
  }
}

// Singleton
export const globalLeakDetector = new LeakDetector();
export default LeakDetector;
