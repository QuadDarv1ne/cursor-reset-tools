/**
 * WebSocket Server - Реальное время для клиентов
 * Стриминг логов, статуса, уведомлений
 * Оптимизации: сжатие, кэширование, дедупликация, rate limiting
 */

import { WebSocketServer } from 'ws';
import { logger } from './logger.js';
import { globalMonitorManager } from './monitorManager.js';
import { globalIPManager } from './ipManager.js';
import { globalSmartBypassManager } from './smartBypassManager.js';

/**
 * Конфигурация WebSocket сервера
 */
const WS_CONFIG = {
  maxClients: 100,
  clientTimeout: 300000,
  pingInterval: 30000,
  maxMessageSize: 1024 * 1024,
  maxSubscriptions: 10,
  compressionThreshold: 1024, // Сжимать сообщения > 1KB
  cacheTTL: 5000, // Кэш статуса на 5 секунд
  dedupWindow: 1000, // Окно дедупликации 1 секунда
  rateLimit: 50, // Максимум сообщений в секунду
  broadcastThrottle: 100 // Минимальный интервал вещания (мс)
};

class WSServer {
  constructor() {
    this.wss = null;
    this.clients = new Map();
    this.broadcastInterval = null;
    this.pingInterval = null;
    this.maxClients = WS_CONFIG.maxClients;

    // Оптимизации
    this.statusCache = { data: null, timestamp: 0 };
    this.messageHashes = new Map(); // Дедупликация
    this.lastBroadcast = 0;
    this.stats = {
      totalConnections: 0,
      totalDisconnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      compressedMessages: 0,
      deduplicatedMessages: 0,
      rateLimitedClients: 0
    };
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
    this.wss.on('error', error => logger.error(`WS error: ${error.message}`, 'websocket'));

    // Авто-вещание статуса
    this.startBroadcast();

    logger.info(`WebSocket server initialized on port ${port}`, 'websocket');
  }

