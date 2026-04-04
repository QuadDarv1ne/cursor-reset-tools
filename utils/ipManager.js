/**
 * IP Manager - Управление IP адресами и геолокацией
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';

const IP_SERVICES = [
  'https://api.ipify.org?format=json',
  'https://ipapi.co/json/',
  'https://ipwho.is/',
  'https://api.myip.com',
  'https://ipinfo.io/json'
];

const IP_HISTORY_MAX = 100; // Максимум записей в истории IP

class IPManager {
  constructor() {
    this.currentIP = null;
    this.ipHistory = [];
    this.lastCheck = null;
    this.cacheTimeout = 30000; // 30 секунд
  }

  /**
   * Получить текущий IP адрес
   */
  async getCurrentIP() {
    // Проверка кэша
    if (this.currentIP && this.lastCheck && (Date.now() - this.lastCheck) < this.cacheTimeout) {
      return this.currentIP;
    }

    for (const service of IP_SERVICES) {
      try {
        const response = await fetch(service, { timeout: 5000 });
        const data = await response.json();

        const ip = data.ip || data.query;
        if (ip) {
          this.currentIP = {
            ip,
            country: data.country || data.country_name,
            countryCode: data.countryCode || data.country_code,
            region: data.region || data.regionName,
            city: data.city,
            isp: data.isp || data.org,
            timezone: data.timezone
          };
          this.lastCheck = Date.now();

          logger.info(`IP detected: ${JSON.stringify({ ip, country: this.currentIP.country })}`, 'ip');
          return this.currentIP;
        }
      } catch (error) {
        logger.debug(`IP service ${service} failed: ${error.message}`, 'ip');
        continue;
      }
    }

    logger.warn('All IP services failed', 'ip');
    return { ip: 'unknown', country: 'unknown', countryCode: 'unknown' };
  }

  /**
   * Проверить изменился ли IP
   */
  async checkIPChanged() {
    const previousIP = this.currentIP?.ip;
    const currentIP = await this.getCurrentIP();

    const changed = previousIP && previousIP !== currentIP.ip;

    if (changed) {
      this.ipHistory.push({
        ip: previousIP,
        changedAt: Date.now(),
        newIP: currentIP.ip
      });

      // Ограничиваем размер истории
      if (this.ipHistory.length > IP_HISTORY_MAX) {
        this.ipHistory = this.ipHistory.slice(-IP_HISTORY_MAX);
      }

      logger.info(`IP changed: ${previousIP} -> ${currentIP.ip}`, 'ip');
    }

    return {
      changed,
      previous: previousIP,
      current: currentIP
    };
  }

  /**
   * Получить историю IP
   */
  getHistory() {
    return this.ipHistory;
  }

  /**
   * Принудительно обновить IP
   */
  async refresh() {
    this.lastCheck = null;
    return this.getCurrentIP();
  }

  /**
   * Получить информацию об IP
   */
  getInfo() {
    return {
      current: this.currentIP,
      lastCheck: this.lastCheck,
      historyCount: this.ipHistory.length
    };
  }

  /**
   * Остановить менеджер (для graceful shutdown)
   */
  stop() {
    this.currentIP = null;
    this.ipHistory = [];
    logger.info('IP Manager stopped', 'ip');
    return true;
  }
}

export const globalIPManager = new IPManager();
export default IPManager;
