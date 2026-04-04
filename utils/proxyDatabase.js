/**
 * Proxy Database - База данных прокси с авто-обновлением
 * Встроенные списки + загрузка из внешних API
 */

import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { globalProxyManager } from './proxyManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'proxies.json');

/**
 * Встроенный список бесплатных прокси (обновляется вручную)
 */
const BUILTIN_PROXIES = [
  // SOCKS5 прокси
  { url: 'proxy1.socks5.example:1080', protocol: 'socks5', country: 'US', speed: 'fast' },
  { url: 'proxy2.socks5.example:1080', protocol: 'socks5', country: 'DE', speed: 'medium' },
  { url: 'proxy3.socks5.example:1080', protocol: 'socks5', country: 'NL', speed: 'fast' },
  { url: 'proxy4.socks5.example:1080', protocol: 'socks5', country: 'FR', speed: 'slow' },
  { url: 'proxy5.socks5.example:1080', protocol: 'socks5', country: 'GB', speed: 'fast' },
  { url: 'proxy6.socks5.example:1080', protocol: 'socks5', country: 'JP', speed: 'medium' },
  { url: 'proxy7.socks5.example:1080', protocol: 'socks5', country: 'SG', speed: 'fast' },
  { url: 'proxy8.socks5.example:1080', protocol: 'socks5', country: 'CA', speed: 'medium' },

  // HTTP прокси
  { url: 'proxy1.http.example:8080', protocol: 'http', country: 'US', speed: 'fast' },
  { url: 'proxy2.http.example:8080', protocol: 'http', country: 'DE', speed: 'medium' },
  { url: 'proxy3.http.example:8080', protocol: 'http', country: 'NL', speed: 'fast' },
  { url: 'proxy4.http.example:8080', protocol: 'http', country: 'FR', speed: 'slow' },
  { url: 'proxy5.http.example:8080', protocol: 'http', country: 'GB', speed: 'fast' },
];

/**
 * API для получения бесплатных прокси
 */
const PROXY_APIS = [
  {
    name: 'ProxyList',
    url: 'https://api.proxyscrape.com/v2/?request=get&protocol=socks5&timeout=10000&country=all',
    format: 'text',
    protocol: 'socks5'
  },
  {
    name: 'OpenProxyList',
    url: 'https://openproxylist.xyz/socks5.txt',
    format: 'text',
    protocol: 'socks5'
  },
  {
    name: 'ProxyHTTP',
    url: 'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=all',
    format: 'text',
    protocol: 'http'
  },
  {
    name: 'Geonode API',
    url: 'https://proxylist.geonode.com/api/proxy-list?limit=50&page=1&sort_by=lastChecked&sort_type=desc&protocols=socks5',
    format: 'json',
    protocol: 'socks5',
    parseField: 'ip_port'
  }
];

/**
 * Класс для управления базой прокси
 */
export class ProxyDatabase {
  constructor() {
    this.proxies = [];
    this.lastUpdate = null;
    this.updateInterval = null;
    this.autoUpdateEnabled = false;
    this.stats = {
      total: 0,
      working: 0,
      failed: 0,
      byCountry: {},
      byProtocol: {}
    };
  }

  /**
   * Инициализация базы прокси
   */
  async init() {
    logger.info('Initializing proxy database...', 'proxy-db');

    // Загрузка из файла
    await this.loadFromFile();

    // Если файл пустой, загружаем встроенные прокси
    if (this.proxies.length === 0) {
      this.loadBuiltIn();
    }

    // Загрузка из API
    await this.fetchFromAPIs();

    // Сохранение и подсчёт статистики
    await this.saveToFile();
    this.updateStats();

    logger.info(`Proxy database initialized: ${this.proxies.length} proxies`, 'proxy-db');
  }

  /**
   * Загрузка из файла
   */
  async loadFromFile() {
    try {
      if (await fs.pathExists(DATA_FILE)) {
        const data = await fs.readJson(DATA_FILE);
        this.proxies = data.proxies || [];
        this.lastUpdate = data.lastUpdate;

        // Восстановление статистики
        this.updateStats();

        logger.info(`Loaded ${this.proxies.length} proxies from file`, 'proxy-db');
      }
    } catch (error) {
      logger.warn(`Failed to load from file: ${error.message}`, 'proxy-db');
    }
  }

