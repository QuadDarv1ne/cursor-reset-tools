import { config } from './config.js';

/**
 * Простой кэш с TTL
 */
export class Cache {
  constructor(ttl = config.timeouts.cacheTTL) {
    this.store = new Map();
    this.defaultTTL = ttl;
  }

  /**
   * Получить значение из кэша
   * @param {string} key 
   * @returns {*} undefined если не найдено или истёк TTL
   */
  get(key) {
    const item = this.store.get(key);
    if (!item) return undefined;

    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return undefined;
    }

    return item.value;
  }

  /**
   * Сохранить значение в кэш
   * @param {string} key 
   * @param {*} value 
   * @param {number} [ttl] - TTL в мс (опционально)
   */
  set(key, value, ttl = this.defaultTTL) {
    this.store.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  /**
   * Удалить значение из кэша
   * @param {string} key 
   */
  delete(key) {
    this.store.delete(key);
  }

  /**
   * Очистить весь кэш
   */
  clear() {
    this.store.clear();
  }

  /**
   * Получить или вычислить значение
   * @param {string} key 
   * @param {Function} computeFn - Функция для вычисления если не в кэше
   * @param {number} [ttl] 
   * @returns {*}
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
   * Размер кэша
   * @returns {number}
   */
  size() {
    return this.store.size;
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
  return async (...args) => {
    return withTimeout(fn(...args), timeout, errorMessage);
  };
}
