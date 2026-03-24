/**
 * Smart Bypass Manager - Умная система обхода блокировок
 * Автоматический выбор лучшего метода на основе тестов
 */

import { logger } from './logger.js';
import { globalIPManager } from './ipManager.js';
import { globalMonitorManager } from './monitorManager.js';
import { globalProxyManager } from './proxyManager.js';
import { globalDNSManager } from './dnsManager.js';
import { globalDoHManager } from './dohManager.js';

class SmartBypassManager {
  constructor() {
    this.methods = {
      direct: { name: 'Прямое подключение', weight: 0, available: true },
      proxy: { name: 'Через прокси', weight: 0, available: false },
      doh: { name: 'DNS over HTTPS', weight: 0, available: true },
      dns: { name: 'Смена DNS', weight: 0, available: true },
      vpn: { name: 'VPN режим', weight: 0, available: false }
    };
    this.lastTest = null;
    this.recommendations = [];
  }

  /**
   * Тестировать все методы обхода
   */
  async testAllMethods() {
    logger.info('Testing all bypass methods...', 'smart-bypass');

    const results = {};

    // Тест прямого подключения
    results.direct = await this.testDirect();

    // Тест прокси
    results.proxy = await this.testProxy();

    // Тест DoH
    results.doh = await this.testDoH();

    // Тест DNS
    results.dns = await this.testDNS();

    // Обновление весов
    this.updateWeights(results);

    this.lastTest = {
      timestamp: Date.now(),
      results
    };

    // Генерация рекомендаций
    this.generateRecommendations(results);

    logger.info(`Bypass test complete: ${this.getBestMethod()} is best`, 'smart-bypass');

    return results;
  }