  /**
   * Сохранение в файл
   */
  async saveToFile() {
    try {
      await fs.ensureDir(path.dirname(DATA_FILE));
      const data = {
        proxies: this.proxies,
        lastUpdate: this.lastUpdate,
        version: 1
      };
      await fs.writeJson(DATA_FILE, data, { spaces: 2 });
      logger.info(`Saved ${this.proxies.length} proxies to file`, 'proxy-db');
    } catch (error) {
      logger.error(`Failed to save to file: ${error.message}`, 'proxy-db');
    }
  }

  /**
   * Загрузка встроенных прокси
   */
  loadBuiltIn() {
    for (const proxy of BUILTIN_PROXIES) {
      this.addProxy(proxy.url, proxy.protocol, proxy.country, proxy.speed);
    }
    logger.info(`Loaded ${BUILTIN_PROXIES.length} built-in proxies`, 'proxy-db');
  }

  /**
   * Добавление прокси в базу
   */
  addProxy(url, protocol = 'socks5', country = 'Unknown', speed = 'unknown') {
    const exists = this.proxies.some(p => p.url === url);
    if (exists) {return false;}

    const proxy = {
      url,
      protocol,
      country,
      speed,
      added: Date.now(),
      lastChecked: null,
      working: null,
      responseTime: null,
      failures: 0
    };

    this.proxies.push(proxy);
    return true;
  }

