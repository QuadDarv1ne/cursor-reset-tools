/**
 * Bypass Server - Прокси-сервер для обхода блокировок
 * Предоставляет прокси-доступ для клиентов через WebSocket и HTTP
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { logger } from '../utils/logger.js';
import { globalProxyDatabase } from '../utils/proxyDatabase.js';
import { globalProxyManager } from '../utils/proxyManager.js';

/**
 * Конфигурация сервера
 */
const CONFIG = {
  port: process.env.BYPASS_PORT || 3001,
  wsPort: process.env.WS_PORT || 3002,
  maxClients: 100,
  proxyTimeout: 30000,
  healthCheckInterval: 60000,
  rateLimit: {
    windowMs: 60000,
    maxRequests: 100
  }
};

/**
 * Класс Bypass Server
 */
export class BypassServer {
  constructor() {
    this.clients = new Map();
    this.stats = {
      totalRequests: 0,
      activeClients: 0,
      proxiedBytes: 0,
      startTime: Date.now()
    };
    this.app = null;
    this.server = null;
    this.wss = null;
  }

  /**
   * Инициализация сервера
   */
  async init() {
    logger.info('Initializing Bypass Server...', 'bypass-server');
    
    // Инициализация прокси базы
    await globalProxyDatabase.init();
    
    // Создание Express приложения
    this.app = express();
    this.app.use(cors());
    this.app.use(express.json());
    
    // HTTP сервер
    this.server = http.createServer(this.app);
    
    // WebSocket сервер
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    // Настройка маршрутов
    this.setupRoutes();
    this.setupWebSocket();
    this.setupProxy();
    
    logger.info('Bypass Server initialized', 'bypass-server');
  }

