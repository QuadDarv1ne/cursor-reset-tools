/**
 * VPN/DNS/Proxy Complex Test - Тестирование всех методов обхода блокировок
 * Диагностика и рекомендации
 */

import { logger } from './logger.js';
import { globalVPNManager } from './vpnManager.js';
import { globalDNSManager } from './dnsManager.js';
import { globalDoHManager } from './dohManager.js';
import { globalProxyManager } from './proxyManager.js';
import { globalLeakDetector } from './leakDetector.js';
import { _globalSmartBypassManager } from './smartBypassManager.js';

/**
 * Комплексный тестер для диагностики блокировок
 */
class BypassTester {
  constructor() {
    this.testResults = null;
    this.lastTestTime = null;
  }

  /**
   * Запуск полного теста
   * @returns {Promise<Object>}
   */
  async runFullTest() {
    logger.info('Starting full bypass test...', 'bypass-tester');

    const results = {
      timestamp: Date.now(),
      vpn: null,
      dns: null,
      doh: null,
      proxy: null,
      leak: null,
      cursor: null,
      summary: null,
      recommendations: []
    };

    this.lastTestTime = Date.now();

    try {
      // 1. Тест VPN
      results.vpn = await this.testVPN();

      // 2. Тест DNS
      results.dns = await this.testDNS();

      // 3. Тест DoH
      results.doh = await this.testDoH();

      // 4. Тест Proxy
      results.proxy = await this.testProxy();

      // 5. Тест утечек
      results.leak = await this.testLeaks();

      // 6. Тест доступности Cursor
      results.cursor = await this.testCursorAccess();

      // 7. Генерация сводки и рекомендаций
      results.summary = this.generateSummary(results);
      results.recommendations = this.generateRecommendations(results);

      this.testResults = results;

      logger.info(`Full test complete. Summary: ${results.summary.status}`, 'bypass-tester');

      return results;
    } catch (error) {
      logger.error(`Full test failed: ${error.message}`, 'bypass-tester');
      return {
        timestamp: Date.now(),
        error: error.message,
        summary: {
          status: 'error',
          score: 0
        }
      };
    }
  }

