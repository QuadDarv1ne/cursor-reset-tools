/**
 * Leak Detector - Проверка утечек DNS, WebRTC и IPv6
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';
import { globalDNSManager } from './dnsManager.js';
import { globalIPManager } from './ipManager.js';

class LeakDetector {
  constructor() {
    this.lastCheck = null;
    this.results = {
      dns: null,
      webrtc: null,
      ipv6: null
    };
  }

  /**
   * Проверка утечки DNS
   * Сравнивает DNS серверы с ожидаемыми публичными
   */
  async checkDNSLeak() {
    logger.info('Checking DNS leak...', 'leak-detector');

    try {
      // Получение текущего DNS
      const currentDNS = await globalDNSManager.getCurrentDNS();
      const primary = currentDNS.primary;

      // Публичные DNS серверы
      const publicDNS = [
        '1.1.1.1', '1.0.0.1', // Cloudflare
        '8.8.8.8', '8.8.4.4', // Google
        '9.9.9.9', '149.112.112.112', // Quad9
        '208.67.222.222', '208.67.220.220' // OpenDNS
      ];

      // Проверка - используется ли публичный DNS
      const isPublicDNS = publicDNS.includes(primary);

      // Резолвинг домена через DoH для сравнения
      const { globalDoHManager } = await import('./dohManager.js');
      const dohResult = await globalDoHManager.resolveAuto('dnsleaktest.com');

      // Тест через несколько DNS сервисов
      const dnsTests = await Promise.allSettled([
        this._resolveWithDNS('1.1.1.1'),
        this._resolveWithDNS('8.8.8.8'),
        this._resolveWithDNS(primary)
      ]);

      const resolvedCount = dnsTests.filter(t => t.status === 'fulfilled' && t.value).length;

      this.results.dns = {
        leak: !isPublicDNS,
        currentDNS,
        isPublicDNS,
        resolvedCount,
        totalTests: dnsTests.length,
        dohAvailable: dohResult !== null,
        timestamp: Date.now()
      };

      logger.info(`DNS leak check: leak=${this.results.dns.leak}, public=${isPublicDNS}`, 'leak-detector');

      return this.results.dns;
    } catch (error) {
      logger.error(`DNS leak check failed: ${error.message}`, 'leak-detector');
      return {
        leak: null,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Резолвинг домена через конкретный DNS (эмуляция)
   * @private
   */
  async _resolveWithDNS(dnsServer) {
    try {
      // Используем DoH для эмуляции
      const { globalDoHManager } = await import('./dohManager.js');
      const result = await globalDoHManager.resolve('google.com', 'cloudflare');
      return result !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Проверка утечки WebRTC
   * Требует браузерного теста (возвращает инструкцию)
   */
  async checkWebRTCLEak() {
    logger.info('Checking WebRTC leak...', 'leak-detector');

    try {
      // WebRTC проверка требует браузерного контекста
      // Возвращаем инструкцию для пользователя

      const currentIP = await globalIPManager.getCurrentIP();

      this.results.webrtc = {
        requiresBrowser: true,
        instructions: {
          title: 'Проверка WebRTC утечки',
          steps: [
            'Откройте браузер в режиме инкогнито',
            'Перейдите на https://browserleaks.com/webrtc',
            'Сравните показанные IP адреса с вашим VPN IP',
            'Если видите реальный IP - WebRTC протекает'
          ],
          fix: [
            'Установите расширение WebRTC Leak Prevent',
            'Или отключите WebRTC в настройках браузера',
            'Используйте Firefox с media.peerconnection.enabled = false'
          ]
        },
        currentIP,
        timestamp: Date.now()
      };

      logger.info('WebRTC check: browser test required', 'leak-detector');

      return this.results.webrtc;
    } catch (error) {
      logger.error(`WebRTC check failed: ${error.message}`, 'leak-detector');
      return {
        requiresBrowser: true,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Проверка утечки IPv6
   */
  async checkIPv6Leak() {
    logger.info('Checking IPv6 leak...', 'leak-detector');

    try {
      const interfaces = (await import('os')).default.networkInterfaces();
      const ipv6Addresses = [];

      for (const [name, iface] of Object.entries(interfaces)) {
        if (!iface) {continue;}

        for (const addr of iface) {
          if (addr.family === 'IPv6' && !addr.internal) {
            ipv6Addresses.push({
              interface: name,
              address: addr.address,
              scope: addr.scopeid
            });
          }
        }
      }

      // Проверка - есть ли публичные IPv6 адреса
      const publicIPv6 = ipv6Addresses.filter(
        addr => !addr.address.startsWith('fe80::') && // Link-local
                !addr.address.startsWith('::1') && // Loopback
                !addr.address.startsWith('fc') && // Unique local
                !addr.address.startsWith('fd')
      );

      // Тест доступности IPv6
      let ipv6Working = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);

        const response = await fetch('https://ipv6.google.com', {
          signal: controller.signal,
          timeout: 5000
        });

        clearTimeout(timeout);
        ipv6Working = response.ok;
      } catch (error) {
        ipv6Working = false;
      }

      this.results.ipv6 = {
        leak: publicIPv6.length > 0 && ipv6Working,
        hasIPv6: ipv6Addresses.length > 0,
        publicIPv6: publicIPv6.length > 0,
        ipv6Addresses: ipv6Addresses.slice(0, 5), // Первые 5
        ipv6Working,
        recommendations: publicIPv6.length > 0 ? [
          'Отключите IPv6 в настройках сетевого адаптера',
          'Или убедитесь что VPN туннелирует IPv6 трафик'
        ] : [],
        timestamp: Date.now()
      };

      logger.info(`IPv6 leak check: leak=${this.results.ipv6.leak}, public=${publicIPv6.length > 0}`, 'leak-detector');

      return this.results.ipv6;
    } catch (error) {
      logger.error(`IPv6 leak check failed: ${error.message}`, 'leak-detector');
      return {
        leak: null,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Полная проверка всех утечек
   */
  async checkAll() {
    logger.info('Running full leak check...', 'leak-detector');

    const [dns, webrtc, ipv6] = await Promise.all([
      this.checkDNSLeak(),
      this.checkWebRTCLEak(),
      this.checkIPv6Leak()
    ]);

    this.lastCheck = Date.now();

    const summary = {
      timestamp: this.lastCheck,
      dns,
      webrtc,
      ipv6,
      overall: {
        dnsLeak: dns.leak === true,
        webrtcRisk: webrtc.requiresBrowser, // Требуется ручная проверка
        ipv6Leak: ipv6.leak === true,
        safe: !(dns.leak === true || ipv6.leak === true)
      }
    };

    logger.info(`Leak check complete: safe=${summary.overall.safe}`, 'leak-detector');

    return summary;
  }

  /**
   * Получить последние результаты
   */
  getLastResults() {
    return {
      lastCheck: this.lastCheck,
      results: this.results
    };
  }

  /**
   * Получить рекомендации
   */
  getRecommendations() {
    const recommendations = [];

    if (this.results.dns?.leak) {
      recommendations.push({
        type: 'dns',
        priority: 'high',
        title: 'Обнаружена утечка DNS',
        description: 'Ваш DNS трафик может проходить через провайдера',
        fix: [
          'Используйте DNS over HTTPS (DoH)',
          'Смените DNS на Cloudflare (1.1.1.1)',
          'Убедитесь что VPN туннелирует DNS запросы'
        ]
      });
    }

    if (this.results.ipv6?.leak) {
      recommendations.push({
        type: 'ipv6',
        priority: 'high',
        title: 'Обнаружена утечка IPv6',
        description: 'IPv6 трафик может обходить VPN',
        fix: [
          'Отключите IPv6 в настройках сети',
          'Или используйте VPN с поддержкой IPv6'
        ]
      });
    }

    if (this.results.webrtc?.requiresBrowser) {
      recommendations.push({
        type: 'webrtc',
        priority: 'medium',
        title: 'Требуется проверка WebRTC',
        description: 'WebRTC может показывать ваш реальный IP',
        fix: [
          'Проверьте https://browserleaks.com/webrtc',
          'Установите WebRTC Leak Prevent расширение'
        ]
      });
    }

    return recommendations;
  }
}

export const globalLeakDetector = new LeakDetector();
export default LeakDetector;
