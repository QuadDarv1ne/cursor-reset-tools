import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import http from 'http';
import dotenv from 'dotenv';
import resetRouter from './routes/reset.js';
import resourcesRouter from './routes/resources.js';
import cacheRouter from './routes/cache.js';
import metricsRouter from './routes/metrics.js';
import notificationsRouter from './routes/notifications.js';
import proxyRouter from './routes/proxy.js';
import networkRouter from './routes/network.js';
import updaterRouter from './routes/updater.js';
import backupRouter from './routes/backup.js';
import bypassRouter from './routes/bypass.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getTranslations, getSupportedLanguages } from './utils/i18n.js';
import { globalMonitorManager } from './utils/monitorManager.js';
import { globalIPManager } from './utils/ipManager.js';
import { globalFingerprintManager } from './utils/fingerprintManager.js';
import { globalProxyDatabase } from './utils/proxyDatabase.js';
import { globalSmartBypassManager } from './utils/smartBypassManager.js';
import { globalWSServer } from './utils/websocketServer.js';
import { globalUpdater } from './utils/updater.js';
import { globalMetricsManager } from './utils/metricsManager.js';
import { globalResourceMonitor } from './utils/resourceMonitor.js';
import { globalStatsCache } from './utils/statsCache.js';
import { globalNotificationManager } from './utils/notificationManager.js';
import { globalDNSManager } from './utils/dnsManager.js';
import { globalConfigBackup } from './utils/configBackup.js';
import { globalDPIBypass } from './utils/dpiBypass.js';
import { globalWireGuardManager } from './utils/wireguardManager.js';
import { globalProxyManager } from './utils/proxyManager.js';
import { createLogger } from './utils/logger.js';
import { SECURITY_CONSTANTS } from './utils/constants.js';
import { globalAutoRollbackManager } from './utils/autoRollback.js';
import { appConfig } from './utils/appConfig.js';

// Загрузка переменных окружения
dotenv.config();

// Инициализация логгера с конфигурацией
const logger = createLogger({
  level: appConfig.logging.level,
  filename: appConfig.logging.file,
  maxFiles: appConfig.logging.maxFiles,
  maxSize: appConfig.logging.maxSize
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Динамическая конфигурация с авто-выбором портов
 */
const DynamicConfig = {
  ports: { http: null, ws: null },

  autoSelectPort: async (startPort, maxAttempts) => {
    startPort = startPort || appConfig.network.portRangeStart;
    maxAttempts = maxAttempts || appConfig.network.portRangeMaxAttempts;

    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      const available = await DynamicConfig.checkPort(port);
      if (available) {return port;}
    }
    throw new Error(`No available ports in range ${startPort}-${startPort + maxAttempts}`);
  },

  checkPort: port => new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port);
  }),

  init: async () => {
    // Проверяем нужно ли проверять доступность порта
    if (appConfig.network.checkPortAvailability) {
      DynamicConfig.ports.http = await DynamicConfig.autoSelectPort(appConfig.network.portRangeStart);
      // WebSocket теперь на том же порту, так что отдельный порт не нужен
      DynamicConfig.ports.ws = DynamicConfig.ports.http;
    } else {
      DynamicConfig.ports.http = appConfig.network.port;
      DynamicConfig.ports.ws = appConfig.network.wsPort;
    }
    return DynamicConfig.ports;
  }
};

// Инициализация конфигурации
const ports = await DynamicConfig.init();
const port = process.env.PORT || ports.http;
const wsPort = process.env.WS_PORT || ports.ws;

const app = express();
const server = http.createServer(app);

// ============================================
// Security Middleware
// ============================================

// Helmet - security headers с CSP
const cspDirectives = {
  defaultSrc: ['\'self\''],
  scriptSrc: [
    '\'self\'',
    '\'unsafe-inline\'', // Для EJS шаблонов
    '\'unsafe-eval\'', // Для Chart.js (требуется для графиков)
    'cdn.jsdelivr.net' // Для внешних библиотек
  ],
  styleSrc: [
    '\'self\'',
    '\'unsafe-inline\'' // Для EJS шаблонов
  ],
  imgSrc: [
    '\'self\'',
    'data:',
    'https:'
  ],
  connectSrc: [
    '\'self\'',
    'ws:',
    'wss:'
  ],
  fontSrc: ['\'self\''],
  objectSrc: ['\'none\''],
  upgradeInsecureRequests: appConfig.nodeEnv === 'production' ? [] : null
};

