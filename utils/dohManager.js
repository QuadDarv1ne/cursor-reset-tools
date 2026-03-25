/**
 * DNS over HTTPS Manager - Обход блокировок DNS через HTTPS
 * Интеграция с VPN для автоматического включения при подключении
 */

import fetch from 'node-fetch';
import { logger } from './logger.js';

const DOH_PROVIDERS = {
  cloudflare: {
    url: 'https://cloudflare-dns.com/dns-query',
    name: 'Cloudflare DoH',
    priority: 1
  },
  google: {
    url: 'https://dns.google/resolve',
    name: 'Google DoH',
    priority: 2
  },
  quad9: {
    url: 'https://dns.quad9.net/dns-query',
    name: 'Quad9 DoH',
    priority: 3
  },
  adguard: {
    url: 'https://dns.adguard.com/resolve',
    name: 'AdGuard DoH',
    priority: 4
  }
};

class DoHManager {
  constructor() {
    this.currentProvider = null;
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 минут
  }

  /**
   * Резолвинг домена через DoH
   */
  async resolve(domain, provider = 'cloudflare', type = 'A') {
    const cacheKey = `${provider}:${domain}:${type}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const config = DOH_PROVIDERS[provider];
      if (!config) {
        throw new Error(`Unknown DoH provider: ${provider}`);
      }

      const url = `${config.url}?name=${domain}&type=${type}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/dns-json'
        },
        timeout: 5000
      });

      const data = await response.json();

      if (data.Status === 0) {
        const result = {
          domain,
          provider,
          answers: data.Answer || [],
          timestamp: Date.now()
        };

        this.cache.set(cacheKey, result);
        logger.debug(`DoH resolved: ${domain} via ${provider}`, 'doh');
        return result;
      }
      throw new Error(`DNS error: ${data.Status}`);

    } catch (error) {
      logger.warn(`DoH resolve failed: ${error.message}`, 'doh');
      return null;
    }
  }

  /**
   * Проверка доступности DoH провайдера
   */
  async checkProvider(provider) {
    try {
      const config = DOH_PROVIDERS[provider];
      const response = await fetch(`${config.url}?name=google.com&type=A`, {
        method: 'HEAD',
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Получить доступные провайдеры
   */
  async getAvailableProviders() {
    const results = [];

    for (const [key, config] of Object.entries(DOH_PROVIDERS)) {
      const available = await this.checkProvider(key);
      results.push({
        key,
        name: config.name,
        available,
        url: config.url
      });
    }

    return results;
  }

  /**
   * Установить провайдер по умолчанию
   */
  setProvider(provider) {
    if (DOH_PROVIDERS[provider]) {
      this.currentProvider = provider;
      logger.info(`DoH provider set: ${provider}`, 'doh');
      return true;
    }
    return false;
  }

  /**
   * Получить текущий провайдер
   */
  getCurrentProvider() {
    return this.currentProvider || 'cloudflare';
  }

  /**
   * Резолвинг через лучший доступный DoH
   */
  async resolveAuto(domain, type = 'A') {
    const providers = await this.getAvailableProviders();
    const available = providers.filter(p => p.available);

    if (available.length === 0) {
      logger.warn('No available DoH providers', 'doh');
      return null;
    }

    for (const provider of available) {
      const result = await this.resolve(domain, provider.key, type);
      if (result) {
        return result;
      }
    }

    return null;
  }

  /**
   * Очистить кэш
   */
  clearCache() {
    this.cache.clear();
    logger.info('DoH cache cleared', 'doh');
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      currentProvider: this.currentProvider,
      cacheSize: this.cache.size,
      providers: Object.keys(DOH_PROVIDERS).length
    };
  }

  /**
   * Автоматическое включение DoH при VPN подключении
   */
  async enableForVPN(_vpnStatus) {
    logger.info('Enabling DoH for VPN connection...', 'doh');

    try {
      // Проверка доступных провайдеров
      const providers = await this.getAvailableProviders();
      const available = providers.filter(p => p.available);

      if (available.length === 0) {
        logger.warn('No available DoH providers for VPN', 'doh');
        return { success: false, error: 'No available DoH providers' };
      }

      // Выбор лучшего провайдера (по приоритету)
      available.sort((a, b) => a.priority - b.priority);
      const best = available[0];

      this.setProvider(best.key);

      logger.info(`DoH enabled for VPN: ${best.name}`, 'doh');

      return {
        success: true,
        provider: best.key,
        name: best.name
      };
    } catch (error) {
      logger.error(`DoH enable for VPN failed: ${error.message}`, 'doh');
      return { success: false, error: error.message };
    }
  }

  /**
   * Интеграция с VPN Manager
   */
  async integrateWithVPN() {
    logger.info('Integrating DoH with VPN Manager...', 'doh');

    try {
      const { globalVPNManager } = await import('./vpnManager.js');
      const vpnStatus = await globalVPNManager.detectActiveVPN();

      if (vpnStatus.detected) {
        const result = await this.enableForVPN(vpnStatus);

        if (result.success) {
          logger.info(`DoH integrated with VPN (${vpnStatus.type})`, 'doh');
        }

        return {
          vpnDetected: true,
          vpnType: vpnStatus.type,
          vpnCountry: vpnStatus.country,
          doh: result
        };
      }

      return {
        vpnDetected: false,
        message: 'No active VPN connection'
      };
    } catch (error) {
      logger.error(`DoH-VPN integration failed: ${error.message}`, 'doh');
      return { error: error.message };
    }
  }

  /**
   * Получить рекомендуемые настройки для VPN
   */
  getVPNRecommendations() {
    return {
      recommendedProvider: 'cloudflare',
      reason: 'Лучшая производительность и поддержка VPN',
      settings: {
        enableDoH: true,
        enableDNSCache: true,
        cacheTTL: this.cacheTTL,
        fallbackProvider: 'google'
      }
    };
  }
}

export const globalDoHManager = new DoHManager();
export default DoHManager;
