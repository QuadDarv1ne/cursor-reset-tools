/**
 * WebSocket Server - Реальное время для клиентов
 * Стриминг логов, статуса, уведомлений
 */

import { WebSocketServer } from 'ws';
import http from 'http';
import { logger } from './logger.js';
import { globalMonitorManager } from './monitorManager.js';
import { globalIPManager } from './ipManager.js';
import { globalSmartBypassManager } from './smartBypassManager.js';

class WSServer {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.broadcastInterval = null;
  }

  /**
   * Инициализация WebSocket сервера
   */
  init(server, port = 3001) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.wss.on('error', (error) => logger.error(`WS error: ${error.message}`, 'websocket'));

    // Авто-вещание статуса
    this.startBroadcast();

    logger.info(`WebSocket server initialized on port ${port}`, 'websocket');
  }

  /**
   * Обработка подключения
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    
    this.clients.set(clientId, {
      ws,
      connectedAt: Date.now(),
      subscriptions: new Set(['status']),
      pingPong: { isAlive: true, lastPing: Date.now() }
    });

    logger.debug(`Client connected: ${clientId}`, 'websocket');

    // Приветствие
    this.send(clientId, {
      type: 'welcome',
      clientId,
      timestamp: Date.now(),
      message: 'Connected to Cursor Reset Tools'
    });

    // Отправка текущего статуса
    this.sendStatus(clientId);

    // Обработка сообщений
    ws.on('message', (message) => this.handleMessage(clientId, message));

    // Pong
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.pingPong.isAlive = true;
      }
    });

    // Отключение
    ws.on('close', () => this.handleDisconnect(clientId));
    ws.on('error', (error) => logger.error(`WS client error (${clientId}): ${error.message}`, 'websocket'));
  }

  /**
   * Обработка сообщений от клиента
   */
  async handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (message.type) {
        case 'subscribe':
          client.subscriptions.add(message.channel);
          this.send(clientId, {
            type: 'subscribed',
            channel: message.channel
          });
          break;

        case 'unsubscribe':
          client.subscriptions.delete(message.channel);
          break;

        case 'ping':
          this.send(clientId, {
            type: 'pong',
            timestamp: Date.now(),
            latency: Date.now() - message.timestamp
          });
          break;

        case 'request_status':
          await this.sendStatus(clientId);
          break;

        case 'test_bypass':
          const result = await globalSmartBypassManager.testAllMethods();
          this.send(clientId, {
            type: 'bypass_test_result',
            result,
            best: globalSmartBypassManager.getBestMethod()
          });
          break;

        case 'apply_best':
          const applied = await globalSmartBypassManager.applyBestMethod();
          this.send(clientId, {
            type: 'bypass_applied',
            result: applied
          });
          break;

        default:
          this.send(clientId, {
            type: 'error',
            message: 'Unknown message type'
          });
      }
    } catch (error) {
      logger.error(`Message handling error: ${error.message}`, 'websocket');
    }
  }

  /**
   * Обработка отключения
   */
  handleDisconnect(clientId) {
    this.clients.delete(clientId);
    logger.debug(`Client disconnected: ${clientId}`, 'websocket');
  }

  /**
   * Отправка сообщения клиенту
   */
  send(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Вещание всем клиентам
   */
  broadcast(message, channel = null) {
    let count = 0;

    for (const [clientId, client] of this.clients) {
      if (channel && !client.subscriptions.has(channel)) {
        continue;
      }

      if (this.send(clientId, message)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Отправка статуса
   */
  async sendStatus(clientId) {
    const status = {
      type: 'status',
      timestamp: Date.now(),
      data: {
        ip: await globalIPManager.getCurrentIP(),
        monitor: globalMonitorManager.getStatus(),
        bypass: globalSmartBypassManager.getStatus()
      }
    };

    this.send(clientId, status);
  }

  /**
   * Запуск авто-вещания
   */
  startBroadcast(interval = 10000) {
    this.broadcastInterval = setInterval(async () => {
      // Проверка живых клиентов
      this.checkAliveClients();

      // Вещание статуса
      const status = {
        type: 'heartbeat',
        timestamp: Date.now(),
        data: {
          ip: globalIPManager.getInfo().current,
          clients: this.clients.size,
          bestMethod: globalSmartBypassManager.getBestMethod()
        }
      };

      this.broadcast(status, 'status');
    }, interval);

    logger.info(`WebSocket broadcast started (interval: ${interval}ms)`, 'websocket');
  }

  /**
   * Проверка живых клиентов
   */
  checkAliveClients() {
    for (const [clientId, client] of this.clients) {
      if (!client.pingPong.isAlive) {
        client.ws.terminate();
        this.clients.delete(clientId);
        logger.debug(`Client terminated (no pong): ${clientId}`, 'websocket');
      } else {
        client.pingPong.isAlive = false;
        client.ws.ping();
      }
    }
  }

  /**
   * Генерация ID клиента
   */
  generateClientId() {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Остановка сервера
   */
  stop() {
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
    }

    for (const [clientId, client] of this.clients) {
      client.ws.close();
    }

    this.clients.clear();
    logger.info('WebSocket server stopped', 'websocket');
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      clients: this.clients.size,
      uptime: this.broadcastInterval ? 'running' : 'stopped',
      clientsList: Array.from(this.clients.entries()).map(([id, c]) => ({
        id,
        connectedAt: c.connectedAt,
        subscriptions: Array.from(c.subscriptions)
      }))
    };
  }
}

export const globalWSServer = new WSServer();
export default WSServer;