app.use(helmet({
  contentSecurityPolicy: appConfig.security.cspEnabled ? {
    directives: cspDirectives
  } : false,
  crossOriginEmbedderPolicy: false, // Отключено для совместимости
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: false
}));

// Rate limiting с конфигурацией
const limiter = rateLimit({
  windowMs: appConfig.security.rateLimitWindow,
  max: appConfig.security.rateLimitMax,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

app.use(cors());
app.use(express.json({ limit: appConfig.security.maxUploadSize }));
app.use(express.urlencoded({ extended: true, limit: appConfig.security.maxUploadSize }));

// Middleware для логирования запросов
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] || 'unknown';

  // Логирование начала запроса (только в debug mode)
  if (appConfig.logging.level === 'debug') {
    logger.debug(`Request started: ${req.method} ${req.path}`, 'http', {
      requestId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
  }

  // Перехват завершения запроса
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Логирование медленных запросов (>1 секунда)
    if (duration > 1000) {
      logger.warn(`Slow request: ${req.method} ${req.path} (${duration}ms)`, 'http', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration
      });
    }

    // Логирование ошибок
    if (res.statusCode >= 500) {
      logger.error(`Server error: ${req.method} ${req.path} (${res.statusCode})`, 'http', {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode
      });
    }

    originalEnd.apply(res, args);
  };

  next();
});

// Проверка Content-Type для POST/PUT запросов с телом
// Разрешаем application/json, multipart/form-data, application/x-www-form-urlencoded
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    const contentType = req.headers['content-type'];
    if (contentType &&
        !contentType.includes('application/json') &&
        !contentType.includes('multipart/form-data') &&
        !contentType.includes('application/x-www-form-urlencoded')) {
      return res.status(415).json({
        success: false,
        error: 'Unsupported Media Type. Content-Type must be application/json, multipart/form-data, or application/x-www-form-urlencoded'
      });
    }
  }
  next();
});

// Кэширование статических файлов (1 час в production)
const staticCache = appConfig.network.nodeEnv === 'production'
  ? { maxAge: '1h', etag: true, lastModified: true }
  : { etag: true, lastModified: true };

app.use(express.static(path.join(__dirname, 'public'), staticCache));

// Проверка на XSS в теле запроса (перемещено из глобального middleware)
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT') {
    if (req.body && typeof req.body === 'object') {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          for (const pattern of SECURITY_CONSTANTS.XSS_PATTERNS) {
            if (pattern.test(value)) {
              logger.warn(`XSS attempt detected in ${key}: ${value.substring(0, 100)}`, 'security');
              return res.status(400).json({
                success: false,
                error: 'Invalid input: potentially malicious content detected'
              });
            }
          }
        }
      }
    }
  }
  next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('etag', false);

if (appConfig.network.nodeEnv !== 'production') {
  app.set('view cache', false);
}

// Health check endpoint
app.get('/health', (req, res) => {
  const cacheKey = 'health';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const data = {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    port,
    wsPort,
    memory: process.memoryUsage(),
    ip: globalIPManager.getInfo().current?.ip || 'unknown',
    clients: globalWSServer.getStats().clients,
    resources: globalResourceMonitor.getCurrentStats(),
    cache: globalStatsCache.getStats()
  };

  globalStatsCache.set(cacheKey, data, appConfig.cache.defaultTTL);
  res.json(data);
});

// Config endpoint
app.get('/config', (req, res) => {
  res.json({
    port,
    wsPort,
    platform: process.platform,
    nodeVersion: process.version,
    features: {
      monitor: true,
      proxy: true,
      dns: true,
      fingerprint: true,
      email: true,
      doh: true,
      websocket: true,
      smartBypass: true
    }
  });
});

