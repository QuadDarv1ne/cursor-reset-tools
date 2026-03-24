/**
 * Unit тесты для utils/helpers.js
 */

import { describe, it, expect } from '@jest/globals';
import { withRetry, RETRY_CONFIG, delay } from '../utils/helpers.js';

describe('helpers.js', () => {
  describe('RETRY_CONFIG', () => {
    it('должен иметь правильные значения по умолчанию', () => {
      expect(RETRY_CONFIG.maxAttempts).toBe(3);
      expect(RETRY_CONFIG.baseDelay).toBe(1000);
      expect(RETRY_CONFIG.maxDelay).toBe(10000);
      expect(RETRY_CONFIG.exponential).toBe(true);
    });
  });

  describe('delay', () => {
    it('должен задерживать выполнение на указанное время', async () => {
      const start = Date.now();
      await delay(100);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(95);
    });
  });

  describe('withRetry', () => {
    it('должен успешно выполнять операцию с первой попытки', async () => {
      const mockFn = {
        fn: async () => 'success',
        mock: { calls: [] }
      };
      const operation = async () => {
        mockFn.mock.calls.push([]);
        return mockFn.fn();
      };
      const result = await withRetry(operation, { maxAttempts: 3 });
      expect(result).toBe('success');
      expect(mockFn.mock.calls.length).toBe(1);
    });

    it('должен повторять операцию при ошибке', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary error');
        }
        return 'success';
      };

      const result = await withRetry(operation, {
        maxAttempts: 5,
        baseDelay: 10,
        exponential: false
      });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('должен выбрасывать ошибку после максимального количества попыток', async () => {
      const operation = async () => {
        throw new Error('Permanent error');
      };

      await expect(withRetry(operation, {
        maxAttempts: 3,
        baseDelay: 10,
        exponential: false
      })).rejects.toThrow('Permanent error');
    });

    it('должен использовать экспоненциальную задержку', async () => {
      let attempts = 0;
      const delays = [];
      const startTime = Date.now();

      const operation = async () => {
        attempts++;
        if (attempts < 3) {
          delays.push(Date.now() - startTime);
          throw new Error('Temporary error');
        }
        return 'success';
      };

      await withRetry(operation, {
        maxAttempts: 5,
        baseDelay: 50,
        exponential: true
      });

      expect(delays.length).toBe(2);
      expect(delays[1] - delays[0]).toBeGreaterThan(40);
    });
  });
});