  /**
   * Настройка HTTP маршрутов
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: Date.now() - this.stats.startTime,
        clients: this.stats.activeClients,
        requests: this.stats.totalRequests
      });
    });

    // Статистика
    this.app.get('/stats', (req, res) => {
      res.json({
        ...this.stats,
        uptime: Date.now() - this.stats.startTime,
        proxyDatabase: globalProxyDatabase.getStats()
      });
    });

    // Получить прокси
    this.app.get('/proxy', (req, res) => {
      const { protocol } = req.query;
      const proxy = globalProxyDatabase.getRandomWorking(protocol);
      
      if (proxy) {
        res.json({
          success: true,
          proxy: {
            url: proxy.url,
            protocol: proxy.protocol,
            country: proxy.country
          }
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'No working proxies available'
        });
      }
    });

    // Список прокси
    this.app.get('/proxies', (req, res) => {
      const { limit = 10, protocol, country } = req.query;
      const proxies = globalProxyDatabase.getProxies({
        protocol,
        country,
        workingOnly: true,
        limit: parseInt(limit)
      });
      
      res.json({
        success: true,
        proxies: proxies.map(p => ({
          url: p.url,
          protocol: p.protocol,
          country: p.country,
          responseTime: p.responseTime
        }))
      });
    });

    // API для обхода (прокси запросы)
    this.app.all('/bypass/*', async (req, res) => {
      try {
        const targetUrl = req.params[0];
        
        if (!targetUrl) {
          return res.status(400).json({ error: 'Target URL required' });
        }

        this.stats.totalRequests++;
        
        // Получение рабочего прокси
        const proxy = globalProxyDatabase.getRandomWorking();
        
        if (!proxy) {
          return res.status(503).json({ error: 'No proxies available' });
        }

        // Проксирование запроса
        const fetch = (await import('node-fetch')).default;
        const { SocksProxyAgent } = await import('socks-proxy-agent');
        
        const agent = new SocksProxyAgent(`socks5://${proxy.url}`);
        
        const response = await fetch(targetUrl, {
          method: req.method,
          headers: req.headers,
          agent,
          timeout: CONFIG.proxyTimeout
        });

        const body = await response.text();
        this.stats.proxiedBytes += body.length;

        res.set('x-bypass-proxy', proxy.url);
        res.set('x-bypass-country', proxy.country);
        res.status(response.status).send(body);

      } catch (error) {
        logger.error(`Bypass error: ${error.message}`, 'bypass-server');
        res.status(500).json({ error: error.message });
      }
    });

    // Rate limiting статус
    this.app.get('/ratelimit/status', (req, res) => {
      res.json({
        limit: CONFIG.rateLimit.maxRequests,
        window: CONFIG.rateLimit.windowMs,
        message: 'Rate limiting enabled'
      });
    });
  }

  /**
   * Настройка WebSocket
   */
  setupWebSocket() {
    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId();
      
      logger.info(`Client connected: ${clientId}`, 'bypass-server');
      
      this.clients.set(clientId, {
        ws,
        connectedAt: Date.now(),
        requests: 0,
        bytes: 0
      });
      
      this.stats.activeClients = this.clients.size;

      // Отправка приветствия
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        message: 'Connected to Bypass Server'
      }));

      // Обработка сообщений
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(clientId, ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error.message
          }));
        }
      });

      // Отключение
      ws.on('close', () => {
        this.clients.delete(clientId);
        this.stats.activeClients = this.clients.size;
        logger.info(`Client disconnected: ${clientId}`, 'bypass-server');
      });

      // Обработка ошибок
      ws.on('error', (error) => {
        logger.error(`WebSocket error (${clientId}): ${error.message}`, 'bypass-server');
      });
    });

    // Heartbeat
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  /**
   * Обработка WebSocket сообщений
   */
  async handleWebSocketMessage(clientId, ws, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.requests++;
    this.stats.totalRequests++;

    switch (data.type) {
      case 'proxy':
        // Запрос прокси
        const proxy = globalProxyDatabase.getRandomWorking(data.protocol);
        if (proxy) {
          ws.send(JSON.stringify({
            type: 'proxy',
            proxy: {
              url: proxy.url,
              protocol: proxy.protocol,
              country: proxy.country
            }
          }));
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            error: 'No proxies available'
          }));
        }
        break;

      case 'request':
        // Проксирование запроса
        try {
          const fetch = (await import('node-fetch')).default;
          const { SocksProxyAgent } = await import('socks-proxy-agent');
          
          const proxy = globalProxyDatabase.getRandomWorking();
          if (!proxy) {
            throw new Error('No proxies available');
          }

          const agent = new SocksProxyAgent(`socks5://${proxy.url}`);
          
          const response = await fetch(data.url, {
            method: data.method || 'GET',
            headers: data.headers || {},
            agent,
            body: data.body,
            timeout: CONFIG.proxyTimeout
          });

          const body = await response.text();
          client.bytes += body.length;
          this.stats.proxiedBytes += body.length;

          ws.send(JSON.stringify({
            type: 'response',
            requestId: data.requestId,
            status: response.status,
            headers: response.headers.raw(),
            body: body
          }));
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            requestId: data.requestId,
            error: error.message
          }));
        }
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      default:
        ws.send(JSON.stringify({ type: 'error', error: 'Unknown message type' }));
    }
  }

  /**
   * Настройка прокси middleware
   */
  setupProxy() {
    // Прозрачное проксирование для определённых путей
    this.app.use('/api/proxy', createProxyMiddleware({
      target: 'http://localhost:3000',
      changeOrigin: true,
      timeout: CONFIG.proxyTimeout,
      onProxyReq: (proxyReq, req, res) => {
        this.stats.totalRequests++;
      }
    }));
  }

  /**
   * Генерация ID клиента
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Запуск сервера
   */
  async start() {
    return new Promise((resolve) => {
      this.server.listen(CONFIG.port, () => {
        logger.info(`Bypass Server running on port ${CONFIG.port}`, 'bypass-server');
        logger.info(`WebSocket available on ws://localhost:${CONFIG.port}/ws`, 'bypass-server');
        resolve();
      });
    });
  }

  /**
   * Остановка сервера
   */
  async stop() {
    logger.info('Stopping Bypass Server...', 'bypass-server');
    
    // Закрытие всех WebSocket подключений
    this.wss.clients.forEach((client) => {
      client.close();
    });
    
    // Остановка сервера
    this.server.close(() => {
      logger.info('Bypass Server stopped', 'bypass-server');
    });
  }

  /**
   * Получение статистики
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      clients: Array.from(this.clients.entries()).map(([id, data]) => ({
        id,
        connectedAt: data.connectedAt,
        requests: data.requests,
        bytes: data.bytes
      }))
    };
  }
}

// Глобальный экземпляр
export const globalBypassServer = new BypassServer();

export default BypassServer;
