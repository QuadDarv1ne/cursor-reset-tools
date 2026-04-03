/**
 * Proxy Router - API endpoints для управления прокси
 * Proxy, Proxy Rotation, DoH, Leak Detector
 */

import express from 'express';
import { globalProxyManager } from '../utils/proxyManager.js';
import { globalDoHManager } from '../utils/dohManager.js';
import { globalLeakDetector } from '../utils/leakDetector.js';
import { globalStatsCache } from '../utils/statsCache.js';
import { validateRequest, validateDomain } from '../utils/validator.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// ============================================
// Proxy endpoints
// ============================================

/**
 * GET /api/proxy/status
 * Статус прокси
 */
router.get('/status', async (req, res) => {
  const cacheKey = 'proxy:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const stats = globalProxyManager.getStats();
    const currentProxy = globalProxyManager.getCurrentProxy();

    const data = {
      success: true,
      stats,
      currentProxy
    };
    globalStatsCache.set(cacheKey, data, 3000);
    return res.json(data);
  } catch (error) {
    logger.error(`Proxy status error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proxy/add
 * Добавить прокси
 */
router.post('/add', async (req, res) => {
  try {
    const validation = validateRequest(req.body, {
      url: {
        type: 'string',
        required: true,
        sanitize: true
      },
      protocol: {
        type: 'string',
        required: false,
        default: 'socks5',
        sanitize: true
      }
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: validation.errors
      });
    }

    const { url, protocol } = validation.data;

    globalProxyManager.addProxy(url, protocol);
    return res.json({ success: true, message: 'Proxy added' });
  } catch (error) {
    logger.error(`Proxy add error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proxy/rotate
 * Сменить прокси
 */
router.post('/rotate', async (req, res) => {
  try {
    const proxy = await globalProxyManager.rotateProxy();

    if (proxy) {
      return res.json({ success: true, proxy });
    }
    return res.status(400).json({ success: false, error: 'No working proxies available' });
  } catch (error) {
    logger.error(`Proxy rotate error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proxy/clear
 * Очистить прокси
 */
router.post('/clear', async (req, res) => {
  try {
    globalProxyManager.clearProxy();
    return res.json({ success: true, message: 'Proxy cleared, working without proxy' });
  } catch (error) {
    logger.error(`Proxy clear error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Proxy Rotation endpoints
// ============================================

/**
 * GET /api/proxy/rotation/status
 * Статус авто-ротации
 */
router.get('/rotation/status', async (req, res) => {
  const cacheKey = 'proxy:rotation:status';
  const cached = globalStatsCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const status = globalProxyManager.getAutoRotationStatus();
    const data = { success: true, ...status };
    globalStatsCache.set(cacheKey, data, 3000);
    return res.json(data);
  } catch (error) {
    logger.error(`Proxy rotation status error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proxy/rotation/start
 * Запустить авто-ротацию
 */
router.post('/rotation/start', async (req, res) => {
  try {
    const { intervalMs = 300000 } = req.body;

    // Валидация диапазона intervalMs для предотвращения DoS
    const interval = parseInt(intervalMs, 10);
    if (isNaN(interval) || interval < 60000 || interval > 86400000) {
      return res.status(400).json({
        success: false,
        error: 'intervalMs must be between 60000 (1 min) and 86400000 (24 hours)'
      });
    }

    globalProxyManager.startAutoRotation(interval);
    return res.json({ success: true, message: 'Auto rotation started', intervalMs: interval });
  } catch (error) {
    logger.error(`Proxy rotation start error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/proxy/rotation/stop
 * Остановить авто-ротацию
 */
router.post('/rotation/stop', async (req, res) => {
  try {
    globalProxyManager.stopAutoRotation();
    return res.json({ success: true, message: 'Auto rotation stopped' });
  } catch (error) {
    logger.error(`Proxy rotation stop error: ${error.message}`, 'proxy');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DoH endpoints
// ============================================

/**
 * GET /api/doh/resolve
 * Разрешить домен через DoH
 */
router.get('/resolve', async (req, res) => {
  try {
    const { domain, provider = 'cloudflare' } = req.query;
    if (!domain) {
      return res.status(400).json({ success: false, error: 'Domain required' });
    }

    // Валидация домена для предотвращения SSRF
    if (!validateDomain(domain)) {
      return res.status(400).json({ success: false, error: 'Invalid domain format' });
    }

    const result = await globalDoHManager.resolve(domain, provider);
    return res.json({ success: true, result });
  } catch (error) {
    logger.error(`DoH resolve error: ${error.message}`, 'doh');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/doh/providers
 * Доступные DoH провайдеры
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = await globalDoHManager.getAvailableProviders();
    return res.json({ success: true, providers });
  } catch (error) {
    logger.error(`DoH providers error: ${error.message}`, 'doh');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// Leak Detector endpoints
// ============================================

/**
 * GET /api/leak/check
 * Проверка всех утечек
 */
router.get('/check', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkAll();
    return res.json({ success: true, ...results });
  } catch (error) {
    logger.error(`Leak check error: ${error.message}`, 'leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leak/dns
 * Проверка DNS утечек
 */
router.get('/dns', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkDNSLeak();
    return res.json({ success: true, ...results });
  } catch (error) {
    logger.error(`DNS leak check error: ${error.message}`, 'leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leak/webrtc
 * Проверка WebRTC утечек
 */
router.get('/webrtc', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkWebRTCLEak();
    return res.json({ success: true, ...results });
  } catch (error) {
    logger.error(`WebRTC leak check error: ${error.message}`, 'leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leak/ipv6
 * Проверка IPv6 утечек
 */
router.get('/ipv6', async (req, res) => {
  try {
    const results = await globalLeakDetector.checkIPv6Leak();
    return res.json({ success: true, ...results });
  } catch (error) {
    logger.error(`IPv6 leak check error: ${error.message}`, 'leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/leak/recommendations
 * Рекомендации по устранению утечек
 */
router.get('/recommendations', async (req, res) => {
  try {
    const recommendations = globalLeakDetector.getRecommendations();
    return res.json({ success: true, recommendations });
  } catch (error) {
    logger.error(`Leak recommendations error: ${error.message}`, 'leak');
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