  /**
   * Тест прямого подключения
   */
  async testDirect() {
    const start = Date.now();
    try {
      const cursorStatus = await globalMonitorManager.checkCursor();
      const responseTime = Date.now() - start;

      return {
        success: cursorStatus.available,
        responseTime,
        latency: responseTime,
        available: cursorStatus.available
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест прокси
   */
  async testProxy() {
    const start = Date.now();
    try {
      const proxy = globalProxyManager.rotateProxy();
      if (!proxy) {
        return { success: false, available: false, error: 'No proxies' };
      }

      // Проверка прокси
      const working = await globalProxyManager.checkProxy(proxy.url);

      return {
        success: working,
        responseTime: Date.now() - start,
        available: working,
        currentProxy: proxy.url
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест DoH
   */
  async testDoH() {
    const start = Date.now();
    try {
      const providers = await globalDoHManager.getAvailableProviders();
      const available = providers.filter(p => p.available).length;

      // Тест резолвинга
      const resolved = await globalDoHManager.resolveAuto('cursor.sh');

      return {
        success: resolved !== null,
        responseTime: Date.now() - start,
        available: available > 0,
        providers: available,
        resolved: resolved?.answers?.length > 0
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Тест DNS
   */
  async testDNS() {
    const start = Date.now();
    try {
      const dnsStatus = await globalMonitorManager.checkDNS();

      return {
        success: dnsStatus.available,
        responseTime: Date.now() - start,
        available: dnsStatus.availableCount > 0,
        dnsCount: dnsStatus.availableCount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        available: false
      };
    }
  }

  /**
   * Обновить веса методов
   */
  updateWeights(results) {
    // Прямое подключение - лучший вариант
    if (results.direct.success) {
      this.methods.direct.weight = 100;
    } else {
      this.methods.direct.weight = 0;
    }

    // DoH - хороший вариант если работает
    if (results.doh.available && results.doh.resolved) {
      this.methods.doh.weight = 80;
    } else {
      this.methods.doh.weight = 0;
    }

    // Прокси - если есть рабочие
    if (results.proxy.available && results.proxy.success) {
      this.methods.proxy.weight = 70;
    } else {
      this.methods.proxy.weight = 0;
    }

    // DNS - если есть доступные серверы
    if (results.dns.available && results.dns.dnsCount > 1) {
      this.methods.dns.weight = 60;
    } else {
      this.methods.dns.weight = 0;
    }
  }

  /**
   * Получить лучший метод
   */
  getBestMethod() {
    let best = 'direct';
    let bestWeight = this.methods.direct.weight;

    for (const [key, method] of Object.entries(this.methods)) {
      if (method.weight > bestWeight) {
        best = key;
        bestWeight = method.weight;
      }
    }

    return bestWeight > 0 ? best : 'direct';
  }

  /**
   * Получить все методы с весами
   */
  getMethods() {
    return { ...this.methods };
  }

  /**
   * Сгенерировать рекомендации
   */
  generateRecommendations(results) {
    this.recommendations = [];

    // Если прямое подключение не работает
    if (!results.direct.success) {
      if (results.proxy.available) {
        this.recommendations.push({
          type: 'proxy',
          priority: 'high',
          title: 'Рекомендуется использовать прокси',
          description: 'Прямое подключение к Cursor заблокировано',
          action: 'rotate_proxy'
        });
      }

      if (results.doh.available) {
        this.recommendations.push({
          type: 'doh',
          priority: 'medium',
          title: 'Включите DNS over HTTPS',
          description: 'DoH поможет обойти DNS блокировки',
          action: 'enable_doh'
        });
      }

      if (results.dns.available && results.dns.dnsCount < 2) {
        this.recommendations.push({
          type: 'dns',
          priority: 'high',
          title: 'Смените DNS сервер',
          description: 'Большинство DNS серверов недоступны',
          action: 'change_dns'
        });
      }
    }

    // Если IP из заблокированной страны
    const ipInfo = globalIPManager.getInfo();
    if (ipInfo.current?.countryCode) {
      const restricted = ['RU', 'BY', 'CN', 'IR', 'KP'];
      if (restricted.includes(ipInfo.current.countryCode)) {
        this.recommendations.push({
          type: 'geo',
          priority: 'high',
          title: `Ваша страна (${ipInfo.current.country}) в списке ограничений`,
          description: 'Рекомендуется использовать прокси другой страны',
          action: 'change_geo'
        });
      }
    }
  }

  /**
   * Получить рекомендации
   */
  getRecommendations() {
    return this.recommendations;
  }

  /**
   * Применить лучший метод автоматически
   */
  async applyBestMethod() {
    const best = this.getBestMethod();

    logger.info(`Applying best method: ${best}`, 'smart-bypass');

    switch (best) {
      case 'proxy':
        return this.applyProxy();
      case 'doh':
        return this.applyDoH();
      case 'dns':
        return this.applyDNS();
      default:
        return { success: true, method: 'direct' };
    }
  }

  /**
   * Применить прокси
   */
  async applyProxy() {
    try {
      const proxy = globalProxyManager.rotateProxy();
      if (proxy) {
        logger.info(`Proxy applied: ${proxy.url}`, 'smart-bypass');
        return { success: true, method: 'proxy', proxy: proxy.url };
      }
      return { success: false, error: 'No working proxies' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Применить DoH
   */
  async applyDoH() {
    try {
      const providers = await globalDoHManager.getAvailableProviders();
      const available = providers.find(p => p.available);

      if (available) {
        globalDoHManager.setProvider(available.key);
        logger.info(`DoH applied: ${available.name}`, 'smart-bypass');
        return { success: true, method: 'doh', provider: available.key };
      }
      return { success: false, error: 'No available DoH providers' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Применить DNS
   */
  async applyDNS() {
    try {
      const success = await globalDNSManager.setDNS('cloudflare');
      if (success) {
        logger.info('DNS applied: Cloudflare', 'smart-bypass');
        return { success: true, method: 'dns', provider: 'cloudflare' };
      }
      return { success: false, error: 'Failed to set DNS' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Получить статус
   */
  getStatus() {
    return {
      lastTest: this.lastTest,
      bestMethod: this.getBestMethod(),
      methods: this.getMethods(),
      recommendations: this.getRecommendations()
    };
  }
}

export const globalSmartBypassManager = new SmartBypassManager();
export default SmartBypassManager;
