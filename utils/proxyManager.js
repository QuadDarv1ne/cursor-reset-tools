/**
 * Proxy Manager - Управление прокси для обхода региональных ограничений
 * Поддерживает SOCKS5 и HTTP прокси с ротацией и проверкой
 */

import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';
import fetch from 'node-fetch';
import { logger } from './logger.js';

/**
 * Класс для управления прокси
 */
export class ProxyManager {
  constructor() {
    this.currentProxy = null;
    this.proxyList = [];
    this.failedProxies = new Set();
    this.workingProxies = [];
    this.rotationIndex = 0;
    this.checkTimeout = 10000; // 10 секунд
  }

  /**
   * Парсинг строки прокси в формат URL
   * @param {string} proxyStr - Строка прокси (host:port или user:pass@host:port)
   * @param {string} protocol - Протокол (socks5, http, https)
   * @returns {string}
   */
  parseProxy(proxyStr, protocol = 'socks5') {
    const parts = proxyStr.split('@');
    let auth = '';
    let hostPort = '';

    if (parts.length === 2) {
      // Есть авторизация: user:pass@host:port
      const [authPart, hostPortPart] = parts;
      const hostParts = hostPortPart.split(':');
      auth = authPart;
      hostPort = `${hostParts[0]}:${hostParts[1]}`;
    } else {
      // Нет авторизации: host:port
      const hostParts = proxyStr.split(':');
      hostPort = `${hostParts[0]}:${hostParts[1]}`;
    }

    if (auth) {
      return `${protocol}://${auth}@${hostPort}`;
    }
    return `${protocol}://${hostPort}`;
  }

  /**
   * Добавление прокси в список
   * @param {string} proxyStr - Строка прокси
   * @param {string} protocol - Протокол
   */
  addProxy(proxyStr, protocol = 'socks5') {
    const proxyUrl = this.parseProxy(proxyStr, protocol);
    if (!this.proxyList.some(p => p.url === proxyUrl)) {
      this.proxyList.push({
        url: proxyUrl,
        protocol,
        added: Date.now(),
        failed: false
      });
      logger.info(`Proxy added: ${proxyUrl}`, 'proxy');
    }
  }

  /**
   * Добавление нескольких прокси из массива
   * @param {Array<{url: string, protocol?: string}>} proxies
   */
  addProxies(proxies) {
    proxies.forEach(({ url, protocol = 'socks5' }) => {
      this.addProxy(url, protocol);
    });
    logger.info(`Added ${proxies.length} proxies`, 'proxy');
  }

  /**
   * Создание агента для текущего прокси
   * @returns {Agent|null}
   */
  createAgent() {
    if (!this.currentProxy) {
      return null;
    }

    try {
      const { url, protocol } = this.currentProxy;

      if (protocol === 'socks5' || protocol === 'socks4') {
        return new SocksProxyAgent(url);
      } else if (protocol === 'http' || protocol === 'https') {
        return new HttpProxyAgent(url);
      }

      logger.warn(`Unknown proxy protocol: ${protocol}`, 'proxy');
      return null;
    } catch (error) {
      logger.error(`Failed to create proxy agent: ${error.message}`, 'proxy');
      return null;
    }
  }

  /**
   * Проверка работоспособности прокси
   * @param {string} proxyUrl - URL прокси
   * @param {string} protocol - Протокол
   * @returns {Promise<boolean>}
   */
  async checkProxy(proxyUrl, protocol) {
    const agent = this._createAgentForUrl(proxyUrl, protocol);
    
    if (!agent) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.checkTimeout);

