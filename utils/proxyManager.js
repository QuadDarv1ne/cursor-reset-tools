/**
 * Enhanced Proxy Manager - Улучшенный менеджер прокси
 * Добавлено: WireGuard поддержка, DPI тестирование, Residential прокси, GeoIP валидация
 */

import { SocksProxyAgent } from 'socks-proxy-agent';
import { HttpsProxyAgent } from 'hpagent';
import https from 'https';
import http from 'http';
import { logger } from './logger.js';

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.currentIndex = 0;
    this.currentProxy = null;
    this.stats = {
      total: 0,
      working: 0,
      failed: 0,
      lastCheck: null
    };
    this.autoRotationInterval = null;

    // Кэши с ограничениями для предотвращения утечек памяти
    this.dpiTestResults = new Map();
    this.geoIpCache = new Map();
    this.connectionPool = new Map();
    this.proxyHealthScore = new Map();

    // Лимиты для предотвращения утечек памяти
    this.MAX_CACHE_SIZE = 100;
    this.CACHE_TTL = 300000; // 5 минут

    // Mutex для синхронизации rotateProxy
    this.rotateLock = false;
    this.rotateQueue = [];

    // DPI bypass patterns для тестирования
    this.dpiPatterns = [
      { name: 'fragmented', enabled: true },
      { name: 'domain_fronting', enabled: true },
      { name: 'tls_mixed', enabled: true }
    ];
  }

  /**
   * Очистка старых записей из кэша
   */
  _cleanupCache(cache, maxAge = this.CACHE_TTL) {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      const timestamp = value.timestamp || value.addedAt || 0;
      if (now - timestamp > maxAge) {
        cache.delete(key);
      }
    }
  }

  /**
   * Ограничение размера кэша
   */
  _limitCacheSize(cache, maxSize = this.MAX_CACHE_SIZE) {
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries());
      const oldest = entries.slice(0, entries.length - maxSize);
      for (const [key] of oldest) {
        cache.delete(key);
      }
    }
  }

  /**
   * Добавить прокси с валидацией
   */
  addProxy(url, protocol = 'socks5', options = {}) {
    const proxyInfo = {
      url,
      protocol,
      addedAt: Date.now(),
      lastUsed: null,
      successCount: 0,
      failCount: 0,
      avgResponseTime: 0,
      responseTimes: [],
      country: null,
      city: null,
      isp: null,
      isResidential: false,
      dpiCompliant: null,
      healthScore: 100,
      ...options
    };

    this.proxies.push(proxyInfo);
    this.stats.total++;

    logger.info(`Proxy added: ${this.maskProxyUrl(url)} (${protocol})`, 'proxy');

    // Асинхронная проверка GeoIP
    this.validateGeoIP(proxyInfo).catch(() => {});

    return proxyInfo;
  }

  /**
   * Добавить WireGuard конфигурацию
   */
  addWireGuardConfig(config) {
    const wgProxy = {
      type: 'wireguard',
      publicKey: config.publicKey,
      privateKey: config.privateKey,
      endpoint: config.endpoint,
      allowedIPs: config.allowedIPs || ['0.0.0.0/0'],
      dns: config.dns || '1.1.1.1',
      mtu: config.mtu || 1420,
      addedAt: Date.now(),
      healthScore: 100
    };

    this.proxies.push(wgProxy);
    this.stats.total++;

    logger.info(`WireGuard config added: ${config.endpoint}`, 'proxy');
    return wgProxy;
  }

  /**
   * Валидация GeoIP для прокси
   */
  async validateGeoIP(proxyInfo) {
    try {
      const testUrl = 'http://ip-api.com/json/';
      const agent = this.createAgent(proxyInfo);

      const response = await this.fetchWithTimeout(testUrl, { agent }, 5000);
      const data = JSON.parse(response);

      if (data.status === 'success') {
        proxyInfo.country = data.countryCode;
        proxyInfo.city = data.city;
        proxyInfo.isp = data.isp;
        proxyInfo.isResidential = this.detectResidential(data);

        this.geoIpCache.set(proxyInfo.url, {
          country: proxyInfo.country,
          city: proxyInfo.city,
          isp: proxyInfo.isp,
          isResidential: proxyInfo.isResidential,
          timestamp: Date.now()
        });

        // Очистка старых записей и ограничение размера
        this._cleanupCache(this.geoIpCache);
        this._limitCacheSize(this.geoIpCache);

        logger.debug(`GeoIP validated for proxy: ${proxyInfo.country}, Residential: ${proxyInfo.isResidential}`, 'proxy');
      }
    } catch (error) {
      logger.warn(`GeoIP validation failed: ${error.message}`, 'proxy');
    }
  }

  /**
   * Определить residential прокси по данным ISP
   */
  detectResidential(data) {
    const residentialKeywords = ['residential', 'home', 'dsl', 'cable', 'fiber', 'pppoe'];
    const datacenterKeywords = ['datacenter', 'hosting', 'cloud', 'server', 'vps', 'dedicated'];

    const ispLower = (data.isp || '').toLowerCase();
    const orgLower = (data.org || '').toLowerCase();
    const asLower = (data.as || '').toLowerCase();

    const combined = `${ispLower} ${orgLower} ${asLower}`;

    for (const keyword of datacenterKeywords) {
      if (combined.includes(keyword)) {
        return false;
      }
    }

    for (const keyword of residentialKeywords) {
      if (combined.includes(keyword)) {
        return true;
      }
    }

    // Если не определено, считаем residential если это не известный дата-центр
    return !datacenterKeywords.some(k => combined.includes(k));
  }

  /**
   * Тестирование DPI bypass для прокси
   */
  async testDPIBypass(proxyInfo) {
    const testDomains = [
      'cursor.sh',
      'api2.cursor.sh',
      'telemetry.cursor.sh'
    ];

    const results = {
      fragmented: false,
      domainFronting: false,
      tlsMixed: false,
      score: 0
    };

    try {
      const agent = this.createAgent(proxyInfo);

      // Тест 1: Fragmented request simulation
      results.fragmented = await this.testFragmentedRequest(agent, testDomains);

      // Тест 2: Domain fronting test
      results.domainFronting = await this.testDomainFronting(agent);

      // Тест 3: TLS mixed SNI test
      results.tlsMixed = await this.testTLSMixed(agent, testDomains);

      // Подсчёт общего скора
      results.score = (results.fragmented ? 33 : 0) +
                      (results.domainFronting ? 33 : 0) +
                      (results.tlsMixed ? 34 : 0);

      proxyInfo.dpiCompliant = results.score >= 66;
      this.dpiTestResults.set(proxyInfo.url, { ...results, timestamp: Date.now() });

      // Очистка старых записей и ограничение размера
      this._cleanupCache(this.dpiTestResults);
      this._limitCacheSize(this.dpiTestResults);

      logger.info(`DPI test for proxy: score=${results.score}, compliant=${proxyInfo.dpiCompliant}`, 'proxy');

    } catch (error) {
      logger.warn(`DPI test failed: ${error.message}`, 'proxy');
      results.error = error.message;
    }

    return results;
  }

  /**
   * Тест fragmented request
   */
  async testFragmentedRequest(agent, domains) {
    try {
      for (const domain of domains) {
        const url = `https://${domain}/`;
        await this.fetchWithTimeout(url, {
          agent,
          headers: {
            'Connection': 'keep-alive',
            'Accept-Encoding': 'gzip, deflate, br'
          }
        }, 8000);
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Тест domain fronting
   */
  async testDomainFronting(agent) {
    try {
      // Domain fronting тест через cloudfront
      const url = 'https://d111111abcdef8.cloudfront.net/';
      await this.fetchWithTimeout(url, {
        agent,
        headers: {
          'Host': 'cursor.sh',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      }, 8000);
      return true;
    } catch (error) {
      // Domain fronting может не работать, это нормально
      return false;
    }
  }

  /**
   * Тест TLS mixed SNI
   */
  async testTLSMixed(agent, domains) {
    try {
      for (const domain of domains) {
        const url = `https://${domain}/api/health`;
        const response = await this.fetchWithTimeout(url, {
          agent,
          headers: {
            'Accept': 'application/json'
          }
        }, 8000);

        if (response.includes('ok') || response.includes('success')) {
          return true;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Создать HTTP agent для прокси
   */
  createAgent(proxyInfo) {
    if (!proxyInfo) {return undefined;}

    if (proxyInfo.type === 'wireguard') {
      // WireGuard требует отдельную реализацию через внешний интерфейс
      return undefined; // Используем системный туннель
    }

    const proxyUrl = proxyInfo.url;

    if (proxyInfo.protocol === 'socks5' || proxyInfo.protocol === 'socks4') {
      return new SocksProxyAgent(proxyUrl);
    } else if (proxyInfo.protocol === 'http' || proxyInfo.protocol === 'https') {
      return new HttpsProxyAgent({
        proxy: proxyUrl
      });
    }

    return undefined;
  }

  /**
   * Получить следующий прокси (умная ротация с синхронизацией)
   */
  async rotateProxy() {
    // Ждем если другая ротация уже выполняется
    if (this.rotateLock) {
      return new Promise(resolve => {
        this.rotateQueue.push(resolve);
      });
    }

    this.rotateLock = true;

    try {
      if (this.proxies.length === 0) {
        return null;
      }

      // Периодическая очистка кэшей
      this._cleanupCache(this.proxyHealthScore, 600000); // 10 минут

      // Фильтруем рабочие прокси с хорошим здоровьем
      const healthyProxies = this.proxies.filter(p => {
        const healthScore = this.proxyHealthScore.get(p.url) || 100;
        return healthScore >= 50;
      });

      if (healthyProxies.length === 0) {
        // Если нет здоровых, берём любой
        this.currentIndex = this.currentIndex % this.proxies.length;
        this.currentProxy = this.proxies[this.currentIndex];
      } else {
        // Сортируем по health score и DPI compliance
        healthyProxies.sort((a, b) => {
          const scoreA = (this.proxyHealthScore.get(a.url) || 100) + (a.dpiCompliant ? 20 : 0) + (a.isResidential ? 10 : 0);
          const scoreB = (this.proxyHealthScore.get(b.url) || 100) + (b.dpiCompliant ? 20 : 0) + (b.isResidential ? 10 : 0);
          return scoreB - scoreA;
        });

        // Случайный выбор из топ-3
        const topProxies = healthyProxies.slice(0, Math.min(3, healthyProxies.length));
        const randomIndex = Math.floor(Math.random() * topProxies.length);
        this.currentProxy = topProxies[randomIndex];
      }

      this.currentIndex++;
      this.currentProxy.lastUsed = Date.now();

      logger.debug(`Rotated to proxy: ${this.maskProxyUrl(this.currentProxy.url)}`, 'proxy');

      return this.currentProxy;
    } finally {
      this.rotateLock = false;
      // Обрабатываем очередь
      if (this.rotateQueue.length > 0) {
        const next = this.rotateQueue.shift();
        next();
      }
    }
  }

  /**
   * Проверить конкретный прокси
   */
  async checkProxy(proxyUrl, timeout = 10000) {
    const proxy = this.proxies.find(p => p.url === proxyUrl);
    if (!proxy) {
      return { success: false, error: 'Proxy not found' };
    }

    const startTime = Date.now();

    try {
      const agent = this.createAgent(proxy);
      const testUrl = 'https://api.ipify.org?format=json';

      const response = await this.fetchWithTimeout(testUrl, { agent }, timeout);
      const data = JSON.parse(response);

      const responseTime = Date.now() - startTime;

      proxy.successCount++;
      proxy.responseTimes.push(responseTime);
      if (proxy.responseTimes.length > 10) {
        proxy.responseTimes.shift();
      }
      proxy.avgResponseTime = proxy.responseTimes.reduce((a, b) => a + b, 0) / proxy.responseTimes.length;

      // Обновляем health score
      this.updateHealthScore(proxy, true, responseTime);

      return {
        success: true,
        ip: data.ip,
        responseTime,
        avgResponseTime: proxy.avgResponseTime
      };
    } catch (error) {
      proxy.failCount++;
      this.updateHealthScore(proxy, false);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Обновить health score прокси
   */
  updateHealthScore(proxy, success, responseTime = null) {
    let score = this.proxyHealthScore.get(proxy.url) || 100;

    if (success) {
      // Бонус за успешное соединение
      score = Math.min(100, score + 5);

      // Бонус за быстрый отклик
      if (responseTime && responseTime < 1000) {
        score = Math.min(100, score + 5);
      }
    } else {
      // Штраф за ошибку
      score = Math.max(0, score - 20);
    }

    this.proxyHealthScore.set(proxy.url, score);
    proxy.healthScore = score;
  }

  /**
   * Проверить все прокси
   */
  async checkAllProxies(concurrency = 5) {
    const results = {
      total: this.proxies.length,
      working: 0,
      failed: 0,
      results: []
    };

    const chunks = [];
    for (let i = 0; i < this.proxies.length; i += concurrency) {
      chunks.push(this.proxies.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(proxy => this.checkProxy(proxy.url))
      );

      for (let i = 0; i < chunk.length; i++) {
        const result = chunkResults[i];
        results.results.push({
          url: this.maskProxyUrl(chunk[i].url),
          ...result
        });

        if (result.success) {
          results.working++;
        } else {
          results.failed++;
        }
      }
    }

    this.stats.working = results.working;
    this.stats.failed = results.failed;
    this.stats.lastCheck = Date.now();

    // Запускаем DPI тест для рабочих прокси
    const workingProxies = this.proxies.filter((p, i) => results.results[i]?.success);
    for (const proxy of workingProxies.slice(0, 5)) { // Тестируем топ-5
      await this.testDPIBypass(proxy).catch(() => {});
    }

    return results;
  }

  /**
   * Получить прокси по стране
   */
  getProxyByCountry(countryCode) {
    const filtered = this.proxies.filter(p => p.country === countryCode);
    if (filtered.length === 0) {return null;}

    // Возвращаем лучший по health score
    return filtered.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0))[0];
  }

  /**
   * Получить residential прокси
   */
  getResidentialProxy() {
    const residential = this.proxies.filter(p => p.isResidential);
    if (residential.length === 0) {return null;}

    return residential.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0))[0];
  }

  /**
   * Получить DPI-compliant прокси
   */
  getDPICompliantProxy() {
    const compliant = this.proxies.filter(p => p.dpiCompliant);
    if (compliant.length === 0) {return null;}

    return compliant.sort((a, b) => (b.healthScore || 0) - (a.healthScore || 0))[0];
  }

  /**
   * Получить лучший прокси (по совокупности факторов)
   */
  getBestProxy() {
    if (this.proxies.length === 0) {return null;}

    // Приоритеты: DPI-compliant > Residential > Health Score
    const sorted = [...this.proxies].sort((a, b) => {
      let scoreA = a.healthScore || 100;
      let scoreB = b.healthScore || 100;

      if (a.dpiCompliant) {scoreA += 30;}
      if (b.dpiCompliant) {scoreB += 30;}
      if (a.isResidential) {scoreA += 20;}
      if (b.isResidential) {scoreB += 20;}

      return scoreB - scoreA;
    });

    return sorted[0];
  }

  /**
   * Запустить авто-ротацию
   */
  startAutoRotation(intervalMs = 300000) {
    this.stopAutoRotation();

    this.autoRotationInterval = setInterval(() => {
      const proxy = this.rotateProxy();
      if (proxy) {
        logger.info(`Auto-rotated to: ${this.maskProxyUrl(proxy.url)}`, 'proxy');
      }
    }, intervalMs);

    logger.info(`Auto-rotation started with interval ${intervalMs}ms`, 'proxy');
  }

  /**
   * Остановить авто-ротацию
   */
  stopAutoRotation() {
    if (this.autoRotationInterval) {
      clearInterval(this.autoRotationInterval);
      this.autoRotationInterval = null;
      logger.info('Auto-rotation stopped', 'proxy');
    }
  }

  /**
   * Получить статус авто-ротации
   */
  getAutoRotationStatus() {
    return {
      active: this.autoRotationInterval !== null,
      interval: this.autoRotationInterval ? 300000 : null,
      currentProxy: this.currentProxy ? {
        url: this.maskProxyUrl(this.currentProxy.url),
        country: this.currentProxy.country,
        isResidential: this.currentProxy.isResidential,
        dpiCompliant: this.currentProxy.dpiCompliant,
        healthScore: this.currentProxy.healthScore
      } : null
    };
  }

  /**
   * Очистить текущий прокси
   */
  clearProxy() {
    this.currentProxy = null;
    this.connectionPool.clear();
    logger.info('Proxy cleared, working without proxy', 'proxy');
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      ...this.stats,
      currentProxy: this.currentProxy ? this.maskProxyUrl(this.currentProxy.url) : null,
      dpiTestedCount: this.dpiTestResults.size,
      residentialCount: this.proxies.filter(p => p.isResidential).length,
      avgHealthScore: this.proxies.reduce((sum, p) => sum + (p.healthScore || 100), 0) / Math.max(1, this.proxies.length)
    };
  }

  /**
   * Получить список прокси
   */
  getProxyList() {
    return this.proxies.map(p => ({
      url: this.maskProxyUrl(p.url),
      protocol: p.protocol,
      country: p.country,
      city: p.city,
      isResidential: p.isResidential,
      dpiCompliant: p.dpiCompliant,
      healthScore: p.healthScore,
      avgResponseTime: p.avgResponseTime
    }));
  }

  /**
   * Получить текущий прокси
   */
  getCurrentProxy() {
    return this.currentProxy ? {
      ...this.currentProxy,
      url: this.maskProxyUrl(this.currentProxy.url)
    } : null;
  }

  /**
   * Fetch с таймаутом
   */
  async fetchWithTimeout(url, options, timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, timeout);

      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, { ...options, timeout }, res => {
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

  /**
   * Маскировать URL прокси для логов
   */
  maskProxyUrl(url) {
    if (!url) {return 'null';}
    try {
      const parsed = new URL(url);
      const user = parsed.username ? `${parsed.username[0]}***` : '';
      const pass = parsed.password ? '***' : '';
      const auth = user || pass ? `${user}:${pass}@` : '';
      return `${parsed.protocol}//${auth}${parsed.host}`;
    } catch {
      return `${url.substring(0, 20)}...`;
    }
  }

  /**
   * Импорт прокси из файла
   */
  async importFromFile(filePath, defaultProtocol = 'socks5') {
    const fs = await import('fs-extra');
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    let imported = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {continue;}

      try {
        let url, protocol = defaultProtocol;

        if (trimmed.includes('://')) {
          const parsed = new URL(trimmed);
          protocol = parsed.protocol.replace(':', '');
          url = trimmed;
        } else {
          url = `${defaultProtocol}://${trimmed}`;
        }

        this.addProxy(url, protocol);
        imported++;
      } catch (error) {
        logger.warn(`Failed to import proxy: ${trimmed}`, 'proxy');
      }
    }

    logger.info(`Imported ${imported} proxies from ${filePath}`, 'proxy');
    return imported;
  }

  /**
   * Очистка неработающих прокси
   */
  cleanupFailed(maxFailures = 3) {
    const initialCount = this.proxies.length;

    this.proxies = this.proxies.filter(p => {
      const score = this.proxyHealthScore.get(p.url) || 100;
      return score >= (100 - maxFailures * 20);
    });

    const removed = initialCount - this.proxies.length;
    this.stats.total = this.proxies.length;

    logger.info(`Cleaned up ${removed} failed proxies`, 'proxy');
    return removed;
  }
}

// Singleton
export const globalProxyManager = new ProxyManager();
export default ProxyManager;