  /**
   * Загрузка прокси из внешних API
   */
  async fetchFromAPIs() {
    logger.info('Fetching proxies from APIs...', 'proxy-db');

    const results = await Promise.allSettled(
      PROXY_APIS.map(api => this.fetchFromAPI(api))
    );

    let successCount = 0;
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successCount++;
        logger.info(`API ${PROXY_APIS[index].name}: ${result.value} proxies`, 'proxy-db');
      } else {
        logger.warn(`API ${PROXY_APIS[index].name} failed: ${result.reason}`, 'proxy-db');
      }
    });

    logger.info(`Fetched from ${successCount}/${PROXY_APIS.length} APIs`, 'proxy-db');
  }

  /**
   * Загрузка из одного API
   */
  async fetchFromAPI(api) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      timeout.unref();

      const response = await fetch(api.url, {
        signal: controller.signal,
        timeout: 15000
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      let proxies = [];

      if (api.format === 'text') {
        const text = await response.text();
        const lines = text.split('\n').filter(line => line.trim());
        proxies = lines.map(line => ({
          url: line.trim(),
          protocol: api.protocol,
          country: 'Unknown',
          speed: 'unknown'
        }));
      } else if (api.format === 'json') {
        const data = await response.json();
        const proxyList = data.data || data.proxies || data || [];

        proxies = proxyList.map(p => {
          const ipPort = api.parseField
            ? p[api.parseField]
            : `${p.ip}:${p.port}`;

          return {
            url: ipPort,
            protocol: api.protocol,
            country: p.country || p.country_code || 'Unknown',
            speed: p.speed || 'unknown'
          };
        });
      }

      // Добавление уникальных прокси
      let addedCount = 0;
      for (const proxy of proxies) {
        if (this.addProxy(proxy.url, proxy.protocol, proxy.country, proxy.speed)) {
          addedCount++;
        }
      }

      return addedCount;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Обновление статистики
   */
  updateStats() {
    this.stats.total = this.proxies.length;
    this.stats.working = this.proxies.filter(p => p.working === true).length;
    this.stats.failed = this.proxies.filter(p => p.working === false).length;

    // По странам
    this.stats.byCountry = {};
    this.proxies.forEach(p => {
      this.stats.byCountry[p.country] = (this.stats.byCountry[p.country] || 0) + 1;
    });

    // По протоколам
    this.stats.byProtocol = {};
    this.proxies.forEach(p => {
      this.stats.byProtocol[p.protocol] = (this.stats.byProtocol[p.protocol] || 0) + 1;
    });

    this.lastUpdate = Date.now();
  }

  /**
   * Получение списка прокси с фильтрами
   */
  getProxies(filters = {}) {
    const {
      protocol,
      country,
      workingOnly = false,
      limit = 100,
      sortBy = 'added'
    } = filters;

    let filtered = [...this.proxies];

    // Фильтр по протоколу
    if (protocol) {
      filtered = filtered.filter(p => p.protocol === protocol);
    }

    // Фильтр по стране
    if (country) {
      filtered = filtered.filter(p =>
        p.country.toLowerCase() === country.toLowerCase()
      );
    }

    // Только рабочие
    if (workingOnly) {
      filtered = filtered.filter(p => p.working === true);
    }

    // Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'added') {return b.added - a.added;}
      if (sortBy === 'responseTime') {return (a.responseTime || 9999) - (b.responseTime || 9999);}
      if (sortBy === 'country') {return a.country.localeCompare(b.country);}
      return 0;
    });

    // Лимит
    return filtered.slice(0, limit);
  }

  /**
   * Обновление статуса прокси
   */
  updateProxyStatus(url, working, responseTime = null) {
    const proxy = this.proxies.find(p => p.url === url);
    if (!proxy) {return false;}

    proxy.working = working;
    proxy.lastChecked = Date.now();
    proxy.responseTime = responseTime;

    if (!working) {
      proxy.failures++;
    } else {
      proxy.failures = 0;
    }

    this.updateStats();
    return true;
  }

  /**
   * Удаление нерабочих прокси
   */
  cleanupFailed(maxFailures = 3) {
    const initialLength = this.proxies.length;
    this.proxies = this.proxies.filter(p => p.failures < maxFailures);
    const removed = initialLength - this.proxies.length;

    logger.info(`Cleaned up ${removed} failed proxies`, 'proxy-db');
    this.updateStats();
    this.saveToFile();

    return removed;
  }

  /**
   * Включение авто-обновления
   */
  enableAutoUpdate(intervalMs = 300000) { // 5 минут по умолчанию
    if (this.autoUpdateEnabled) {
      this.disableAutoUpdate();
    }

    this.autoUpdateEnabled = true;

    this.updateInterval = setInterval(async () => {
      logger.info('Auto-updating proxy database...', 'proxy-db');
      await this.refresh();
    }, intervalMs);

    // Разрешаем процессу завершиться даже с активным интервалом
    if (this.updateInterval && typeof this.updateInterval.unref === 'function') {
      this.updateInterval.unref();
    }

    logger.info(`Auto-update enabled (interval: ${intervalMs}ms)`, 'proxy-db');
  }

  /**
   * Отключение авто-обновления
   */
  disableAutoUpdate() {
    this.autoUpdateEnabled = false;
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    logger.info('Auto-update disabled', 'proxy-db');
  }

  /**
   * Полное обновление базы
   */
  async refresh() {
    logger.info('Refreshing proxy database...', 'proxy-db');

    // Очистка старых нерабочих
    this.cleanupFailed(5);

    // Загрузка из API
    await this.fetchFromAPIs();

    // Сохранение и обновление статистики
    await this.saveToFile();
    this.updateStats();

    logger.info(`Refresh complete: ${this.proxies.length} proxies`, 'proxy-db');
  }

  /**
   * Проверка всех прокси в базе
   */
  async checkAllProxies(concurrency = 5) {
    logger.info(`Checking all proxies (concurrency: ${concurrency})...`, 'proxy-db');

    const checked = [];
    const working = [];
    const failed = [];

    // Проверка с ограничением параллелизма
    for (let i = 0; i < this.proxies.length; i += concurrency) {
      const batch = this.proxies.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async proxy => {
          const isWorking = await globalProxyManager.checkProxy(
            globalProxyManager.parseProxy(proxy.url, proxy.protocol),
            proxy.protocol
          );

          this.updateProxyStatus(proxy.url, isWorking);

          return { proxy, isWorking };
        })
      );

      results.forEach((result, _index) => {
        if (result.status === 'fulfilled') {
          checked.push(result.value.proxy.url);
          if (result.value.isWorking) {
            working.push(result.value.proxy.url);
          } else {
            failed.push(result.value.proxy.url);
          }
        }
      });

      logger.info(`Progress: ${Math.min(i + concurrency, this.proxies.length)}/${this.proxies.length}`, 'proxy-db');
    }

    logger.info(`Check complete: ${working.length} working, ${failed.length} failed`, 'proxy-db');

    return { checked: checked.length, working, failed };
  }

  /**
   * Получение случайного рабочего прокси
   */
  getRandomWorking(protocol = null) {
    const working = this.proxies.filter(p =>
      p.working === true && (!protocol || p.protocol === protocol)
    );

    if (working.length === 0) {return null;}

    return working[Math.floor(Math.random() * working.length)];
  }

  /**
   * Получение лучшего прокси по стране
   */
  getBestByCountry(country, protocol = null) {
    const filtered = this.proxies.filter(p =>
      p.country.toLowerCase() === country.toLowerCase() &&
      p.working === true &&
      (!protocol || p.protocol === protocol)
    );

    // Сортировка по времени отклика
    filtered.sort((a, b) => (a.responseTime || 9999) - (b.responseTime || 9999));

    return filtered[0] || null;
  }

  /**
   * Получение списка стран
   */
  getAvailableCountries() {
    return Object.keys(this.stats.byCountry).sort();
  }

  /**
   * Экспорт прокси в файл
   */
  async exportToFile(filePath) {
    try {
      const fs = await import('fs-extra');
      const content = this.proxies.map(p => `${p.protocol}:${p.url}`).join('\n');
      await fs.writeFile(filePath, content, 'utf8');
      logger.info(`Exported ${this.proxies.length} proxies to ${filePath}`, 'proxy-db');
      return true;
    } catch (error) {
      logger.error(`Export failed: ${error.message}`, 'proxy-db');
      return false;
    }
  }

  /**
   * Импорт прокси из файла
   */
  async importFromFile(filePath, defaultProtocol = 'socks5') {
    try {
      const fs = await import('fs-extra');
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      let addedCount = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const parts = trimmed.split(':');
          if (parts.length >= 2) {
            let protocol = defaultProtocol;
            const url = trimmed;

            if (['socks5', 'socks4', 'http', 'https'].includes(parts[0])) {
              protocol = parts[0];
            }

            if (this.addProxy(url, protocol, 'Unknown', 'unknown')) {
              addedCount++;
            }
          }
        }
      }

      this.updateStats();
      logger.info(`Imported ${addedCount} proxies from ${filePath}`, 'proxy-db');
      return addedCount;
    } catch (error) {
      logger.error(`Import failed: ${error.message}`, 'proxy-db');
      return 0;
    }
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      ...this.stats,
      lastUpdate: this.lastUpdate,
      autoUpdateEnabled: this.autoUpdateEnabled
    };
  }

  /**
   * Получение информации о базе
   */
  getInfo() {
    return {
      total: this.proxies.length,
      working: this.stats.working,
      failed: this.stats.failed,
      countries: this.getAvailableCountries(),
      protocols: Object.keys(this.stats.byProtocol),
      lastUpdate: this.lastUpdate,
      autoUpdateEnabled: this.autoUpdateEnabled
    };
  }

  /**
   * Сброс базы
   */
  reset() {
    this.proxies = [];
    this.lastUpdate = null;
    this.disableAutoUpdate();
    this.updateStats();
    logger.info('Proxy database reset', 'proxy-db');
  }

  /**
   * Закрытие базы (для graceful shutdown)
   */
  close() {
    this.disableAutoUpdate();
    logger.info('Proxy Database closed', 'proxy-db');
    return true;
  }
}

// Глобальный экземпляр
export const globalProxyDatabase = new ProxyDatabase();

export default ProxyDatabase;