      const response = await fetch('https://api.ipify.org?format=json', {
        agent,
        signal: controller.signal,
        timeout: this.checkTimeout
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        logger.info(`Proxy working! IP: ${data.ip}`, 'proxy');
        return true;
      }

      return false;
    } catch (error) {
      logger.debug(`Proxy check failed: ${error.message}`, 'proxy');
      return false;
    }
  }

  /**
   * Создание агента для произвольного URL
   * @private
   */
  _createAgentForUrl(proxyUrl, protocol) {
    try {
      if (protocol === 'socks5' || protocol === 'socks4') {
        return new SocksProxyAgent(proxyUrl);
      } else if (protocol === 'http' || protocol === 'https') {
        return new HttpProxyAgent(proxyUrl);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Проверка всех прокси в списке
   * @returns {Promise<{working: Array, failed: Array}>}
   */
  async checkAllProxies() {
    const working = [];
    const failed = [];

    logger.info(`Checking ${this.proxyList.length} proxies...`, 'proxy');

    for (const proxy of this.proxyList) {
      const isWorking = await this.checkProxy(proxy.url, proxy.protocol);
      
      if (isWorking) {
        working.push(proxy);
        proxy.failed = false;
        this.workingProxies.push(proxy);
      } else {
        failed.push(proxy);
        proxy.failed = true;
        this.failedProxies.add(proxy.url);
      }
    }

    logger.info(`Check complete: ${working.length} working, ${failed.length} failed`, 'proxy');
    return { working, failed };
  }

  /**
   * Ротация на следующий рабочий прокси
   * @returns {Object|null}
   */
  rotateProxy() {
    const working = this.workingProxies.filter(p => !p.failed);
    
    if (working.length === 0) {
      logger.warn('No working proxies available', 'proxy');
      return null;
    }

    this.rotationIndex = (this.rotationIndex + 1) % working.length;
    this.currentProxy = working[this.rotationIndex];
    
    logger.info(`Rotated to proxy: ${this.currentProxy.url}`, 'proxy');
    return this.currentProxy;
  }

  /**
   * Установка конкретного прокси как текущего
   * @param {number} index - Индекс в proxyList
   * @returns {Object|null}
   */
  setProxy(index) {
    if (index < 0 || index >= this.proxyList.length) {
      logger.warn(`Invalid proxy index: ${index}`, 'proxy');
      return null;
    }

    this.currentProxy = this.proxyList[index];
    this.rotationIndex = index;
    logger.info(`Set proxy: ${this.currentProxy.url}`, 'proxy');
    return this.currentProxy;
  }

  /**
   * Получение текущего прокси
   * @returns {Object|null}
   */
  getCurrentProxy() {
    return this.currentProxy;
  }

  /**
   * Получение списка всех прокси
   * @returns {Array}
   */
  getProxyList() {
    return this.proxyList.map(p => ({
      url: p.url,
      protocol: p.protocol,
      working: !p.failed,
      added: p.added
    }));
  }

  /**
   * Получение статистики
   * @returns {Object}
   */
  getStats() {
    const total = this.proxyList.length;
    const working = this.workingProxies.filter(p => !p.failed).length;
    const failed = this.failedProxies.size;

    return {
      total,
      working,
      failed,
      currentProxy: this.currentProxy?.url || null,
      rotationIndex: this.rotationIndex
    };
  }

  /**
   * Сброс текущего прокси (работа без прокси)
   */
  clearProxy() {
    this.currentProxy = null;
    logger.info('Proxy cleared, working without proxy', 'proxy');
  }

  /**
   * Удаление нерабочих прокси из списка
   */
  cleanupFailedProxies() {
    const initialLength = this.proxyList.length;
    this.proxyList = this.proxyList.filter(p => !p.failed);
    this.workingProxies = this.workingProxies.filter(p => !p.failed);
    this.failedProxies.clear();
    
    const removed = initialLength - this.proxyList.length;
    if (removed > 0) {
      logger.info(`Cleaned up ${removed} failed proxies`, 'proxy');
    }
  }

  /**
   * Получение fetch функции с прокси
   * @returns {Function}
   */
  getFetch() {
    const agent = this.createAgent();
    
    return async (url, options = {}) => {
      return fetch(url, {
        ...options,
        agent: agent || undefined
      });
    };
  }

  /**
   * Загрузка прокси из файла
   * @param {string} filePath - Путь к файлу
   * @param {string} defaultProtocol - Протокол по умолчанию
   */
  async loadFromFile(filePath, defaultProtocol = 'socks5') {
    try {
      const fs = await import('fs-extra');
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          // Проверка формата: protocol:host:port или host:port
          const parts = trimmed.split(':');
          if (parts.length >= 2) {
            let proxyUrl, protocol;
            
            // Если первая часть - протокол
            if (['socks5', 'socks4', 'http', 'https'].includes(parts[0])) {
              protocol = parts[0];
              proxyUrl = trimmed;
            } else {
              protocol = defaultProtocol;
              proxyUrl = trimmed;
            }
            
            this.addProxy(proxyUrl, protocol);
          }
        }
      });
      
      logger.info(`Loaded proxies from ${filePath}`, 'proxy');
    } catch (error) {
      logger.error(`Failed to load proxies from file: ${error.message}`, 'proxy');
      throw error;
    }
  }

  /**
   * Сохранение текущих прокси в файл
   * @param {string} filePath - Путь к файлу
   */
  async saveToFile(filePath) {
    try {
      const fs = await import('fs-extra');
      const content = this.proxyList.map(p => {
        const url = p.url.replace(/^[a-z]+:\/\//, '');
        return `${p.protocol}:${url}`;
      }).join('\n');
      
      await fs.writeFile(filePath, content, 'utf8');
      logger.info(`Saved ${this.proxyList.length} proxies to ${filePath}`, 'proxy');
    } catch (error) {
      logger.error(`Failed to save proxies to file: ${error.message}`, 'proxy');
      throw error;
    }
  }
}

// Глобальный экземпляр
export const globalProxyManager = new ProxyManager();

export default ProxyManager;
