import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import http from 'http';
import resetRouter from './routes/reset.js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { getTranslations, getSupportedLanguages } from './utils/i18n.js';
import { globalMonitorManager } from './utils/monitorManager.js';
import { globalIPManager } from './utils/ipManager.js';
import { globalFingerprintManager } from './utils/fingerprintManager.js';
import { globalProxyDatabase } from './utils/proxyDatabase.js';
import { globalDoHManager } from './utils/dohManager.js';
import { globalSmartBypassManager } from './utils/smartBypassManager.js';
import { globalWSServer } from './utils/websocketServer.js';
import { globalUpdater } from './utils/updater.js';
import { globalMetricsManager } from './utils/metricsManager.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Динамическая конфигурация с авто-выбором портов
 */
const DynamicConfig = {
  ports: { http: null, ws: null },

  autoSelectPort: async (startPort = 3000, maxAttempts = 20) => {
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
    DynamicConfig.ports.http = await DynamicConfig.autoSelectPort(3000);
    DynamicConfig.ports.ws = await DynamicConfig.autoSelectPort(3001);
    return DynamicConfig.ports;
  }
};

// Инициализация конфигурации
const ports = await DynamicConfig.init();
const port = process.env.PORT || ports.http;
const wsPort = process.env.WS_PORT || ports.ws;

const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', limiter);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('etag', false);

if (process.env.NODE_ENV !== 'production') {
  app.set('view cache', false);
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
    port,
    wsPort,
    memory: process.memoryUsage(),
    ip: globalIPManager.getInfo().current?.ip || 'unknown',
    clients: globalWSServer.getStats().clients
  });
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

// Smart bypass status
app.get('/api/smart/status', (req, res) => {
  res.json({
    success: true,
    status: globalSmartBypassManager.getStatus()
  });
});

// Smart bypass test
app.post('/api/smart/test', async (req, res) => {
  try {
    const result = await globalSmartBypassManager.testAllMethods();
    res.json({
      success: true,
      result,
      best: globalSmartBypassManager.getBestMethod(),
      recommendations: globalSmartBypassManager.getRecommendations()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Smart bypass apply
app.post('/api/smart/apply', async (req, res) => {
  try {
    const result = await globalSmartBypassManager.applyBestMethod();
    res.json({
      success: true,
      result,
      best: globalSmartBypassManager.getBestMethod()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DoH resolve
app.get('/api/doh/resolve', async (req, res) => {
  try {
    const { domain, provider = 'cloudflare' } = req.query;
    if (!domain) {
      return res.status(400).json({ error: 'Domain required' });
    }
    const result = await globalDoHManager.resolve(domain, provider);
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DoH providers
app.get('/api/doh/providers', async (req, res) => {
  try {
    const providers = await globalDoHManager.getAvailableProviders();
    res.json({ success: true, providers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

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

// Updater API endpoints
app.get('/api/updater/status', async (req, res) => {
  try {
    const status = globalUpdater.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/updater/check', async (req, res) => {
  try {
    const result = await globalUpdater.checkForUpdates();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/updater/download', async (req, res) => {
  try {
    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    await globalUpdater.downloadUpdate(downloadPath);
    res.json({ success: true, message: 'Update downloaded', path: downloadPath });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/updater/install', async (req, res) => {
  try {
    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    const result = await globalUpdater.installUpdate(downloadPath);
    res.json({ success: result, message: 'Update installed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Metrics API endpoints
app.get('/api/metrics/status', async (req, res) => {
  try {
    const status = globalMetricsManager.getStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/metrics/enable', async (req, res) => {
  try {
    await globalMetricsManager.setEnabled(true);
    res.json({ success: true, message: 'Metrics enabled' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/metrics/disable', async (req, res) => {
  try {
    await globalMetricsManager.setEnabled(false);
    res.json({ success: true, message: 'Metrics disabled' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/metrics/export', async (req, res) => {
  try {
    const data = await globalMetricsManager.export();
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/metrics/clear', async (req, res) => {
  try {
    await globalMetricsManager.clear();
    res.json({ success: true, message: 'Metrics cleared' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api', resetRouter);

// Graceful shutdown
const gracefulShutdown = async signal => {
  logger.info(`Graceful shutdown initiated (${signal})`, 'app');
  globalWSServer.stop();
  server.close(() => {
    logger.info('HTTP server closed', 'app');
    process.exit(0);
  });
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout', 'app');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Dynamic error handling
app.use((err, req, res, next) => {
  logger.error(`Request error: ${err.message}`, 'app');
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
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
      globalMetricsManager.init()
    ]);

    // Логирование результатов инициализации
    const managers = ['Monitor', 'Fingerprint', 'ProxyDatabase', 'Metrics'];
    for (let i = 0; i < initResults.length; i++) {
      const result = initResults[i];
      if (result.status === 'rejected') {
        logger.error(`${managers[i]} manager init failed: ${result.reason?.message}`, 'app');
      } else {
        logger.info(`${managers[i]} manager initialized`, 'app');
      }
    }

    // Запуск авто-мониторинга
    globalMonitorManager.enableAutoCheck(60000);

    // Проверка обновлений при старте
    globalUpdater.checkForUpdates().then(result => {
      if (result.updateAvailable) {
        logger.info(`Update available: ${result.currentVersion} → ${result.latestVersion}`, 'app');
      }
    }).catch(err => {
      logger.error(`Update check failed: ${err.message}`, 'app');
    });

    // WebSocket сервер
    globalWSServer.init(server, wsPort);

    // Initial bypass test
    setTimeout(() => {
      globalSmartBypassManager.testAllMethods().catch(err => {
        logger.error(`Initial bypass test failed: ${err.message}`, 'app');
      });
    }, 5000);

    currentServer = server.listen(port, () => {
      const msg = `🚀 Server running on http://localhost:${port} (WS: ${wsPort})`;
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
          const msg = `🔄 Server restarted on http://localhost:${newPort}`;
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
