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
import { globalResourceMonitor } from './utils/resourceMonitor.js';
import { globalStatsCache } from './utils/statsCache.js';
import { globalNotificationManager } from './utils/notificationManager.js';
import { globalLeakDetector } from './utils/leakDetector.js';
import { globalVPNManager } from './utils/vpnManager.js';
import { globalDNSManager } from './utils/dnsManager.js';
import { globalVPNLeakFix } from './utils/vpnLeakFix.js';
import { globalVPNTrafficManager } from './utils/vpnTrafficManager.js';
import { globalBypassTester } from './utils/bypassTester.js';
import { globalSystemProxyManager } from './utils/systemProxyManager.js';
import { globalConfigBackup } from './utils/configBackup.js';
import { globalDPIBypass } from './utils/dpiBypass.js';
import { globalWireGuardManager } from './utils/wireguardManager.js';
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

  globalStatsCache.set(cacheKey, data, 5000); // 5 секунд TTL
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

// Smart bypass status
app.get('/api/smart/status', (req, res) => {
  res.json({
    success: true,
    status: globalSmartBypassManager.getStatus()
  });
});

// Monitor status
app.get('/api/monitor/status', (req, res) => {
  const cacheKey = 'monitor:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const data = {
    success: true,
    status: globalMonitorManager.getStatus()
  };
  globalStatsCache.set(cacheKey, data, 10000); // 10 секунд TTL
  res.json(data);
});