// Smart bypass status и Monitor status удалены - дублируются в routes/bypass.js

// ============================================
// Bypass Tester API endpoints удалены - дублируются в routes/bypass.js
// ============================================

// ============================================
// System Proxy Manager API endpoints удалены - дублируются в routes/network.js
// ============================================

// ============================================
// Config Backup API endpoints удалены - дублируются в routes/backup.js
// ============================================

app.get('/', (req, res) => {
  const lang = req.query.lang || req.headers['accept-language']?.split(',')[0]?.split('-')[0] || 'ru';
  const validLang = getSupportedLanguages().includes(lang) ? lang : 'ru';
  const translations = getTranslations(validLang);
  const t = key => translations[key] || translations.en[key] || key;
  res.render('index', { lang: validLang, t, port, wsPort, translations });
});

app.get('/bypass', (req, res) => {
  res.render('bypass', { port, wsPort });
});

app.get('/dashboard', (req, res) => {
  res.render('dashboard', {});
});

// ============================================
// API Routes
// ============================================
app.use('/api/metrics', metricsRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/cache', cacheRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/proxy', proxyRouter);
app.use('/api/network', networkRouter);
app.use('/api/updater', updaterRouter);
app.use('/api/config-backup', backupRouter);
app.use('/api/bypass', bypassRouter);

app.use('/api', resetRouter);

// ============================================
// Graceful Shutdown с таймаутом
// ============================================
let isShuttingDown = false;

const gracefulShutdown = async signal => {
  if (isShuttingDown) {
    logger.warn(`Double shutdown signal received (${signal}), forcing exit...`, 'app');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`Graceful shutdown initiated (${signal})`, 'app');

  // Создаём таймаут для принудительного завершения
  const shutdownTimeout = setTimeout(() => {
    logger.error(`Graceful shutdown timeout (${appConfig.shutdown.timeout}ms), forcing exit...`, 'app');
    process.exit(1);
  }, appConfig.shutdown.timeout);

  // Разрешаем процессу завершиться даже с активным таймаутом
  shutdownTimeout.unref();

  try {
    // Остановка всех менеджеров параллельно с таймаутом на каждый
    const stopPromises = [
      // Мониторинг и кэш
      globalResourceMonitor.stopMonitoring(),
      globalStatsCache.stop(),
      globalMonitorManager.stopAutoCheck?.(),
      globalMetricsManager?.stopMetrics?.(),

      // Сетевые менеджеры
      globalWSServer.stop(),
      globalProxyManager.cleanup?.(),
      globalDNSManager.restoreDNS?.(),
      globalWireGuardManager.disconnect?.(),
      globalSmartBypassManager?.stop?.(),
      globalIPManager?.stop?.(),

      // Фоновые менеджеры
      globalFingerprintManager?.cleanup?.(),
      globalProxyDatabase?.close?.(),
      globalNotificationManager?.stop?.(),
      globalConfigBackup?.stop?.(),
      globalDPIBypass?.stop?.(),

      // AutoRollback очистка
      globalAutoRollbackManager?.cleanup?.()
    ].filter(p => p); // Убираем undefined

    // Добавляем таймаут на каждый промис
    const withTimeout = (promise, timeout, name) => Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timeout after ${timeout}ms`)), timeout).unref()
      )
    ]).catch(err => {
      logger.warn(`Manager stop timeout (${name}): ${err.message}`, 'app');
      return { skipped: true, reason: err.message };
    });

    await Promise.allSettled(
      stopPromises.map((p, i) => withTimeout(p, appConfig.shutdown.serverCloseTimeout, `manager-${i}`))
    );

    logger.info('All managers stopped', 'app');

    // Закрытие HTTP сервера с таймаутом
    if (server) {
      await Promise.race([
        new Promise((resolve, reject) => {
          server.close(err => {
            if (err) {reject(err);}
            else {resolve();}
          });
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('HTTP server close timeout')), appConfig.shutdown.serverCloseTimeout).unref()
        )
      ]).catch(err => {
        logger.warn(`HTTP server close error: ${err.message}`, 'app');
      });
      logger.info('HTTP server closed', 'app');
    }

    // Закрытие WebSocket сервера с таймаутом
    if (globalWSServer.wss) {
      await new Promise(resolve => {
        globalWSServer.wss.close(() => {
          // Останавливаем broadcast interval
          if (globalWSServer.broadcastTimer) {
            clearInterval(globalWSServer.broadcastTimer);
            globalWSServer.broadcastTimer = null;
          }
          resolve();
        });
      }).catch(err => {
        logger.warn(`WebSocket close error: ${err.message}`, 'app');
      });
      logger.info('WebSocket server closed', 'app');
    }

    // Отменяем таймаут если всё успешно
    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed successfully', 'app');
    process.exit(0);
  } catch (error) {
    clearTimeout(shutdownTimeout);
    logger.error(`Graceful shutdown error: ${error.message}`, 'app');
    process.exit(1);
  }
};

// Обработка сигналов завершения
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// Глобальные обработчики ошибок
// ============================================

// Необработанные исключения
process.on('uncaughtException', error => {
  logger.error(`Uncaught Exception: ${error.message}`, 'app', {
    stack: error.stack,
    code: error.code
  });

  // Попытка graceful shutdown
  if (!isShuttingDown) {
    gracefulShutdown('uncaughtException');
  }
});

// Необработанные Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection: ${reason?.message || reason}`, 'app', {
    stack: reason?.stack,
    promise: promise.toString()
  });
});

