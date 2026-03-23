/**
 * IP Manager - Проверка IP, геолокация, детект блокировок
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';
import { globalProxyManager } from './proxyManager.js';

/**
 * API для проверки IP и геолокации
 */
const IP_APIS = [
  'https://api.ipify.org?format=json',
  'https://ipapi.co/json/',
  'https://ipwho.is/',
  'https://api.ip.sb/ip',
  'https://ifconfig.me/ip'
];

/**
 * Cursor API endpoints для проверки доступности
 */
const CURSOR_ENDPOINTS = [
  'https://api2.cursor.sh',
  'https://cursor.sh',
  'https://www.cursor.com',
  'https://auth.cursor.com'
];

/**
 * Класс для управления IP и проверки блокировок
 */
export class IPManager {
  constructor() {
    this.currentIP = null;
    this.ipHistory = [];
    this.lastCheck = null;
    this.cacheTimeout = 30000; // 30 секунд
    this.blockedEndpoints = new Set();
  }

  /**
   * Получение текущего IP адреса
   * @param {Object} options - Опции
   * @returns {Promise<Object>}
   */
  async getCurrentIP(options = {}) {
    const { useCache = true, includeDetails = false } = options;

    // Проверка кэша
    if (useCache && this.currentIP && this.lastCheck) {
      const age = Date.now() - this.lastCheck;
      if (age < this.cacheTimeout) {
        logger.debug('Returning cached IP', 'ip');
        return this.currentIP;
      }
    }

    const fetchFn = globalProxyManager.getFetch();
    
    for (const api of IP_APIS) {
      try {
        logger.debug(`Trying IP API: ${api}`, 'ip');
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetchFn(api, {
          signal: controller.signal,
          timeout: 10000
        });

        clearTimeout(timeout);

        if (!response.ok) continue;

        let ipData;
        
        if (api.includes('ipify')) {
          const text = await response.text();
          ipData = { ip: text.trim() };
        } else if (api.includes('ipapi.co') || api.includes('ipwho.is')) {
          ipData = await response.json();
        } else {
          const text = await response.text();
          ipData = { ip: text.trim() };
        }

        this.currentIP = {
          ip: ipData.ip || ipData.IP || '',
          country: ipData.country || ipData.country_name || '',
          countryCode: ipData.country_code || '',
          city: ipData.city || '',
          region: ipData.region || '',
          isp: ipData.isp || ipData.org || '',
          timezone: ipData.timezone || '',
          latitude: ipData.latitude || ipData.lat || '',
          longitude: ipData.longitude || ipData.lon || ''
        };

        this.lastCheck = Date.now();
        
        // Добавление в историю
        this.ipHistory.push({
          ...this.currentIP,
          timestamp: Date.now()
        });
        
        // Ограничение истории
        if (this.ipHistory.length > 10) {
          this.ipHistory.shift();
        }

        logger.info(`IP detected: ${this.currentIP.ip} (${this.currentIP.country})`, 'ip');
        return this.currentIP;

      } catch (error) {
        logger.debug(`IP API failed: ${api} - ${error.message}`, 'ip');
        continue;
      }
    }

    logger.error('All IP APIs failed', 'ip');
    return { ip: 'unknown', error: 'Failed to detect IP' };
  }

  /**
   * Проверка доступности Cursor API
   * @returns {Promise<Object>}
   */
  async checkCursorAvailability() {
    const results = {};
    const fetchFn = globalProxyManager.getFetch();

    for (const endpoint of CURSOR_ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetchFn(`${endpoint}/health`, {
          method: 'GET',
          signal: controller.signal,
          timeout: 10000
        }).catch(() => ({ status: 0 }));

        clearTimeout(timeout);

        // Пробуем также основной URL
        if (!response.ok || response.status === 0) {
          const mainResponse = await fetchFn(endpoint, {
            method: 'HEAD',
            signal: controller.signal,
            timeout: 10000
          }).catch(() => ({ status: 0 }));
          
          results[endpoint] = {
            available: mainResponse.status > 0 && mainResponse.status < 500,
            status: mainResponse.status,
            blocked: mainResponse.status === 0 || mainResponse.status >= 500
          };
        } else {
          results[endpoint] = {
            available: true,
            status: response.status,
            blocked: false
          };
        }

        if (results[endpoint].blocked) {
          this.blockedEndpoints.add(endpoint);
        }

      } catch (error) {
        results[endpoint] = {
          available: false,
          status: 0,
          blocked: true,
          error: error.message
        };
        this.blockedEndpoints.add(endpoint);
      }
    }

