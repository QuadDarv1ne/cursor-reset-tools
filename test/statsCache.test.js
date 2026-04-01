/**
 * Тесты для StatsCache
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { StatsCache, CACHE_CONFIG } from '../utils/statsCache.js';

describe('StatsCache', () => {
  let cache;

  beforeEach(() => {
    cache = new StatsCache();
    cache.init();
  });

  afterEach(() => {
    cache.stop();
  });

  describe('Инициализация', () => {
    test('должен создаваться новый экземпляр', () => {
      expect(cache).toBeInstanceOf(StatsCache);
    });

    test('init должен возвращать this для chaining', () => {
      const result = cache.init();
      expect(result).toBe(cache);
    });

    test('должен иметь пустой cache Map', () => {
      expect(cache.size()).toBe(0);
    });

    test('должен иметь начальную статистику', () => {
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
    });
  });

  describe('Set/Get', () => {
    test('должен устанавливать и получать значение', () => {
      cache.set('key1', 'value1');
      const value = cache.get('key1');

      expect(value).toBe('value1');
    });

    test('должен возвращать null для несуществующего ключа', () => {
      const value = cache.get('nonexistent');
      expect(value).toBeNull();
    });

    test('должен увеличивать hits при попадании', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('key1');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    test('должен увеличивать misses при промахе', () => {
      cache.get('nonexistent1');
      cache.get('nonexistent2');

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    test('должен увеличивать sets при установке', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.sets).toBe(2);
    });
  });

  describe('TTL (Time To Live)', () => {
    test('должен хранить значение с кастомным TTL', () => {
      cache.set('ttl-key', 'ttl-value', 100);
      const value = cache.get('ttl-key');

      expect(value).toBe('ttl-value');
    });

    test('должен очищать просроченные значения', done => {
      cache.set('short-ttl', 'value', 50);

      const timeout = setTimeout(() => {
        const value = cache.get('short-ttl');
        expect(value).toBeNull();
        done();
      }, 100);
      timeout.unref();
    });

    test('должен увеличивать expirations при истечении TTL', done => {
      cache.set('expire-key', 'value', 50);

      const timeout = setTimeout(() => {
        cache.get('expire-key');
        const stats = cache.getStats();
        expect(stats.expirations).toBeGreaterThan(0);
        done();
      }, 100);
      timeout.unref();
    });
  });

  describe('Has', () => {
    test('должен возвращать true для существующего ключа', () => {
      cache.set('key1', 'value1');
      expect(cache.has('key1')).toBe(true);
    });

    test('должен возвращать false для несуществующего ключа', () => {
      expect(cache.has('nonexistent')).toBe(false);
    });

    test('должен возвращать false для просроченного ключа', done => {
      cache.set('short-ttl', 'value', 50);

      const timeout = setTimeout(() => {
        expect(cache.has('short-ttl')).toBe(false);
        done();
      }, 100);
      timeout.unref();
    });
  });

  describe('Delete', () => {
    test('должен удалять ключ', () => {
      cache.set('key1', 'value1');
      const deleted = cache.delete('key1');

      expect(deleted).toBe(true);
      expect(cache.get('key1')).toBeNull();
    });

    test('должен возвращать false при удалении несуществующего ключа', () => {
      const deleted = cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });

    test('должен увеличивать deletes при удалении', () => {
      cache.set('key1', 'value1');
      cache.delete('key1');

      const stats = cache.getStats();
      expect(stats.deletes).toBe(1);
    });
  });

  describe('Clear', () => {
    test('должен очищать весь кэш', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });
  });

  describe('Size', () => {
    test('должен возвращать правильный размер', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
    });
  });

  describe('Ограничение размера кэша', () => {
    test('должен evict старые записи при превышении maxEntries', () => {
      // Устанавливаем больше записей чем maxEntries
      for (let i = 0; i < CACHE_CONFIG.maxEntries + 10; i++) {
        cache.set(`key${i}`, `value${i}`);
      }

      expect(cache.size()).toBeLessThanOrEqual(CACHE_CONFIG.maxEntries);
    });
  });

  describe('Cleanup', () => {
    test('должен очищать просроченные записи', done => {
      cache.set('short1', 'value1', 50);
      cache.set('short2', 'value2', 50);
      cache.set('long', 'value', 10000);

      const timeout = setTimeout(() => {
        const expired = cache.cleanup();
        expect(expired).toBe(2);
        done();
      }, 100);
      timeout.unref();
    });

    test('должен возвращать 0 если нет просроченных записей', () => {
      cache.set('key1', 'value1', 10000);
      cache.set('key2', 'value2', 10000);

      const expired = cache.cleanup();
      expect(expired).toBe(0);
    });
  });

  describe('GetKeyInfo', () => {
    test('должен возвращать информацию о ключе', () => {
      cache.set('key1', 'value1', 1000);
      const info = cache.getKeyInfo('key1');

      expect(info).toBeDefined();
      expect(info.key).toBe('key1');
      expect(info.ttl).toBe(1000);
      expect(info.accessCount).toBe(0);
    });

    test('должен возвращать null для несуществующего ключа', () => {
      const info = cache.getKeyInfo('nonexistent');
      expect(info).toBeNull();
    });

    test('должен обновлять lastAccess при доступе', () => {
      cache.set('key1', 'value1');
      const info1 = cache.getKeyInfo('key1');

      return new Promise(resolve => {
        const timeout = setTimeout(() => {
          cache.get('key1');
          const info2 = cache.getKeyInfo('key1');

          expect(info2.lastAccess).toBeGreaterThanOrEqual(info1.lastAccess);
          resolve();
        }, 10);
        timeout.unref();
      });
    });
  });

  describe('GetEntry', () => {
    test('должен возвращать метаданные без value по умолчанию', () => {
      cache.set('key1', 'value1', 1000);
      const entry = cache.getEntry('key1');
      expect(entry).toBeDefined();
      expect(entry).toHaveProperty('key', 'key1');
      expect(entry).not.toHaveProperty('value');
    });

    test('должен возвращать value при includeValue=true', () => {
      cache.set('key1', 'value1', 1000);
      const entry = cache.getEntry('key1', { includeValue: true });
      expect(entry).toBeDefined();
      expect(entry).toHaveProperty('value', 'value1');
    });
  });

  describe('DeleteByPrefix', () => {
    test('должен удалять ключи с нужным префиксом', () => {
      cache.set('a:1', 1);
      cache.set('a:2', 2);
      cache.set('b:1', 3);

      const deleted = cache.deleteByPrefix('a:');
      expect(deleted).toBe(2);
      expect(cache.get('a:1')).toBeNull();
      expect(cache.get('a:2')).toBeNull();
      expect(cache.get('b:1')).toBe(3);
    });
  });

  describe('Статистика', () => {
    test('getStats должен возвращать полную статистику', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('sets');
      expect(stats).toHaveProperty('deletes');
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(stats).toHaveProperty('isRunning');
    });

    test('hitRate должен быть процентом', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      const stats = cache.getStats();
      expect(stats.hitRate).toMatch(/^\d+\.?\d*%$/);
    });

    test('resetStats должен сбрасывать статистику', () => {
      cache.set('key1', 'value1');
      cache.get('key1');
      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
    });
  });

  describe('Request History', () => {
    test('должен хранить историю запросов', () => {
      cache.set('key1', 'value1');
      cache.get('key1');

      const history = cache.getRequestHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
    });

    test('должен ограничивать историю', () => {
      // Делаем много запросов
      for (let i = 0; i < CACHE_CONFIG.stats.historyLimit + 10; i++) {
        cache.set(`key${i}`, `value${i}`);
        cache.get(`key${i}`);
      }

      const history = cache.getRequestHistory();
      expect(history.length).toBeLessThanOrEqual(CACHE_CONFIG.stats.historyLimit);
    });
  });

  describe('Export', () => {
    test('export должен возвращать все данные', () => {
      cache.set('key1', 'value1');
      const exported = cache.export();

      expect(exported).toHaveProperty('stats');
      expect(exported).toHaveProperty('entries');
      expect(exported).toHaveProperty('config');
      expect(Array.isArray(exported.entries)).toBe(true);
    });
  });

  describe('Stop/Start', () => {
    test('stop должен останавливать кэш', () => {
      cache.stop();
      expect(cache.isRunning).toBe(false);
    });

    test('init после stop должен перезапускать', () => {
      cache.stop();
      cache.init();
      expect(cache.isRunning).toBe(true);
    });
  });
});