// Предупреждения о производительности
process.on('warning', warning => {
  logger.warn(`Process warning: ${warning.message}`, 'app', {
    stack: warning.stack,
    type: warning.name
  });
});

// ============================================
// Error handling middleware
// ============================================
app.use((err, req, res, _next) => {
  logger.error(`Request error: ${err.message}`, 'app', {
    path: req.path,
    method: req.method,
    stack: err.stack
  });

  res.status(err.status || 500).json({
    success: false,
    error: appConfig.network.nodeEnv === 'production' ? 'Internal server error' : err.message,
    path: req.path
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.path
  });
});

// Start server with auto-recovery
let currentServer = server;
const startServer = async () => {
  try {
    // Инициализация менеджеров (ПАРАЛЛЕЛЬНО для ускорения запуска)
    const initResults = await Promise.allSettled([
      globalMonitorManager.init(),
      globalFingerprintManager.init(),
      globalProxyDatabase.init(),
      globalMetricsManager.init(),
      globalResourceMonitor.init(),
      globalStatsCache.init(),
      globalNotificationManager.init(),
      globalConfigBackup.init(),
      globalDPIBypass.init(),
      globalWireGuardManager.init()
    ]);

    // Логирование результатов инициализации
    const managers = ['Monitor', 'Fingerprint', 'ProxyDatabase', 'Metrics', 'Resource', 'StatsCache', 'Notification', 'ConfigBackup', 'DPIBypass', 'WireGuard'];
    const criticalManagers = ['Monitor', 'ProxyDatabase', 'Resource']; // Критические менеджеры
    let criticalFailed = false;

    for (let i = 0; i < initResults.length; i++) {
      const result = initResults[i];
      if (result.status === 'rejected') {
        const errorMsg = `${managers[i]} manager init failed: ${result.reason?.message}`;
        logger.error(errorMsg, 'app');

        // Проверка критических менеджеров
        if (criticalManagers.includes(managers[i])) {
          criticalFailed = true;
          logger.error(`Critical manager ${managers[i]} failed to initialize. Server cannot start safely.`, 'app');
        }
      } else {
        logger.info(`${managers[i]} manager initialized`, 'app');
      }
    }

    // Прерывание запуска если критический менеджер не инициализировался
    if (criticalFailed) {
      logger.error('Server startup aborted due to critical manager failures', 'app');
      process.exit(1);
    }

    // Запуск авто-мониторинга с конфигурацией
    globalMonitorManager.enableAutoCheck(appConfig.monitoring.autoCheckInterval);

    // Запуск мониторинга ресурсов с конфигурацией
    globalResourceMonitor.startMonitoring(appConfig.monitoring.resourceSampleInterval);

    // Автобэкап конфигурации (если включено)
    if (appConfig.backup.enabled && appConfig.backup.autoInterval > 0) {
      const autoBackupTimer = setInterval(() => {
        globalConfigBackup.createBackup().then(result => {
          if (result.success) {
            logger.info(`Auto backup created: ${result.backupPath}`, 'backup');
          } else {
            logger.warn(`Auto backup failed: ${result.error}`, 'backup');
          }
        }).catch(err => {
          logger.error(`Auto backup error: ${err.message}`, 'backup');
        });
      }, appConfig.backup.autoInterval);
      autoBackupTimer.unref(); // Не блокирует graceful shutdown
    }

    // Отправка уведомления о старте (если настроены уведомления)
    if (appConfig.notifications.telegramBotToken || appConfig.notifications.discordWebhookUrl) {
      globalNotificationManager.sendEvent('start', { version: '2.8.0-dev' }).catch(err => {
        logger.debug(`Notification send failed: ${err.message}`, 'app');
      });
    }

    // Проверка обновлений при старте (если включено)
    if (appConfig.updater.enabled) {
      globalUpdater.checkForUpdates().then(result => {
        if (result.updateAvailable) {
          logger.info(`Update available: ${result.currentVersion} → ${result.latestVersion}`, 'app');
        }
      }).catch(err => {
        logger.error(`Update check failed: ${err.message}`, 'app');
      });

      // Автоматическое обновление с интервалом
      if (appConfig.updater.checkInterval > 0) {
        const autoUpdateTimer = setInterval(() => {
          globalUpdater.checkForUpdates().then(result => {
            if (result.updateAvailable) {
              logger.info(`Auto-update: ${result.currentVersion} → ${result.latestVersion}`, 'app');
            }
          }).catch(err => {
            logger.error(`Auto-update check failed: ${err.message}`, 'app');
          });
        }, appConfig.updater.checkInterval);
        autoUpdateTimer.unref(); // Не блокирует graceful shutdown
      }
    }

    // Инициализация smart bypass (если не был инициализирован)
    if (!globalSmartBypassManager.initialized) {
      await globalSmartBypassManager.init().catch(err => {
        logger.error(`SmartBypass init failed: ${err.message}`, 'app');
      });
    }

    // WebSocket сервер (на том же порту что и HTTP)
    globalWSServer.init(server, port);

    // Initial bypass test с настраиваемой задержкой
    const initialBypassDelay = 5000; // 5 секунд по умолчанию
    const initBypassTimer = setTimeout(() => {
      globalSmartBypassManager.testAllMethods().catch(err => {
        logger.error(`Initial bypass test failed: ${err.message}`, 'app');
      });
    }, initialBypassDelay);
    initBypassTimer.unref(); // Не блокирует graceful shutdown

    currentServer = server.listen(port, appConfig.network.host, () => {
      const msg = `🚀 Server running on http://${appConfig.network.host === '0.0.0.0' ? 'localhost' : appConfig.network.host}:${port} (WS: ${wsPort})`;
      console.log(msg);
      logger.info(msg, 'app');
    });

    // Auto-recovery при ошибке сервера
    currentServer.on('error', async err => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`Port ${port} is busy, selecting new port...`, 'app');
        const newPort = await DynamicConfig.autoSelectPort(port + 1);
        currentServer.close();
        currentServer = app.listen(newPort, () => {
          const msg = `🔄 Server restarted on http://${appConfig.network.host === '0.0.0.0' ? 'localhost' : appConfig.network.host}:${newPort}`;
          console.log(msg);
          logger.info(msg, 'app');
          globalWSServer.broadcast({
            type: 'server_restart',
            newPort,
            timestamp: Date.now()
          });
        });
      } else {
        logger.error(`Server error: ${err.message}`, 'app');
      }
    });

  } catch (error) {
    logger.error(`Startup error: ${error.message}`, 'app');
    process.exit(1);
  }
};

startServer();

export default app;
