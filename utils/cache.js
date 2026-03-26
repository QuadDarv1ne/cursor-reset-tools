import { config } from './config.js';
import { logger } from './logger.js';

/**
 * Расширенный кэш с TTL и поддержкой инвалидации по событиям
 * @module utils/cache
 */

/**
 * Конфигурация кэша
 */
const CACHE_CONFIG = {
  defaultTTL: config.timeouts.cacheTTL,
  maxEntries: 1000, // Максимальное количество записей
  cleanupInterval: 60000, // Интервал очистки (1 минута)
  watchEnabled: true // Включить наблюдение за файлами
};

/**
 * Класс расширенного кэша с поддержкой инвалидации
 */
export class Cache {
  constructor(ttl = CACHE_CONFIG.defaultTTL) {
    this.store = new Map();
    this.defaultTTL = ttl;
    this.listeners = new Map(); // Слушатели событий для инвалидации
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    this.cleanupTimer = null;

    // Запуск периодической очистки
    this.startCleanup();
  }

  /**
   * Получить значение из кэша
   * @param {string} key
   * @returns {*} undefined если не найдено или истёк TTL
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) {
      this.stats.misses++;
      return undefined;
    }

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      this.stats.evictions++;
      this.stats.misses++;
      return undefined;
    }

    this.stats.hits++;
    return item.value;
  }

  /**
   * Сохранить значение в кэш
   * @param {string} key
   * @param {*} value
   * @param {number} [ttl] - TTL в мс (опционально)
   */
  set(key, value, ttl = this.defaultTTL) {
    // Проверка на максимальное количество записей
    if (this.store.size >= CACHE_CONFIG.maxEntries && !this.store.has(key)) {
      // Удаляем oldest entry
      const oldestKey = this.store.keys().next().value;
      this.store.delete(oldestKey);
      this.stats.evictions++;
    }

    this.store.set(key, {
      value,
      expiry: Date.now() + ttl,
      createdAt: Date.now()
    });
    this.stats.sets++;
  }

  /**
   * Удалить значение из кэша
   * @param {string} key
   */
  delete(key) {
    const deleted = this.store.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * Удалить ключи по паттерну
   * @param {string} pattern - Паттерн (например, 'cursor:*')
   * @returns {number} Количество удалённых ключей
   */
  deleteByPattern(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let count = 0;

    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        this.store.delete(key);
        count++;
      }
    }

    this.stats.deletes += count;
    logger.debug(`Cache: deleted ${count} keys by pattern "${pattern}"`, 'cache');
    return count;
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    this.store.clear();
    this.stats.deletes += this.store.size;
    logger.debug('Cache: cleared', 'cache');
  }

  /**
   * Получить или вычислить значение
   * @param {string} key
   * @param {Function} computeFn - Функция для вычисления если не в кэше
   * @param {number} [ttl]
   * @returns {Promise<*>}
   */
  async getOrCompute(key, computeFn, ttl = this.defaultTTL) {
    let value = this.get(key);

    if (value === undefined) {
      value = await computeFn();
      this.set(key, value, ttl);
    }

    return value;
  }

  /**
   * Получить или вычислить с блокировкой (предотвращение race condition)
   * @param {string} key
   * @param {Function} computeFn
   * @param {number} [ttl]
   * @returns {Promise<*>}
   */
  async getOrComputeLocked(key, computeFn, ttl = this.defaultTTL) {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Проверка на уже выполняющееся вычисление
    const existingPromise = this.store.get(`${key}::pending`);
    if (existingPromise) {
      return existingPromise;
    }

    // Создание нового pending promise
    const promise = computeFn().then(value => {
      this.set(key, value, ttl);
      this.store.delete(`${key}::pending`);
      return value;
    }).catch(err => {
      this.store.delete(`${key}::pending`);
      throw err;
    });

    this.store.set(`${key}::pending`, promise);
    return promise;
  }

  /**
   * Подписаться на событие для инвалидации
   * @param {string} event - Имя события (например, 'file:changed')
   * @param {Function} handler - Обработчик
   */
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(handler);
  }

  /**
   * Отписаться от события
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Вызвать событие инвалидации
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          logger.error(`Cache event handler error: ${err.message}`, 'cache');
        }
      }
    }
  }

  /**
   * Инвалидировать кэш по событию
   * @param {string} event - Событие
   * @param {string} keyPattern - Паттерн ключей для инвалидации
   */
  invalidateOn(event, keyPattern) {
    this.on(event, () => {
      const count = this.deleteByPattern(keyPattern);
      logger.debug(`Cache invalidated ${count} entries on "${event}"`, 'cache');
    });
  }

  /**
   * Запуск периодической очистки
   */
  startCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      let count = 0;
      const now = Date.now();

      for (const [key, item] of this.store) {
        if (now > item.expiry) {
          this.store.delete(key);
          count++;
          this.stats.evictions++;
        }
      }

      if (count > 0) {
        logger.debug(`Cache cleanup: removed ${count} expired entries`, 'cache');
      }
    }, CACHE_CONFIG.cleanupInterval);
    
    // Разрешаем процессу завершиться даже с активным интервалом
    if (this.cleanupTimer && typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Остановка очистки
   */
  stopCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Получить статистику
   * @returns {Object}
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.store.size,
      hitRate: total > 0 ? `${((this.stats.hits / total) * 100).toFixed(2)}%` : '0%',
      efficiency: this.stats.hits > 0 ? (this.stats.hits / this.stats.sets).toFixed(2) : 0
    };
  }

  /**
   * Размер кэша
   * @returns {number}
   */
  size() {
    return this.store.size;
  }

  /**
   * Сброс статистики
   */
  resetStats() {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }
}

// Глобальный кэш для приложения
export const globalCache = new Cache();

/**
 * Обёртка для функции с таймаутом
 * @param {Promise} promise
 * @param {number} timeout - мс
 * @param {string} errorMessage
 * @returns {Promise}
 */
export async function withTimeout(promise, timeout, errorMessage = 'Operation timed out') {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeout);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Обёртка для async функции с таймаутом
 * @param {Function} fn
 * @param {number} timeout
 * @param {string} errorMessage
 * @returns {Function}
 */
export function timeoutWrapper(fn, timeout, errorMessage = 'Operation timed out') {
  return async (...args) => withTimeout(fn(...args), timeout, errorMessage);
}