  /**
   * Тест VPN подключения
   */
  async testVPN() {
    logger.info('Testing VPN...', 'bypass-tester');

    try {
      const vpnStatus = await globalVPNManager.detectActiveVPN();
      const amneziaStatus = await globalVPNManager.getAmneziaStatus();

      const result = {
        detected: vpnStatus.detected,
        type: vpnStatus.type,
        country: vpnStatus.country,
        countryCode: vpnStatus.countryCode,
        ip: vpnStatus.ip,
        isp: vpnStatus.isp,
        isVPN: vpnStatus.isVPN,
        amnezia: amneziaStatus,
        score: 0
      };

      // Оценка качества VPN
      if (vpnStatus.detected) {
        result.score = 50; // Базовые баллы за VPN

        if (vpnStatus.isVPN) {
          result.score += 20; // Известный VPN провайдер
        }

        if (vpnStatus.countryCode && vpnStatus.countryCode !== 'RU') {
          result.score += 20; // Не Россия
        }

        if (amneziaStatus.installed) {
          result.score += 10; // Amnezia установлен
        }
      }

      logger.info(`VPN test: detected=${vpnStatus.detected}, score=${result.score}`, 'bypass-tester');

      return result;
    } catch (error) {
      logger.error(`VPN test failed: ${error.message}`, 'bypass-tester');
      return {
        detected: false,
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Тест DNS
   */
  async testDNS() {
    logger.info('Testing DNS...', 'bypass-tester');

    try {
      const currentDNS = await globalDNSManager.getCurrentDNS();
      const providers = globalDNSManager.getAvailableProviders();

      // Проверка публичных DNS
      const publicDNS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];
      const isPublicDNS = publicDNS.includes(currentDNS.primary);

      const result = {
        primary: currentDNS.primary,
        secondary: currentDNS.secondary,
        isPublicDNS,
        providersCount: Object.keys(providers).length,
        score: 0
      };

      if (isPublicDNS) {
        result.score = 100; // Публичный DNS
      } else if (currentDNS.primary !== 'unknown') {
        result.score = 50; // DNS определён, но не публичный
      } else {
        result.score = 0; // DNS не определён
      }

      logger.info(`DNS test: ${currentDNS.primary}, public=${isPublicDNS}, score=${result.score}`, 'bypass-tester');

      return result;
    } catch (error) {
      logger.error(`DNS test failed: ${error.message}`, 'bypass-tester');
      return {
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Тест DoH
   */
  async testDoH() {
    logger.info('Testing DoH...', 'bypass-tester');

    try {
      const providers = await globalDoHManager.getAvailableProviders();
      const available = providers.filter(p => p.available);

      // Тест резолвинга
      const resolved = await globalDoHManager.resolveAuto('cursor.sh');

      const result = {
        providers: providers.length,
        available: available.length,
        resolved: resolved !== null,
        resolvedIP: resolved?.answers?.[0]?.data || null,
        currentProvider: globalDoHManager.getCurrentProvider(),
        score: 0
      };

      // Оценка
      if (available.length > 0) {
        result.score += 50;
      }

      if (resolved) {
        result.score += 50;
      }

      logger.info(`DoH test: available=${available.length}, resolved=${resolved !== null}, score=${result.score}`, 'bypass-tester');

      return result;
    } catch (error) {
      logger.error(`DoH test failed: ${error.message}`, 'bypass-tester');
      return {
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Тест Proxy
   */
  async testProxy() {
    logger.info('Testing Proxy...', 'bypass-tester');

    try {
      const stats = globalProxyManager.getStats();
      const currentProxy = globalProxyManager.getCurrentProxy();

      const result = {
        total: stats.total,
        working: stats.working,
        failed: stats.failed,
        hasCurrent: !!currentProxy,
        score: 0
      };

      // Оценка
      if (stats.working > 0) {
        result.score = Math.min(100, stats.working * 20); // До 100 баллов
      } else if (stats.total > 0) {
        result.score = 20; // Есть прокси, но не проверены
      }

      logger.info(`Proxy test: working=${stats.working}/${stats.total}, score=${result.score}`, 'bypass-tester');

      return result;
    } catch (error) {
      logger.error(`Proxy test failed: ${error.message}`, 'bypass-tester');
      return {
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Тест утечек
   */
  async testLeaks() {
    logger.info('Testing leaks...', 'bypass-tester');

    try {
      const leakResults = await globalLeakDetector.checkAll();

      const result = {
        dnsLeak: leakResults.dns?.leak || false,
        webrtcRisk: leakResults.webrtc?.requiresBrowser || false,
        ipv6Leak: leakResults.ipv6?.leak || false,
        safe: leakResults.overall?.safe !== false,
        score: 100
      };

      // Снижение баллов за утечки
      if (result.dnsLeak) {
        result.score -= 40;
      }
      if (result.ipv6Leak) {
        result.score -= 30;
      }
      if (result.webrtcRisk) {
        result.score -= 20;
      }

      logger.info(`Leak test: safe=${result.safe}, score=${result.score}`, 'bypass-tester');

      return result;
    } catch (error) {
      logger.error(`Leak test failed: ${error.message}`, 'bypass-tester');
      return {
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Тест доступности Cursor
   */
  async testCursorAccess() {
    logger.info('Testing Cursor access...', 'bypass-tester');

    try {
      const { globalMonitorManager } = await import('./monitorManager.js');
      const cursorStatus = await globalMonitorManager.checkCursor();

      const result = {
        available: cursorStatus.available,
        responseTime: cursorStatus.responseTime,
        error: cursorStatus.error,
        score: cursorStatus.available ? 100 : 0
      };

      logger.info(`Cursor test: available=${cursorStatus.available}, responseTime=${cursorStatus.responseTime}ms`, 'bypass-tester');

      return result;
    } catch (error) {
      logger.error(`Cursor test failed: ${error.message}`, 'bypass-tester');
      return {
        available: false,
        error: error.message,
        score: 0
      };
    }
  }

  /**
   * Генерация сводки
   * @private
   */
  generateSummary(results) {
    const totalScore =
      results.vpn.score * 0.25 +
      results.dns.score * 0.15 +
      results.doh.score * 0.15 +
      results.proxy.score * 0.15 +
      results.leak.score * 0.15 +
      results.cursor.score * 0.15;

    let status = 'poor';
    if (totalScore >= 80) {
      status = 'excellent';
    } else if (totalScore >= 60) {
      status = 'good';
    } else if (totalScore >= 40) {
      status = 'fair';
    }

    return {
      status,
      score: Math.round(totalScore),
      vpnScore: results.vpn.score,
      dnsScore: results.dns.score,
      dohScore: results.doh.score,
      proxyScore: results.proxy.score,
      leakScore: results.leak.score,
      cursorScore: results.cursor.score
    };
  }

  /**
   * Генерация рекомендаций
   * @private
   */
  generateRecommendations(results) {
    const recommendations = [];

    // VPN рекомендации
    if (!results.vpn.detected) {
      recommendations.push({
        type: 'vpn',
        priority: 'critical',
        title: 'VPN не обнаружен',
        description: 'Включите Amnezia VPN или другой VPN для обхода блокировок',
        action: 'enable_vpn',
        impact: 25
      });
    } else if (!results.vpn.isVPN && results.vpn.countryCode === 'RU') {
      recommendations.push({
        type: 'geo',
        priority: 'high',
        title: 'Российский IP адрес',
        description: 'Cursor может ограничивать функционал для России',
        action: 'change_geo',
        impact: 20
      });
    }

    // DNS рекомендации
    if (!results.dns.isPublicDNS) {
      recommendations.push({
        type: 'dns',
        priority: 'high',
        title: 'Используется DNS провайдера',
        description: 'Смените DNS на Cloudflare (1.1.1.1) для обхода блокировок',
        action: 'change_dns',
        impact: 15
      });
    }

    // DoH рекомендации
    if (!results.doh.resolved) {
      recommendations.push({
        type: 'doh',
        priority: 'medium',
        title: 'DoH не работает',
        description: 'Включите DNS over HTTPS для надёжного резолвинга',
        action: 'enable_doh',
        impact: 15
      });
    }

    // Proxy рекомендации
    if (results.proxy.total === 0 && !results.cursor.available) {
      recommendations.push({
        type: 'proxy',
        priority: 'high',
        title: 'Прокси не настроены',
        description: 'Добавьте прокси для обхода блокировок Cursor',
        action: 'add_proxy',
        impact: 15
      });
    }

    // Утечки
    if (results.leak.dnsLeak) {
      recommendations.push({
        type: 'leak',
        priority: 'critical',
        title: 'Обнаружена DNS утечка',
        description: 'VPN не туннелирует DNS запросы',
        action: 'fix_dns_leak',
        impact: 20
      });
    }

    if (results.leak.ipv6Leak) {
      recommendations.push({
        type: 'leak',
        priority: 'high',
        title: 'Обнаружена IPv6 утечка',
        description: 'Отключите IPv6 для предотвращения утечек',
        action: 'disable_ipv6',
        impact: 15
      });
    }

    // Cursor недоступен
    if (!results.cursor.available) {
      recommendations.push({
        type: 'cursor',
        priority: 'critical',
        title: 'Cursor недоступен',
        description: 'Примените рекомендации выше для восстановления доступа',
        action: 'apply_all',
        impact: 15
      });
    }

    // Сортировка по важности
    recommendations.sort((a, b) => b.impact - a.impact);

    return recommendations;
  }

  /**
   * Получить последние результаты теста
   */
  getLastResults() {
    return this.testResults;
  }

  /**
   * Быстрый тест (только VPN и Cursor)
   */
  async runQuickTest() {
    logger.info('Running quick test...', 'bypass-tester');

    const results = {
      timestamp: Date.now(),
      vpn: await this.testVPN(),
      cursor: await this.testCursorAccess(),
      summary: null
    };

    results.summary = {
      status: results.vpn.detected && results.cursor.available ? 'good' : 'poor',
      score: results.vpn.score * 0.5 + results.cursor.score * 0.5
    };

    this.testResults = results;

    return results;
  }

  /**
   * Экспорт результатов в JSON
   */
  exportToJSON() {
    return JSON.stringify(this.testResults, null, 2);
  }

  /**
   * Получить рекомендации в текстовом формате
   */
  getFormattedRecommendations() {
    if (!this.testResults) {
      return 'Сначала запустите тест';
    }

    let text = '📊 Результаты теста обхода блокировок\n\n';
    text += `Общий балл: ${this.testResults.summary.score}/100\n`;
    text += `Статус: ${this.testResults.summary.status.toUpperCase()}\n\n`;

    text += '📈 Детализация:\n';
    text += `  VPN: ${this.testResults.vpn.score}/100\n`;
    text += `  DNS: ${this.testResults.dns.score}/100\n`;
    text += `  DoH: ${this.testResults.doh.score}/100\n`;
    text += `  Proxy: ${this.testResults.proxy.score}/100\n`;
    text += `  Защита от утечек: ${this.testResults.leak.score}/100\n`;
    text += `  Доступность Cursor: ${this.testResults.cursor.score}/100\n\n`;

    if (this.testResults.recommendations.length > 0) {
      text += '💡 Рекомендации:\n';
      this.testResults.recommendations.forEach((rec, _i) => {
        const icon = rec.priority === 'critical' ? '🔴' :
          rec.priority === 'high' ? '🟠' :
            rec.priority === 'medium' ? '🟡' : '🟢';
        text += `  ${icon} ${rec.title}\n`;
        text += `     ${rec.description}\n\n`;
      });
    }

    return text;
  }
}

// Глобальный экземпляр
export const globalBypassTester = new BypassTester();
export default BypassTester;