    const availableCount = Object.values(results).filter(r => r.available).length;
    const totalCount = Object.keys(results).length;

    logger.info(`Cursor API: ${availableCount}/${totalCount} endpoints available`, 'ip');
    
    return {
      endpoints: results,
      available: availableCount,
      total: totalCount,
      isBlocked: availableCount === 0,
      isPartiallyBlocked: availableCount < totalCount
    };
  }

  /**
   * Детект региональных блокировок
   * @returns {Promise<Object>}
   */
  async detectBlocks() {
    const [ipData, cursorStatus] = await Promise.all([
      this.getCurrentIP({ includeDetails: true }),
      this.checkCursorAvailability()
    ]);

    const blocks = {
      ip: ipData.ip,
      country: ipData.country,
      countryCode: ipData.countryCode,
      cursorBlocked: cursorStatus.isBlocked,
      cursorPartiallyBlocked: cursorStatus.isPartiallyBlocked,
      blockedEndpoints: Array.from(this.blockedEndpoints),
      recommendations: []
    };

    // Рекомендации на основе страны
    const blockedCountries = ['CN', 'RU', 'BY', 'KP', 'IR', 'SY', 'CU'];
    if (blockedCountries.includes(ipData.countryCode)) {
      blocks.recommendations.push({
        type: 'country_block',
        message: `Your country (${ipData.country}) may have restrictions for Cursor`,
        action: 'Use proxy or VPN to change your IP location'
      });
    }

    // Рекомендации при блокировке API
    if (cursorStatus.isBlocked) {
      blocks.recommendations.push({
        type: 'api_block',
        message: 'All Cursor API endpoints are unreachable',
        action: 'Change IP address using proxy or VPN'
      });
    } else if (cursorStatus.isPartiallyBlocked) {
      blocks.recommendations.push({
        type: 'partial_block',
        message: 'Some Cursor API endpoints are unreachable',
        action: 'Consider changing IP for better stability'
      });
    }

    logger.info(`Block detection complete: ${blocks.recommendations.length} recommendations`, 'ip');
    return blocks;
  }

  /**
   * Быстрая проверка IP (только IP без деталей)
   * @returns {Promise<string>}
   */
  async quickIPCheck() {
    try {
      const fetchFn = globalProxyManager.getFetch();
      const response = await fetchFn('https://api.ipify.org?format=json', {
        timeout: 5000
      });
      const data = await response.json();
      return data.ip || 'unknown';
    } catch (error) {
      logger.debug(`Quick IP check failed: ${error.message}`, 'ip');
      return 'unknown';
    }
  }

  /**
   * Проверка изменения IP после смены прокси
   * @param {string} previousIP - Предыдущий IP
   * @returns {Promise<Object>}
   */
  async verifyIPChange(previousIP) {
    const newIPData = await this.getCurrentIP({ useCache: false });
    const newIP = newIPData.ip;

    const changed = newIP !== previousIP && newIP !== 'unknown';
    
    logger.info(`IP change verification: ${previousIP} -> ${newIP} (changed: ${changed})`, 'ip');
    
    return {
      previousIP,
      newIP,
      changed,
      country: newIPData.country,
      success: changed
    };
  }

  /**
   * Получение истории IP
   * @returns {Array}
   */
  getIPHistory() {
    return this.ipHistory;
  }

  /**
   * Сброс кэша и истории
   */
  reset() {
    this.currentIP = null;
    this.lastCheck = null;
    this.ipHistory = [];
    this.blockedEndpoints.clear();
    logger.info('IP Manager reset', 'ip');
  }

  /**
   * Получение статуса
   * @returns {Object}
   */
  getStatus() {
    return {
      currentIP: this.currentIP,
      lastCheck: this.lastCheck,
      historyCount: this.ipHistory.length,
      blockedEndpointsCount: this.blockedEndpoints.size,
      cacheAge: this.lastCheck ? Date.now() - this.lastCheck : null
    };
  }
}

// Глобальный экземпляр
export const globalIPManager = new IPManager();

export default IPManager;
