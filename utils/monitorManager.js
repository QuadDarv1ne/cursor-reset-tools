/**
 * Monitor Manager - Мониторинг блокировок и статуса Cursor API
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';
import { globalProxyManager } from './proxyManager.js';
import { globalIPManager } from './ipManager.js';

/**
 * Конфигурация мониторинга
 */
export const MONITOR_CONFIG = {
  checkInterval: 60000, // 1 минута
  timeout: 10000,
  endpoints: {
    cursor: [
      { name: 'Cursor API', url: 'https://api2.cursor.sh/health' },
      { name: 'Cursor Auth', url: 'https://auth.cursor.com' },
      { name: 'Cursor Main', url: 'https://cursor.sh' },
      { name: 'Cursor WWW', url: 'https://www.cursor.com' }
    ],
    github: [
      { name: 'GitHub API', url: 'https://api.github.com' },
      { name: 'GitHub Main', url: 'https://github.com' }
    ],
    dns: [
      { name: 'Cloudflare DNS', url: 'https://1.1.1.1/dns-query' },
      { name: 'Google DNS', url: 'https://8.8.8.8/resolve' }
    ]
  }
};

/**
 * Класс для мониторинга доступности
 */
export class MonitorManager {
  constructor() {
    this.statusCache = new Map();
    this.history = [];
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.listeners = new Set();
    this.lastCheck = null;
  }

