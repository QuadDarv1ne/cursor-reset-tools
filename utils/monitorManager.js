/**
 * Monitor Manager - Мониторинг доступности сервисов
 * Cursor API, DNS серверы, GitHub, прокси
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';
import { globalIPManager } from './ipManager.js';

const MONITOR_TARGETS = {
  cursor: [
    { name: 'cursor-api', url: 'https://api2.cursor.sh/aiserver.v1.AuthService/DownloadUpdate', timeout: 5000 },
    { name: 'cursor-www', url: 'https://cursor.sh', timeout: 5000 },
    { name: 'cursor-auth', url: 'https://auth.cursor.com', timeout: 5000 },
    { name: 'cursor-cdn', url: 'https://cdn.cursor.sh', timeout: 5000 }
  ],
  dns: [
    { name: 'cloudflare-1', url: 'https://1.1.1.1/dns-query', timeout: 3000 },
    { name: 'cloudflare-2', url: 'https://1.0.0.1/dns-query', timeout: 3000 },
    { name: 'google-1', url: 'https://8.8.8.8/dns-query', timeout: 3000 },
    { name: 'google-2', url: 'https://8.8.4.4/dns-query', timeout: 3000 }
  ],
  github: [
    { name: 'github-api', url: 'https://api.github.com', timeout: 5000 },
    { name: 'github-www', url: 'https://github.com', timeout: 5000 }
  ]
};

class MonitorManager {
  constructor() {
    this.status = {};
    this.lastCheck = {};
    this.history = [];
    this.checkInterval = 30000; // 30 секунд
    this.autoCheckEnabled = false;
    this.autoCheckTimer = null;
  }

  /**
   * Инициализация мониторинга
   */
  async init() {
    logger.info('Monitor Manager initialized', 'monitor');
    await this.fullCheck();
  }

  /**
   * Проверить доступность URL
   */
  async checkUrl(target) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), target.timeout || 5000);

      const startTime = Date.now();

      // Для DoH запросов используем специальный агент
      const fetchOptions = {
        method: 'HEAD',
        signal: controller.signal,
        timeout: target.timeout
      };

      // Если это DoH запрос, пробуем без строгой проверки SSL
      if (target.url.includes('/dns-query')) {
        try {
          const https = await import('https');
          const HttpsAgent = https.Agent || class { constructor() {} };
          fetchOptions.agent = new HttpsAgent({
            rejectUnauthorized: false
          });
        } catch (e) {
          // Игнорируем если нет модуля
        }
      }

      const response = await fetch(target.url, fetchOptions);
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const available = response.ok || response.status === 404;

      return {
        name: target.name,
        url: target.url,
        available,
        status: response.status,
        responseTime,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        name: target.name,
        url: target.url,
        available: false,
        status: null,
        responseTime: null,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Проверить группу сервисов
   */
  async checkGroup(groupName) {
    const targets = MONITOR_TARGETS[groupName];
    if (!targets) {return [];}

    const results = await Promise.all(targets.map(t => this.checkUrl(t)));

    const available = results.filter(r => r.available).length;
    const total = results.length;

    this.status[groupName] = { available, total, results };
    this.lastCheck[groupName] = Date.now();

    logger.info(`Monitor ${groupName}: ${available}/${total} available`, 'monitor');

    return results;
  }

  /**
   * Полная проверка всех сервисов
   */
  async fullCheck() {
    const results = {};

    for (const group of Object.keys(MONITOR_TARGETS)) {
      results[group] = await this.checkGroup(group);
    }

    // Проверка IP
    const ipInfo = await globalIPManager.getCurrentIP();
    results.ip = ipInfo;

    // Сохранение в историю
    this.history.push({
      timestamp: Date.now(),
      status: { ...this.status },
      ip: ipInfo
    });

    // Ограничение истории
    if (this.history.length > 100) {
      this.history.shift();
    }

    logger.info('Full monitor check complete', 'monitor');

    return results;
  }

  /**
   * Проверить доступность Cursor API
   */
  async checkCursor() {
    const results = await this.checkGroup('cursor');
    const available = results.filter(r => r.available).length > 0;

    return {
      available,
      results,
      checkedAt: Date.now()
    };
  }

  /**
   * Проверить DNS серверы
   */
  async checkDNS() {
    const results = await this.checkGroup('dns');
    const available = results.filter(r => r.available).length;

    return {
      available: available > 0,
      availableCount: available,
      totalCount: results.length,
      results,
      checkedAt: Date.now()
    };
  }

  /**
   * Получить рекомендации
   */
  getRecommendations() {
    const recommendations = [];

    // Проверка Cursor
    const cursorStatus = this.status.cursor;
    if (cursorStatus && cursorStatus.available < cursorStatus.total) {
      recommendations.push({
        type: 'cursor',
        severity: 'warning',
        message: 'Cursor API частично недоступен',
        suggestion: 'Рекомендуется использовать прокси или VPN'
      });
    }

    // Проверка DNS
    const dnsStatus = this.status.dns;
    if (dnsStatus && dnsStatus.available < 2) {
      recommendations.push({
        type: 'dns',
        severity: 'error',
        message: 'Публичные DNS серверы недоступны',
        suggestion: 'Смените DNS на Cloudflare (1.1.1.1) или используйте прокси'
      });
    }

    // Проверка IP
    const ipInfo = globalIPManager.getInfo();
    if (ipInfo.current?.country) {
      const restrictedCountries = ['RU', 'BY', 'CN', 'IR'];
      if (restrictedCountries.includes(ipInfo.current.countryCode)) {
        recommendations.push({
          type: 'geo',
          severity: 'warning',
          message: `Ваша страна (${ipInfo.current.country}) может иметь ограничения`,
          suggestion: 'Используйте прокси или VPN другой страны'
        });
      }
    }

    return recommendations;
  }

  /**
   * Получить полный статус
   */
  getStatus() {
    return {
      status: this.status,
      lastCheck: this.lastCheck,
      recommendations: this.getRecommendations(),
      ip: globalIPManager.getInfo(),
      historyCount: this.history.length
    };
  }

  /**
   * Получить текущий статус (алиас)
   */
  getCurrentStatus() {
    return this.getStatus();
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      totalChecks: this.history.length,
      checkInterval: this.checkInterval,
      autoCheckEnabled: this.autoCheckEnabled,
      groupsMonitored: Object.keys(MONITOR_TARGETS).length
    };
  }

  /**
   * Проверить доступность Cursor (алиас)
   */
  async isCursorAvailable() {
    const result = await this.checkCursor();
    return result.available;
  }

  /**
   * Запустить мониторинг (алиас)
   */
  startMonitoring(interval = 60000) {
    this.enableAutoCheck(interval);
  }

  /**
   * Остановить мониторинг (алиас)
   */
  stopMonitoring() {
    this.disableAutoCheck();
  }

  /**
   * Включить автоматическую проверку
   */
  enableAutoCheck(interval = 30000) {
    if (this.autoCheckEnabled) {
      clearInterval(this.autoCheckTimer);
    }

    this.autoCheckEnabled = true;
    this.checkInterval = interval;

    this.autoCheckTimer = setInterval(() => {
      this.fullCheck().catch(err => {
        logger.error(`Auto check error: ${err.message}`, 'monitor');
      });
    }, interval);

    logger.info(`Auto monitor enabled (interval: ${interval}ms)`, 'monitor');
  }

  /**
   * Выключить автоматическую проверку
   */
  disableAutoCheck() {
    if (this.autoCheckTimer) {
      clearInterval(this.autoCheckTimer);
      this.autoCheckTimer = null;
    }
    this.autoCheckEnabled = false;
    logger.info('Auto monitor disabled', 'monitor');
  }

  /**
   * Получить историю проверок
   */
  getHistory(limit = 10) {
    return this.history.slice(-limit);
  }
}

export const globalMonitorManager = new MonitorManager();
export default MonitorManager;