  /**
   * Обработка подключения
   */
  handleConnection(ws, _req) {
    // Проверка на максимальное количество клиентов
    if (this.clients.size >= this.maxClients) {
      logger.warn('Maximum WebSocket clients reached, rejecting connection', 'websocket');
      ws.close(1013, 'Server is at capacity');
      return;
    }

    const clientId = this.generateClientId();
    const connectedAt = Date.now();

    this.clients.set(clientId, {
      ws,
      connectedAt,
      lastActivity: connectedAt,
      subscriptions: new Set(['status']),
      pingPong: { isAlive: true, lastPing: Date.now() },
      messageCount: 0,
      bytesReceived: 0
    });

    logger.debug(`Client connected: ${clientId} (total: ${this.clients.size})`, 'websocket');

    // Приветствие
    this.send(clientId, {
      type: 'welcome',
      clientId,
      message: 'Connected to Cursor Reset Tools',
      timestamp: connectedAt
    }).catch(err => {
      logger.error(`Failed to send welcome message: ${err.message}`, 'websocket');
    });

    // Обработка сообщений от клиента
    ws.on('message', data => {
      try {
        this.handleMessage(clientId, data);
      } catch (error) {
        logger.error(`Message handling error for ${clientId}: ${error.message}`, 'websocket', {
          stack: error.stack
        });
        this.send(clientId, {
          type: 'error',
          message: 'Internal server error processing message'
        }).catch(() => {});
      }
    });

    // Обработка отключения
    ws.on('close', () => {
      try {
        this.removeClient(clientId);
      } catch (error) {
        logger.error(`Error removing client ${clientId}: ${error.message}`, 'websocket');
      }
    });

    // Обработка ошибок
    ws.on('error', error => {
      logger.error(`WebSocket error for ${clientId}: ${error.message}`, 'websocket', {
        code: error.code
      });
    });

    // Pong handler
    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.pingPong.isAlive = true;
        client.pingPong.lastPong = Date.now();
      }
    });
  }

  /**
   * Обработка сообщений от клиента
   */
  async handleMessage(clientId, data) {
    try {
      const client = this.clients.get(clientId);
      if (!client) {return;}

      // Проверка размера сообщения
      const dataSize = Buffer.byteLength(data, 'utf8');
      if (dataSize > WS_CONFIG.maxMessageSize) {
        logger.warn(`Client ${clientId} sent message exceeding size limit`, 'websocket');
        this.send(clientId, {
          type: 'error',
          message: 'Message too large'
        });
        return;
      }

      // Обновление статистики
      client.lastActivity = Date.now();
      client.messageCount++;
      client.bytesReceived += dataSize;

      // Проверка на спам (более 100 сообщений в секунду)
      if (client.messageCount > 100) {
        const timeSinceStart = Date.now() - client.connectedAt;
        if (timeSinceStart < 1000) {
          logger.warn(`Client ${clientId} flooding detected`, 'websocket');
          client.ws.close(1008, 'Message rate exceeded');
          return;
        }
      }

      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'subscribe':
          // Проверка на максимальное количество подписок
          if (client.subscriptions.size >= WS_CONFIG.maxSubscriptions) {
            this.send(clientId, {
              type: 'error',
              message: 'Maximum subscriptions reached'
            });
            return;
          }
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
            latency: Date.now() - (message.timestamp || Date.now())
          });
          break;

        case 'request_status':
          await this.sendStatus(clientId);
          break;

        case 'test_bypass': {
          const result = await globalSmartBypassManager.testAllMethods();
          this.send(clientId, {
            type: 'bypass_test_result',
            result,
            best: globalSmartBypassManager.getBestMethod()
          });
          break;
        }

        case 'apply_best': {
          const applied = await globalSmartBypassManager.applyBestMethod();
          this.send(clientId, {
            type: 'bypass_applied',
            result: applied
          });
          break;
        }

        default:
          this.send(clientId, {
            type: 'error',
            message: 'Unknown message type'
          });
      }
    } catch (error) {
      logger.error(`Message handling error (${clientId}): ${error.message}`, 'websocket');
      this.send(clientId, {
        type: 'error',
        message: 'Invalid message format'
      });
    }
  }

  /**
   * Обработка отключения (с гарантированной очисткой таймеров)
   */
  handleDisconnect(clientId) {
    const client = this.clients.get(clientId);

    // Гарантированная очистка таймера таймаута
    if (client) {
      if (client.timeoutId) {
        clearTimeout(client.timeoutId);
        client.timeoutId = null;
      }

      // Очистка подписок для предотвращения утечек памяти
      if (client.subscriptions) {
        client.subscriptions.clear();
      }
    }

    this.clients.delete(clientId);
    logger.debug(`Client disconnected: ${clientId} (remaining: ${this.clients.size})`, 'websocket');
  }

  /**
   * Отправка сообщения клиенту (с проверкой состояния)
   */
  send(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.debug(`Failed to send to ${clientId}: ${error.message}`, 'websocket');
        // Клиент с ошибкой - пометить как мёртвого
        client.pingPong.isAlive = false;
      }
    }
    return false;
  }

  /**
   * Вещание всем клиентам (безопасная итерация)
   */
  broadcast(message, channel = null) {
    let count = 0;

    // Копируем ключи для безопасной итерации (защита от изменения Map во время итерации)
    const clientIds = Array.from(this.clients.keys());

    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);

      // Пропускаем если клиент не подписан на канал
      if (channel && (!client || !client.subscriptions.has(channel))) {
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

    // Разрешаем процессу завершиться даже с активным интервалом
    if (this.broadcastInterval && typeof this.broadcastInterval.unref === 'function') {
      this.broadcastInterval.unref();
    }

    logger.info(`WebSocket broadcast started (interval: ${interval}ms)`, 'websocket');
  }

  /**
   * Проверка живых клиентов
   */
  checkAliveClients() {
    const now = Date.now();
    const toRemove = [];

    for (const [clientId, client] of this.clients) {
      // Проверка на таймаут неактивности
      const idleTime = now - client.lastActivity;
      if (idleTime > WS_CONFIG.clientTimeout) {
        logger.debug(`Client ${clientId} idle timeout (${idleTime}ms)`, 'websocket');
        toRemove.push(clientId);
        continue;
      }

      // Проверка ping/pong
      if (!client.pingPong.isAlive) {
        logger.debug(`Client ${clientId} no pong response`, 'websocket');
        toRemove.push(clientId);
        continue;
      }

      // Сброс флага и отправка ping
      client.pingPong.isAlive = false;
      client.ws.ping();
    }

    // Удаление неактивных клиентов
    for (const clientId of toRemove) {
      const client = this.clients.get(clientId);
      if (client) {
        if (client.timeoutId) {
          clearTimeout(client.timeoutId);
        }
        client.ws.terminate();
        this.clients.delete(clientId);
      }
    }

    if (toRemove.length > 0) {
      logger.debug(`Removed ${toRemove.length} inactive clients`, 'websocket');
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
    // Остановка интервалов
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Очистка всех таймеров клиентов
    for (const client of this.clients.values()) {
      if (client.timeoutId) {
        clearTimeout(client.timeoutId);
      }
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
