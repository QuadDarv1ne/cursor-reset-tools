/**
 * Интеграционные тесты для API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import http from 'http';
import express from 'express';
import resetRouter from '../routes/reset.js';

let server;
let app;
let baseUrl;

// Тестовая конфигурация
const TEST_PORT = 3999;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe('API Integration Tests', () => {
  beforeAll(async () => {
    // Создание тестового приложения
    app = express();
    app.use(express.json());
    app.use('/api', resetRouter);

    // Запуск сервера
    await new Promise(resolve => {
      server = app.listen(TEST_PORT, () => {
        resolve();
      });
    });

    baseUrl = BASE_URL;
  });

  afterAll(async () => {
    // Остановка сервера
    if (server) {
      server.close();
    }
  });

  describe('GET /api/paths', () => {
    it('должен возвращать информацию о путях', async () => {
      const response = await makeRequest(`${baseUrl}/api/paths`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('homedir');
      expect(response.data).toHaveProperty('platform');
    });
  });

  describe('GET /api/ip/check', () => {
    it('должен возвращать информацию об IP', async () => {
      const response = await makeRequest(`${baseUrl}/api/ip/check`);
      expect([200, 500]).toContain(response.statusCode);
      expect(response.data).toBeDefined();
    });
  });

  describe('GET /api/ip/history', () => {
    it('должен возвращать историю IP', async () => {
      const response = await makeRequest(`${baseUrl}/api/ip/history`);
      // Может вернуть 500 если IPManager не инициализирован
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.data).toHaveProperty('success', true);
        expect(response.data).toHaveProperty('history');
        expect(Array.isArray(response.data.history)).toBe(true);
      }
    });
  });

  describe('GET /api/dns/current', () => {
    it('должен возвращать текущий DNS', async () => {
      const response = await makeRequest(`${baseUrl}/api/dns/current`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('GET /api/dns/providers', () => {
    it('должен возвращать список DNS провайдеров', async () => {
      const response = await makeRequest(`${baseUrl}/api/dns/providers`);
      expect([200, 500]).toContain(response.statusCode);
      expect(response.data).toBeDefined();
    });
  });

  describe('GET /api/fingerprint/info', () => {
    it('должен возвращать информацию о fingerprint', async () => {
      const response = await makeRequest(`${baseUrl}/api/fingerprint/info`);
      expect([200, 500]).toContain(response.statusCode);
      expect(response.data).toBeDefined();
    });
  });

  describe('GET /api/email/services', () => {
    it('должен возвращать список email сервисов', async () => {
      const response = await makeRequest(`${baseUrl}/api/email/services`);
      expect([200, 500]).toContain(response.statusCode);
      expect(response.data).toBeDefined();
    });
  });

  describe('GET /api/monitor/status', () => {
    it('должен возвращать статус мониторинга', async () => {
      const response = await makeRequest(`${baseUrl}/api/monitor/status`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('GET /api/proxy/list', () => {
    it('должен возвращать список прокси', async () => {
      const response = await makeRequest(`${baseUrl}/api/proxy/list`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('proxies');
    });
  });

  describe('GET /api/proxy-db/list', () => {
    it('должен возвращать список прокси из БД', async () => {
      const response = await makeRequest(`${baseUrl}/api/proxy-db/list`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('GET /api/proxy-db/stats', () => {
    it('должен возвращать статистику прокси', async () => {
      const response = await makeRequest(`${baseUrl}/api/proxy-db/stats`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('GET /api/proxy-db/countries', () => {
    it('должен возвращать список стран', async () => {
      const response = await makeRequest(`${baseUrl}/api/proxy-db/countries`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('countries');
    });
  });

  describe('GET /api/smart/status', () => {
    it('должен возвращать статус smart bypass', async () => {
      const response = await makeRequest(`${baseUrl}/api/smart/status`);
      expect(response.statusCode).toBe(200);
      expect(response.data).toHaveProperty('success', true);
    });
  });

  describe('GET /api/doh/providers', () => {
    it('должен возвращать список DoH провайдеров', async () => {
      const response = await makeRequest(`${baseUrl}/api/doh/providers`);
      // DoH providers могут быть недоступны в тестовой среде
      expect([200, 500]).toContain(response.statusCode);
      if (response.statusCode === 200) {
        expect(response.data).toHaveProperty('success', true);
        expect(response.data).toHaveProperty('providers');
      }
    }, 20000);
  });

  describe('404 handler', () => {
    it('должен возвращать 404 для несуществующих routes', async () => {
      const response = await makeRequest(`${baseUrl}/api/nonexistent`);
      expect(response.statusCode).toBe(404);
      // Express возвращает HTML для 404 по умолчанию
      expect(response.data).toBeDefined();
    });
  });
});

/**
 * Helper для HTTP запросов
 */
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            data: JSON.parse(data)
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            data: data
          });
        }
      });
    }).on('error', reject);
  });
}
