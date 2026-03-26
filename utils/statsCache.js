/**
 * Stats Cache - Кэширование статистики запросов
 * Улучшение производительности через кэширование часто запрашиваемых данных
 */

import { logger } from './logger.js';

/**
 * Конфигурация кэша
 */
export const CACHE_CONFIG = {
  defaultTTL: 300000, // 5 минут по умолчанию
  maxEntries: 1000, // Максимум записей в кэше
  cleanupInterval: 60000, // Очистка каждые 1 минуту
  stats: {
    enabled: true,
    historyLimit: 100 // История запросов
  }
};

/**
 * Класс для кэширования статистики
 */
export class StatsCache {
  constructor() {
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0,
      cleanups: 0,
      requests: [] // История запросов
    };
    this.cleanupInterval = null;
    this.isRunning = false;
  }

  /**
   * Инициализация кэша
   */
  init() {
    logger.info('Initializing Stats Cache...', 'cache');

    this.isRunning = true;
    this._startCleanupTimer();

    logger.info('Stats Cache initialized', 'cache');
    return this;
  }

  /**
   * Получить значение из кэша
   * @param {string} key - Ключ кэша
   * @returns {*} Значение или null
   */
  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      this._logRequest(key, 'miss');
      return null;
    }

    // Проверка TTL
    if (entry.ttl && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.expirations++;
      this.stats.misses++;
      this._logRequest(key, 'expire');
      return null;
    }

    this.stats.hits++;
    entry.accessCount = (entry.accessCount || 0) + 1;
    entry.lastAccess = Date.now();
    this._logRequest(key, 'hit');

    return entry.value;
  }

  /**
   * Установить значение в кэш
   * @param {string} key - Ключ кэша
   * @param {*} value - Значение
   * @param {number} ttl - Время жизни в мс (опционально)
   */
  set(key, value, ttl = CACHE_CONFIG.defaultTTL) {
    // Ограничение размера кэша
    if (this.cache.size >= CACHE_CONFIG.maxEntries) {
      this._evictOldest();
    }

    const entry = {
      value,
      ttl,
      expiresAt: ttl ? Date.now() + ttl : null,
      createdAt: Date.now(),
      lastAccess: Date.now(),
      accessCount: 0
    };

    this.cache.set(key, entry);
    this.stats.sets++;
    this._logRequest(key, 'set');

    return this;
  }

  /**
   * Проверить наличие ключа (без обновления статистики)
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    if (entry.ttl && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.expirations++;
      return false;
    }

    return true;
  }

  /**
   * Удалить значение из кэша
   * @param {string} key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
      this._logRequest(key, 'delete');
    }
    return deleted;
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    this.cache.clear();
    logger.info('Cache cleared', 'cache');
    return this;
  }

  /**
   * Получить размер кэша
   */
  size() {
    return this.cache.size;
  }

  /**
   * Получить статистику кэша
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      maxEntries: CACHE_CONFIG.maxEntries,
      hitRate: `${hitRate}%`,
      isRunning: this.isRunning
    };
  }

  /**
   * Получить информацию о конкретном ключе
   */
  getKeyInfo(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    return {
      key,
      ttl: entry.ttl,
      expiresAt: entry.expiresAt,
      createdAt: entry.createdAt,
      lastAccess: entry.lastAccess,
      accessCount: entry.accessCount,
      remainingTTL: entry.ttl ? entry.expiresAt - Date.now() : null
    };
  }

  /**
   * Очистить просроченные записи
   */
  cleanup() {
    const now = Date.now();
    let expired = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.ttl && now > entry.expiresAt) {
        this.cache.delete(key);
        expired++;
      }
    }

    if (expired > 0) {
      this.stats.expirations += expired;
      this.stats.cleanups++;
      logger.debug(`Cache cleanup: ${expired} entries expired`, 'cache');
    }

    return expired;
  }

  /**
   * Очистить старые записи по LRU
   */
  _evictOldest() {
    let oldestKey = null;
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (!oldestKey || entry.lastAccess < oldestTime) {
        oldestKey = key;
        oldestTime = entry.lastAccess;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug(`Cache eviction: ${oldestKey}`, 'cache');
    }
  }

  /**
   * Запустить таймер очистки
   */
  _startCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CACHE_CONFIG.cleanupInterval);

    // Разрешаем процессу завершиться даже с активным интервалом
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Остановить таймер очистки
   */
  _stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Логирование запросов
   */
  _logRequest(key, type) {
    if (!CACHE_CONFIG.stats.enabled) {
      return;
    }

    this.stats.requests.push({
      key,
      type,
      timestamp: Date.now()
    });

    // Ограничение истории
    if (this.stats.requests.length > CACHE_CONFIG.stats.historyLimit) {
      this.stats.requests.shift();
    }
  }

  /**
   * Получить историю запросов
   */
  getRequestHistory(limit = 10) {
    return this.stats.requests.slice(-limit);
  }

  /**
   * Сбросить статистику
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0,
      cleanups: 0,
      requests: []
    };
    logger.info('Cache stats reset', 'cache');
    return this;
  }

  /**
   * Остановить кэш
   */
  stop() {
    this._stopCleanupTimer();
    this.isRunning = false;
    logger.info('Stats Cache stopped', 'cache');
  }

  /**
   * Экспорт данных кэша
   */
  export() {
    return {
      stats: this.getStats(),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ...entry
      })),
      config: CACHE_CONFIG
    };
  }
}

// Глобальный экземпляр
export const globalStatsCache = new StatsCache();

export default StatsCache;