  /**
   * Проверка доступности endpoint
   * @param {Object} endpoint - Endpoint для проверки
   * @returns {Promise<Object>}
   */
  async checkEndpoint(endpoint) {
    const fetchFn = globalProxyManager.getFetch();
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), MONITOR_CONFIG.timeout);

      const response = await fetchFn(endpoint.url, {
        method: 'HEAD',
        signal: controller.signal,
        timeout: MONITOR_CONFIG.timeout,
        redirect: 'manual'
      });

      clearTimeout(timeout);

      const latency = Date.now() - startTime;
      const status = response.status;
      const isAvailable = status > 0 && status < 500;
      const isBlocked = status === 0 || status >= 500 || !response.ok;

      const result = {
        name: endpoint.name,
        url: endpoint.url,
        available: isAvailable,
        status: status || 'N/A',
        latency,
        blocked: isBlocked,
        timestamp: Date.now()
      };

      this.statusCache.set(endpoint.url, result);
      return result;

    } catch (error) {
      const latency = Date.now() - startTime;
      
      const result = {
        name: endpoint.name,
        url: endpoint.url,
        available: false,
        status: 0,
        latency,
        blocked: true,
        error: error.message,
        timestamp: Date.now()
      };

      this.statusCache.set(endpoint.url, result);
      return result;
    }
  }

  /**
   * Проверка всех endpoints
   * @param {string} category - Категория (cursor, github, dns)
   * @returns {Promise<Object>}
   */
  async checkAllEndpoints(category = 'cursor') {
    const endpoints = MONITOR_CONFIG.endpoints[category] || MONITOR_CONFIG.endpoints.cursor;
    const results = [];

    for (const endpoint of endpoints) {
      const result = await this.checkEndpoint(endpoint);
      results.push(result);
    }

    const available = results.filter(r => r.available).length;
    const blocked = results.filter(r => r.blocked).length;

    const summary = {
      category,
      total: results.length,
      available,
      blocked,
      availabilityPercent: Math.round((available / results.length) * 100),
      results,
      timestamp: Date.now()
    };

    this.lastCheck = Date.now();
    this._addToHistory(summary);
    this._notifyListeners(summary);

    logger.info(`Monitor ${category}: ${available}/${results.length} available`, 'monitor');
    return summary;
  }

  /**
   * Комплексная проверка всех сервисов
   * @returns {Promise<Object>}
   */
  async fullCheck() {
    const categories = ['cursor', 'github', 'dns'];
    const results = {};

    for (const category of categories) {
      results[category] = await this.checkAllEndpoints(category);
    }

    // Проверка IP
    const ipData = await globalIPManager.getCurrentIP({ useCache: false });
    
    // Общая оценка
    const cursorAvailable = results.cursor.availabilityPercent >= 50;
    const allAvailable = Object.values(results).every(r => r.availabilityPercent === 100);

    const fullReport = {
      ip: ipData,
      services: results,
      cursorAvailable,
      allAvailable,
      recommendations: this._generateRecommendations(results, ipData),
      timestamp: Date.now()
    };

    logger.info(`Full monitor check complete`, 'monitor');
    return fullReport;
  }

  /**
   * Генерация рекомендаций на основе статуса
   * @private
   */
  _generateRecommendations(results, ipData) {
    const recommendations = [];

    // Проверка Cursor
    const cursorResult = results.cursor;
    if (cursorResult && cursorResult.availabilityPercent === 0) {
      recommendations.push({
        type: 'critical',
        service: 'Cursor',
        message: 'Cursor API полностью недоступен',
        action: 'Смените IP адрес через прокси или VPN',
        priority: 1
      });
    } else if (cursorResult && cursorResult.availabilityPercent < 100) {
      recommendations.push({
        type: 'warning',
        service: 'Cursor',
        message: 'Cursor API работает нестабильно',
        action: 'Рекомендуется сменить IP для лучшей стабильности',
        priority: 2
      });
    }

    // Проверка страны
    const blockedCountries = ['CN', 'RU', 'BY', 'KP', 'IR', 'SY', 'CU'];
    if (ipData.countryCode && blockedCountries.includes(ipData.countryCode)) {
      recommendations.push({
        type: 'info',
        service: 'Region',
        message: `Ваша страна (${ipData.country}) может иметь ограничения`,
        action: 'Используйте прокси из другой страны',
        priority: 3
      });
    }

    // Проверка DNS
    const dnsResult = results.dns;
    if (dnsResult && dnsResult.availabilityPercent === 0) {
      recommendations.push({
        type: 'warning',
        service: 'DNS',
        message: 'Публичные DNS серверы недоступны',
        action: 'Проверьте настройки DNS или смените провайдера',
        priority: 2
      });
    }

    return recommendations.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Запуск автоматического мониторинга
   * @param {number} interval - Интервал в мс
   */
  startMonitoring(interval = MONITOR_CONFIG.checkInterval) {
    if (this.isMonitoring) {
      logger.warn('Monitoring already running', 'monitor');
      return;
    }

    this.isMonitoring = true;
    
    const check = async () => {
      if (!this.isMonitoring) return;
      await this.fullCheck();
    };

    check(); // Первый запуск сразу
    this.monitorInterval = setInterval(check, interval);
    
    logger.info(`Monitoring started (interval: ${interval}ms)`, 'monitor');
  }

  /**
   * Остановка мониторинга
   */
  stopMonitoring() {
    this.isMonitoring = false;
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    logger.info('Monitoring stopped', 'monitor');
  }

  /**
   * Добавление слушателя событий
   * @param {Function} listener - Callback функция
   */
  addListener(listener) {
    this.listeners.add(listener);
  }

  /**
   * Удаление слушателя
   * @param {Function} listener - Callback функция
   */
  removeListener(listener) {
    this.listeners.delete(listener);
  }

  /**
   * Уведомление слушателей
   * @private
   */
  _notifyListeners(data) {
    for (const listener of this.listeners) {
      try {
        listener(data);
      } catch (error) {
        logger.error(`Monitor listener error: ${error.message}`, 'monitor');
      }
    }
  }

  /**
   * Добавление в историю
   * @private
   */
  _addToHistory(summary) {
    this.history.push(summary);
    
    // Хранить последние 100 записей
    if (this.history.length > 100) {
      this.history.shift();
    }
  }

  /**
   * Получение истории мониторинга
   * @param {number} limit - Количество записей
   * @returns {Array}
   */
  getHistory(limit = 20) {
    return this.history.slice(-limit);
  }

  /**
   * Получение текущего статуса
   * @returns {Object}
   */
  getCurrentStatus() {
    const status = {
      isMonitoring: this.isMonitoring,
      lastCheck: this.lastCheck,
      endpoints: {}
    };

    for (const [url, data] of this.statusCache.entries()) {
      status.endpoints[url] = data;
    }

    return status;
  }

  /**
   * Получение статистики
   * @returns {Object}
   */
  getStats() {
    const total = this.history.length;
    if (total === 0) {
      return {
        totalChecks: 0,
        averageAvailability: 0,
        downtime: 0
      };
    }

    const cursorChecks = this.history.filter(h => h.category === 'cursor');
    const avgAvailability = cursorChecks.reduce((sum, h) => sum + h.availabilityPercent, 0) / cursorChecks.length;
    const downtime = cursorChecks.filter(h => h.availabilityPercent === 0).length;

    return {
      totalChecks: total,
      averageAvailability: Math.round(avgAvailability),
      downtimeChecks: downtime,
      uptimePercent: Math.round(100 - (downtime / cursorChecks.length) * 100)
    };
  }

  /**
   * Быстрая проверка Cursor API
   * @returns {Promise<boolean>}
   */
  async isCursorAvailable() {
    const cached = this.statusCache.get('https://api2.cursor.sh/health');
    
    if (cached && Date.now() - cached.timestamp < 30000) {
      return cached.available;
    }

    const result = await this.checkAllEndpoints('cursor');
    return result.availabilityPercent >= 50;
  }

  /**
   * Сброс кэша и истории
   */
  reset() {
    this.statusCache.clear();
    this.history = [];
    this.lastCheck = null;
    logger.info('Monitor reset', 'monitor');
  }
}

// Глобальный экземпляр
export const globalMonitorManager = new MonitorManager();

export default MonitorManager;