// Smart bypass test
app.post('/api/smart/test', async (req, res) => {
  try {
    const result = await globalSmartBypassManager.testAllMethods();
    return res.json({
      success: true,
      result,
      best: globalSmartBypassManager.getBestMethod(),
      recommendations: globalSmartBypassManager.getRecommendations()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Smart bypass apply
app.post('/api/smart/apply', async (req, res) => {
  try {
    const result = await globalSmartBypassManager.applyBestMethod();
    return res.json({
      success: true,
      result,
      best: globalSmartBypassManager.getBestMethod()
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN status
app.get('/api/vpn/status', async (req, res) => {
  try {
    const vpnStatus = await globalVPNManager.detectActiveVPN();
    return res.json({
      success: true,
      ...vpnStatus
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN check
app.post('/api/vpn/check', async (req, res) => {
  try {
    const vpnStatus = await globalVPNManager.detectActiveVPN();
    const recommendations = [];

    // Рекомендации на основе статуса VPN
    if (!vpnStatus.detected) {
      recommendations.push({
        type: 'vpn',
        priority: 'high',
        title: 'VPN не обнаружен',
        description: 'Для обхода блокировок рекомендуется включить VPN'
      });
    } else if (vpnStatus.countryCode === 'KZ') {
      recommendations.push({
        type: 'geo',
        priority: 'medium',
        title: 'Казахстан может иметь ограничения',
        description: 'Cursor может блокировать некоторые функции в вашем регионе'
      });
    }

    // Проверка DNS
    const dnsStatus = await globalMonitorManager.checkDNS();
    if (dnsStatus.availableCount < 2) {
      recommendations.push({
        type: 'dns',
        priority: 'high',
        title: 'Публичные DNS недоступны',
        description: 'Рекомендуется сменить DNS на Cloudflare (1.1.1.1)'
      });
    }

    return res.json({
      success: true,
      vpn: vpnStatus,
      dns: dnsStatus,
      recommendations
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DNS status
app.get('/api/dns/status', async (req, res) => {
  try {
    const currentDNS = await globalDNSManager.getCurrentDNS();
    const providers = globalDNSManager.getAvailableProviders();
    const dnsStatus = await globalMonitorManager.checkDNS();

    return res.json({
      success: true,
      current: currentDNS,
      providers,
      status: dnsStatus
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DNS set
app.post('/api/dns/set', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ success: false, error: 'Provider required' });
    }

    const success = await globalDNSManager.setDNS(provider);
    if (success) {
      await globalDNSManager.flushDNSCache();
      return res.json({ success: true, message: `DNS set to ${provider}` });
    }
    return res.status(500).json({ success: false, error: 'Failed to set DNS' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DNS restore
app.post('/api/dns/restore', async (req, res) => {
  try {
    const success = await globalDNSManager.restoreDNS();
    if (success) {
      await globalDNSManager.flushDNSCache();
      return res.json({ success: true, message: 'DNS restored to automatic (DHCP)' });
    }
    return res.status(500).json({ success: false, error: 'Failed to restore DNS' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DNS flush cache
app.post('/api/dns/flush', async (req, res) => {
  try {
    await globalDNSManager.flushDNSCache();
    return res.json({ success: true, message: 'DNS cache flushed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// VPN Leak Fix API endpoints
// ============================================

// VPN Leak Fix - комплексное исправление утечек
app.post('/api/vpn-leak/fix', async (req, res) => {
  try {
    const result = await globalVPNLeakFix.fixAll();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN Leak Fix - восстановление настроек
app.post('/api/vpn-leak/restore', async (req, res) => {
  try {
    const success = await globalVPNLeakFix.restoreSettings();
    return res.json({ success, message: success ? 'Settings restored' : 'Restore failed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN Leak Fix - статус
app.get('/api/vpn-leak/status', async (req, res) => {
  try {
    const status = await globalVPNLeakFix.getLeakStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// VPN Traffic Manager API endpoints
// ============================================

// VPN Traffic - настройка полного туннелирования
app.post('/api/vpn-traffic/configure', async (req, res) => {
  try {
    const result = await globalVPNTrafficManager.configureFullTunnel();
    return res.json({ success: result.success, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN Traffic - включение Kill Switch
app.post('/api/vpn-traffic/killswitch/enable', async (req, res) => {
  try {
    const success = await globalVPNTrafficManager.enableKillSwitch();
    return res.json({ success, message: success ? 'Kill Switch enabled' : 'Failed to enable' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN Traffic - отключение Kill Switch
app.post('/api/vpn-traffic/killswitch/disable', async (req, res) => {
  try {
    const success = await globalVPNTrafficManager.disableKillSwitch();
    return res.json({ success, message: success ? 'Kill Switch disabled' : 'Failed to disable' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN Traffic - статус туннеля
app.get('/api/vpn-traffic/status', async (req, res) => {
  try {
    const status = await globalVPNTrafficManager.getTunnelStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// VPN Traffic - быстрая настройка для Cursor
app.post('/api/vpn-traffic/quick-setup', async (req, res) => {
  try {
    const result = await globalVPNTrafficManager.quickSetupForCursor();
    return res.json({ success: result.success, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Bypass Tester API endpoints
// ============================================

// Bypass Tester - полный тест
app.get('/api/bypass/test/full', async (req, res) => {
  try {
    const result = await globalBypassTester.runFullTest();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Bypass Tester - быстрый тест
app.get('/api/bypass/test/quick', async (req, res) => {
  try {
    const result = await globalBypassTester.runQuickTest();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Bypass Tester - последние результаты
app.get('/api/bypass/results', async (req, res) => {
  try {
    const results = globalBypassTester.getLastResults();
    return res.json({ success: true, results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Bypass Tester - рекомендации (текст)
app.get('/api/bypass/recommendations', async (req, res) => {
  try {
    const text = globalBypassTester.getFormattedRecommendations();
    return res.json({ success: true, text });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// System Proxy Manager API endpoints
// ============================================

// System Proxy - настройка прокси
app.post('/api/system-proxy/configure', async (req, res) => {
  try {
    const { host, port, protocol = 'http', auth } = req.body;
    if (!host || !port) {
      return res.status(400).json({ success: false, error: 'host and port required' });
    }
    const result = await globalSystemProxyManager.configureProxy({ host, port, protocol, auth });
    return res.json({ success: result.success, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// System Proxy - отключение прокси
app.post('/api/system-proxy/disable', async (req, res) => {
  try {
    const result = await globalSystemProxyManager.disableProxy();
    return res.json({ success: result.success, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// System Proxy - статус
app.get('/api/system-proxy/status', async (req, res) => {
  try {
    const status = await globalSystemProxyManager.getProxyStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// System Proxy - восстановление настроек
app.post('/api/system-proxy/restore', async (req, res) => {
  try {
    const success = await globalSystemProxyManager.restoreOriginalSettings();
    return res.json({ success, message: success ? 'Settings restored' : 'Restore failed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Config Backup API endpoints
// ============================================

// Config Backup - экспорт конфигурации
app.post('/api/config-backup/export', async (req, res) => {
  try {
    const { filePath } = req.body;
    const result = await globalConfigBackup.export(filePath);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Config Backup - импорт конфигурации
app.post('/api/config-backup/import', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) {
      return res.status(400).json({ success: false, error: 'File path is required' });
    }
    const result = await globalConfigBackup.import(filePath);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Config Backup - список бэкапов
app.get('/api/config-backup/list', async (req, res) => {
  try {
    const backups = await globalConfigBackup.listBackups();
    return res.json({ success: true, backups });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Config Backup - автобэкап
app.post('/api/config-backup/auto', async (req, res) => {
  try {
    const result = await globalConfigBackup.autoBackup();
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Config Backup - удаление бэкапа
app.delete('/api/config-backup/delete/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const success = await globalConfigBackup.deleteBackup(filename);
    return res.json({ success, message: success ? 'Backup deleted' : 'Delete failed' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Config Backup - очистка старых бэкапов
app.post('/api/config-backup/cleanup', async (req, res) => {
  try {
    const deleted = await globalConfigBackup.cleanup();
    return res.json({ success: true, deleted });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Config Backup - статистика
app.get('/api/config-backup/stats', async (req, res) => {
  try {
    const stats = await globalConfigBackup.getStats();
    return res.json({ success: true, ...stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Amnezia VPN API endpoints
// ============================================

// Amnezia VPN - статус
app.get('/api/amnezia/status', async (req, res) => {
  try {
    const status = await globalVPNManager.getAmneziaStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Amnezia VPN - рекомендации
app.get('/api/amnezia/recommendations', async (req, res) => {
  try {
    const recommendations = globalVPNManager.getAmneziaRecommendations();
    return res.json({ success: true, recommendations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DoH-VPN Integration API endpoints
// ============================================

// DoH-VPN Integration
app.post('/api/doh-vpn/integrate', async (req, res) => {
  try {
    const result = await globalDoHManager.integrateWithVPN();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DoH-VPN Recommendations
app.get('/api/doh-vpn/recommendations', async (req, res) => {
  try {
    const recommendations = globalDoHManager.getVPNRecommendations();
    return res.json({ success: true, ...recommendations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy status
app.get('/api/proxy/status', async (req, res) => {
  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    const stats = globalProxyManager.getStats();
    const currentProxy = globalProxyManager.getCurrentProxy();

    return res.json({
      success: true,
      stats,
      currentProxy
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy add
app.post('/api/proxy/add', async (req, res) => {
  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    const { url, protocol = 'socks5' } = req.body;

    if (!url) {
      return res.status(400).json({ success: false, error: 'Proxy URL required' });
    }

    globalProxyManager.addProxy(url, protocol);
    return res.json({ success: true, message: 'Proxy added' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy rotate
app.post('/api/proxy/rotate', async (req, res) => {
  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    const proxy = globalProxyManager.rotateProxy();

    if (proxy) {
      return res.json({ success: true, proxy });
    }
    return res.status(400).json({ success: false, error: 'No working proxies available' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy clear
app.post('/api/proxy/clear', async (req, res) => {
  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    globalProxyManager.clearProxy();
    return res.json({ success: true, message: 'Proxy cleared, working without proxy' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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
    return res.json({ success: true, result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DoH providers
app.get('/api/doh/providers', async (req, res) => {
  try {
    const providers = await globalDoHManager.getAvailableProviders();
    return res.json({ success: true, providers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Leak detector endpoints
app.get('/api/leak/check', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkAll();
    return res.json({ success: true, ...results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/leak/dns', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkDNSLeak();
    return res.json({ success: true, ...results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/leak/webrtc', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkWebRTCLEak();
    return res.json({ success: true, ...results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/leak/ipv6', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkIPv6Leak();
    return res.json({ success: true, ...results });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/leak/recommendations', async (req, res) => {
  try {
    const recommendations = globalLeakDetector.getRecommendations();
    return res.json({ success: true, recommendations });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
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

app.get('/dashboard', (req, res) => {
  res.render('dashboard', {});
});

// Updater API endpoints
app.get('/api/updater/status', async (req, res) => {
  try {
    const status = globalUpdater.getStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/updater/check', async (req, res) => {
  try {
    const result = await globalUpdater.checkForUpdates();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/updater/download', async (req, res) => {
  try {
    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    await globalUpdater.downloadUpdate(downloadPath);
    return res.json({ success: true, message: 'Update downloaded', path: downloadPath });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/updater/install', async (req, res) => {
  try {
    const downloadPath = path.join(process.cwd(), 'updates', 'update.zip');
    const result = await globalUpdater.installUpdate(downloadPath);
    return res.json({ success: result, message: 'Update installed successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Metrics API endpoints
app.get('/api/metrics/status', async (req, res) => {
  try {
    const status = globalMetricsManager.getStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/metrics/enable', async (req, res) => {
  try {
    await globalMetricsManager.setEnabled(true);
    return res.json({ success: true, message: 'Metrics enabled' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/metrics/disable', async (req, res) => {
  try {
    await globalMetricsManager.setEnabled(false);
    return res.json({ success: true, message: 'Metrics disabled' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/metrics/export', async (req, res) => {
  try {
    const data = await globalMetricsManager.export();
    return res.json({ success: true, ...data });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/metrics/clear', async (req, res) => {
  try {
    await globalMetricsManager.clear();
    return res.json({ success: true, message: 'Metrics cleared' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Resource Monitor API endpoints
app.get('/api/resources/status', async (req, res) => {
  const cacheKey = 'resources:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalResourceMonitor.getCurrentStats();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 3000); // 3 секунды TTL
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/resources/summary', async (req, res) => {
  const cacheKey = 'resources:summary';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const summary = globalResourceMonitor.getSummary();
    const data = { success: true, ...summary };
    globalStatsCache.set(cacheKey, data, 5000); // 5 секунд TTL
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/resources/history', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const history = globalResourceMonitor.getHistory(parseInt(limit, 10));
    return res.json({ success: true, history });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/resources/alerts', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const alerts = globalResourceMonitor.getAlerts(parseInt(limit, 10));
    return res.json({ success: true, alerts });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/resources/alerts/clear', async (req, res) => {
  try {
    globalResourceMonitor.clearAlerts();
    return res.json({ success: true, message: 'Alerts cleared' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Stats Cache API endpoints
app.get('/api/cache/status', async (req, res) => {
  const cacheKey = 'cache:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalStatsCache.getStats();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 2000); // 2 секунды TTL
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/cache/stats', async (req, res) => {
  try {
    const stats = globalStatsCache.export();
    return res.json({ success: true, ...stats });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cache/clear', async (req, res) => {
  try {
    globalStatsCache.clear();
    return res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cache/reset-stats', async (req, res) => {
  try {
    globalStatsCache.resetStats();
    return res.json({ success: true, message: 'Stats reset' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Notification Manager API endpoints
app.get('/api/notifications/status', async (req, res) => {
  const cacheKey = 'notifications:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalNotificationManager.getStatus();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 5000); // 5 секунд TTL
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/configure/telegram', async (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    if (!botToken || !chatId) {
      return res.status(400).json({ success: false, error: 'botToken and chatId required' });
    }
    globalNotificationManager.configureTelegram(botToken, chatId);
    return res.json({ success: true, message: 'Telegram configured' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/configure/discord', async (req, res) => {
  try {
    const { webhookUrl } = req.body;
    if (!webhookUrl) {
      return res.status(400).json({ success: false, error: 'webhookUrl required' });
    }
    globalNotificationManager.configureDiscord(webhookUrl);
    return res.json({ success: true, message: 'Discord configured' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/enable', async (req, res) => {
  try {
    globalNotificationManager.setEnabled(true);
    return res.json({ success: true, message: 'Notifications enabled' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/disable', async (req, res) => {
  try {
    globalNotificationManager.setEnabled(false);
    return res.json({ success: true, message: 'Notifications disabled' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/test', async (req, res) => {
  try {
    const result = await globalNotificationManager.sendTest();
    return res.json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/notifications/export', async (req, res) => {
  try {
    const config = globalNotificationManager.exportConfig();
    return res.json({ success: true, config });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Proxy auto-rotation API endpoints
app.get('/api/proxy/rotation/status', async (req, res) => {
  const cacheKey = 'proxy:rotation:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    const status = globalProxyManager.getAutoRotationStatus();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 3000); // 3 секунды TTL
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/proxy/rotation/start', async (req, res) => {
  try {
    const { intervalMs = 300000 } = req.body;
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    globalProxyManager.startAutoRotation(intervalMs);
    return res.json({ success: true, message: 'Auto rotation started' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/proxy/rotation/stop', async (req, res) => {
  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    globalProxyManager.stopAutoRotation();
    return res.json({ success: true, message: 'Auto rotation stopped' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/proxy/rotate', async (req, res) => {
  try {
    const { globalProxyManager } = await import('./utils/proxyManager.js');
    const result = globalProxyManager.rotateProxy();
    return res.json({ success: true, proxy: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api', resetRouter);

// Graceful shutdown
const gracefulShutdown = async signal => {
  logger.info(`Graceful shutdown initiated (${signal})`, 'app');

  // Остановка менеджеров
  globalResourceMonitor.stopMonitoring();
  globalStatsCache.stop();
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
app.use((err, req, res, _next) => {
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

    // Запуск мониторинга ресурсов
    globalResourceMonitor.startMonitoring(5000);

    // Отправка уведомления о старте (если включено)
    globalNotificationManager.sendEvent('start', { version: '2.4.0' }).catch(() => {});

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
